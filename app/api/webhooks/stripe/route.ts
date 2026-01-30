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

                // 1. Log Purchase
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

                // 3. Notify Admin via Notifications System (If it's a Service)
                try {
                    const { data: service } = await supabase
                        .from('services')
                        .select('title, image_url')
                        .eq('stripe_product_id', stripeProductId)
                        .single();

                    if (service) {
                        const { error: notificationError } = await supabase.from('admin_notifications').insert({
                            type: 'service_booking',
                            title: `New Booking: ${service.title}`,
                            message: `${customerName} has booked ${service.title}.`,
                            user_id: finalUserId,
                            reference_id: session.id,
                            status: 'unread',
                            metadata: {
                                customerName,
                                email: customerEmail,
                                phone: customerPhone,
                                amount: item.amount_total ? (item.amount_total / 100).toFixed(2) : '0.00',
                                currency: item.currency?.toUpperCase() || 'USD',
                                serviceTitle: service.title,
                                serviceImage: service.image_url
                            }
                        });

                        if (notificationError) {
                            console.error('[Stripe Webhook] Notification Insert Error:', notificationError);
                            await logEvent('error', `Admin Notification Failed: ${notificationError.message}`);
                        } else {
                            await logEvent('notification', `Admin notification sent for ${service.title}`);
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
            return new Response('Error processing session', { status: 500 });
        }
    }

    return new Response('Received', { status: 200 });
}
