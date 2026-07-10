import { headers } from 'next/headers';
import { stripe } from '@/utils/stripe';
import { createAdminClient } from '@/utils/supabase/admin';
import { grantAccessForProduct } from '@/app/lib/access-logic';
import Stripe from 'stripe';

export async function POST(req: Request) {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get('Stripe-Signature') as string;

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.error('Missing STRIPE_WEBHOOK_SECRET');
        return new Response('Server Error', { status: 500 });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err: unknown) {
        const error = err as Error;
        console.error(`Webhook signature verification failed.`, error.message);
        return new Response(`Webhook Error: ${error.message}`, { status: 400 });
    }

    // Use Admin Client to bypass RLS for Webhook operations
    const supabase = createAdminClient();

    // Helper to log to DB
    const logEvent = async (status: string, message?: string, details?: unknown) => {
        try {
            await supabase.from('webhook_events').insert({
                event_type: event?.type || 'unknown',
                payload: details || (event?.data?.object),
                status,
                error_message: message
            });
        } catch (e) {
            console.error('Failed to log webhook event:', e);
        }
    };

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        // Fallback: Check metadata if client_reference_id is missing
        const userId = session.client_reference_id;
        const finalUserId = userId || session.metadata?.userId;

        console.log(`[Stripe Webhook] Session Info: SessionID=${session.id}, UserID=${finalUserId}`);

        // Idempotency gate: record this Stripe event.id once. Stripe delivers
        // at-least-once and retries non-2xx deliveries for up to 3 days, so the
        // same event can arrive multiple times. The upsert-with-ignoreDuplicates
        // atomically inserts the id; an empty result means the row already
        // existed (a retry/duplicate) and we skip reprocessing. Marked here at
        // the start and rolled back on a 500 (see the catch) so a genuine
        // failure can still be retried. Fails OPEN if the table is absent (e.g.
        // migration not yet applied) so the code can ship before the migration.
        try {
            const { data: gateRows, error: gateError } = await supabase
                .from('stripe_processed_events')
                .upsert({ event_id: event.id }, { onConflict: 'event_id', ignoreDuplicates: true })
                .select('event_id');

            if (!gateError && Array.isArray(gateRows) && gateRows.length === 0) {
                console.log(`[Stripe Webhook] Duplicate event ${event.id} — already processed, skipping.`);
                return new Response('Already processed', { status: 200 });
            }
        } catch (gateErr) {
            console.warn('[Stripe Webhook] Idempotency gate error, proceeding:', gateErr);
        }

        // Secondary guard: skip re-inserting the admin notification if one for
        // this session already exists (belt-and-suspenders alongside the gate).
        const { data: existingNotif } = await supabase
            .from('admin_notifications')
            .select('id')
            .eq('reference_id', session.id)
            .maybeSingle();

        if (existingNotif) {
            console.log(`[Stripe Webhook] Duplicate Session ${session.id} - Notification already exists.`);
            // We continue to log specific line items just in case, or we implicitly return?
            // If we return, we might skip purchases if they failed but notification succeeded? (Unlikely order)
            // Use caution: only skip the notification insert if it exists.
        }

        await logEvent('processing', `Started for User ${finalUserId || 'UNKNOWN'}`, {
            session_id: session.id,
            user_id: finalUserId,
            client_ref: userId,
            metadata: session.metadata
        });

        // Extract Customer Details
        const customerEmail = session.customer_details?.email || session.customer_email || 'No Email';
        const customerPhone = session.customer_details?.phone || 'No Phone';
        const customerName = session.customer_details?.name || 'No Name';

        if (!finalUserId) {
            console.error('[Stripe Webhook] No userId found in session');
            await logEvent('error', 'No userId found in session', { session_dump: session });
            return new Response('No userId', { status: 200 }); // Return 200 to acknowledge Stripe
        }

        try {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });

            for (const item of lineItems.data) {
                // Handle both expanded object and string ID
                const stripeProductId = typeof item.price?.product === 'string'
                    ? item.price?.product
                    : (item.price?.product as Stripe.Product)?.id;

                console.log(`[Stripe Webhook] Processing Item: ProductID=${stripeProductId}, UserID=${finalUserId}`);
                await logEvent('item_processing', `Processing Item ${stripeProductId}`, { product_id: stripeProductId });

                if (!stripeProductId) {
                    await logEvent('warning', 'Item has no Product ID');
                    continue;
                }

                // 1. Log Purchase. Retries of this same Stripe event are already
                // prevented by the event-level idempotency gate above, so the
                // old fragile 5-minute time-window dedup is no longer needed.
                const { error: purchaseError } = await supabase.from('purchases').insert({
                    user_id: finalUserId,
                    product_id: stripeProductId,
                    amount_paid: item.amount_total ? item.amount_total / 100 : 0,
                    currency: item.currency?.toUpperCase() || 'USD',
                    status: 'completed'
                });

                if (purchaseError) {
                    console.error('[Stripe Webhook] Purchase Insert Error:', purchaseError);
                    await logEvent('error', `Purchase Insert Failed: ${purchaseError.message}`);
                }

                // 2. Grant Access Logic
                const granted = await grantAccessForProduct(
                    supabase,
                    finalUserId,
                    stripeProductId,
                    logEvent
                );

                if (!granted) {
                    console.log(`[Stripe Webhook] No matching content found for Product ID: ${stripeProductId}`);
                    await logEvent('warning', `No content match for Product ID: ${stripeProductId}`);
                }

                // 3. Notify Admin via Notifications System
                try {
                    // Strategy: Check what kind of product this is

                    // A. Services
                    const { data: service } = await supabase
                        .from('services')
                        .select('title, image_url')
                        .eq('stripe_product_id', stripeProductId)
                        .single();

                    // B. Masterclasses
                    const { data: masterclass } = !service ? await supabase
                        .from('masterclasses')
                        .select('title, thumbnail_url')
                        .eq('stripe_product_id', stripeProductId)
                        .single() : { data: null };

                    // C. Individual Chapters (Courses)
                    const { data: chapter } = (!service && !masterclass) ? await supabase
                        .from('chapters')
                        .select('title, thumbnail_url')
                        .eq('stripe_product_id', stripeProductId)
                        .single() : { data: null };

                    // D. Offers
                    const { data: offer } = (!service && !masterclass && !chapter) ? await supabase
                        .from('offers')
                        .select('title, slug') // Offers might not have image, or use static
                        .eq('stripe_product_id', stripeProductId)
                        .single() : { data: null };

                    // Determine Notification Type & Data
                    let notificationType = '';
                    let productTitle = '';
                    let productImage = '';

                    if (service) {
                        notificationType = 'service_booking';
                        productTitle = service.title;
                        productImage = service.image_url;
                    } else if (masterclass) {
                        notificationType = 'masterclass_purchase';
                        productTitle = masterclass.title;
                        productImage = masterclass.thumbnail_url;
                    } else if (chapter) {
                        notificationType = 'course_sale';
                        productTitle = chapter.title;
                        productImage = chapter.thumbnail_url;
                    } else if (offer) {
                        notificationType = 'offer_sale';
                        productTitle = offer.title;
                        productImage = '';
                    }

                    if (notificationType) {
                        // Verify Profile Exists to avoid FK Constraint Error
                        const { data: profileExists } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('id', finalUserId)
                            .single();

                        // If profile missing, fallback to NULL and add note
                        const notificationUserId = profileExists ? finalUserId : null;
                        const fallbackMessage = !profileExists ? ` (Profile Missing: ${finalUserId})` : "";

                        // Prevent duplicates
                        if (!existingNotif) {
                            const { error: notificationError } = await supabase.from('admin_notifications').insert({
                                type: notificationType,
                                title: `New Sale: ${productTitle}`,
                                message: `${customerName} purchased ${productTitle}.${fallbackMessage}`,
                                user_id: notificationUserId,
                                reference_id: session.id,
                                status: 'unread',
                                metadata: {
                                    original_user_id: finalUserId,
                                    customerName,
                                    email: customerEmail,
                                    phone: customerPhone,
                                    amount: item.amount_total ? (item.amount_total / 100).toFixed(2) : '0.00',
                                    currency: item.currency?.toUpperCase() || 'USD',
                                    serviceTitle: productTitle,
                                    serviceImage: productImage
                                }
                            });

                            if (notificationError) {
                                console.error('[Stripe Webhook] Notification Insert Error:', notificationError);
                                await logEvent('error', `Admin Notification Failed: ${notificationError.message}`);
                            } else {
                                await logEvent('notification', `Admin notification sent for ${productTitle}`);
                            }
                        } else {
                            console.log(`[Stripe Webhook] Skipping duplicate notification for session ${session.id}`);
                        }
                    }
                } catch (notifyErr) {
                    console.error('[Stripe Webhook] Notification Logic Error:', notifyErr);
                }
            }
        } catch (err: unknown) {
            const error = err as Error;
            console.error('Error processing checkout session:', err);
            await logEvent('fatal_error', error.message);
            // Roll back the idempotency mark so Stripe's retry can reprocess this
            // event (we return 500, which Stripe treats as a failed delivery).
            try {
                await supabase.from('stripe_processed_events').delete().eq('event_id', event.id);
            } catch (rollbackErr) {
                console.warn('[Stripe Webhook] Failed to roll back idempotency mark:', rollbackErr);
            }
            return new Response('Error processing session', { status: 500 });
        }
    }

    return new Response('Received', { status: 200 });
}
