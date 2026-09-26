import { headers } from 'next/headers';
import { stripe } from '@/utils/stripe';
import { createAdminClient } from '@/utils/supabase/admin';
import { resolveOrCreateUserByEmail, generateSetPasswordLink } from '@/app/lib/guest-purchase';
import { createPurchaseClaim, isClaimOpen } from '@/app/lib/purchase-claims';
import { fulfillLineItem } from '@/app/lib/fulfillment';
import { sendEmail } from '@/lib/resend';
import { getPurchaseWelcomeHtml, getPurchaseWelcomeSubject, type EmailLocale } from '@/lib/email-templates';
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

    // Drop the idempotency mark so a 500 can actually be retried. Without this
    // an early failure would be permanently "already processed".
    const releaseIdempotency = async () => {
        try {
            await supabase.from('stripe_processed_events').delete().eq('event_id', event.id);
        } catch (e) {
            console.warn('[Stripe Webhook] Failed to release idempotency mark:', e);
        }
    };

    // Refunds and disputes are recorded, never silently ignored. Access is not
    // revoked automatically: the published refund policy is that sales are
    // final, so a refund is a human decision about a specific customer, not a
    // rule the webhook should enforce on its own. What it must not do is leave
    // no trace.
    if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
        const charge = event.data.object as Stripe.Charge | Stripe.Dispute;
        await logEvent('warning', `${event.type} received — needs manual review`, {
            event_type: event.type,
            charge: 'id' in charge ? charge.id : null,
        });

        // Keyed on the Stripe EVENT, not the charge: admin_notifications.
        // reference_id is unique, and one charge can be refunded more than once
        // (partial refunds) or refunded and then disputed. Keyed on the charge,
        // every notice after the first was refused. A redelivery of the same
        // event still collides, which is the idempotency we want.
        //
        // Never fail the delivery over a notification; Stripe would retry an
        // event that has already been recorded. supabase-js returns errors
        // rather than throwing, so they are read, not caught.
        const chargeId = 'id' in charge ? charge.id : null;
        const { error: notifyError } = await supabase.from('admin_notifications').insert({
            type: 'payment_review',
            title: event.type === 'charge.refunded' ? 'Refund issued' : 'Payment disputed',
            message: `Stripe reported ${event.type} for ${chargeId ?? 'an unknown charge'}. Review whether access should be revoked.`,
            reference_id: event.id,
            metadata: { charge_id: chargeId, event_type: event.type },
        });
        if (notifyError && notifyError.code !== '23505') {
            console.error('[Stripe Webhook] Refund notification failed:', notifyError);
            await logEvent('error', `Payment review notification failed: ${notifyError.message}`);
        }

        return new Response('Recorded', { status: 200 });
    }

    // `checkout.session.completed` fires when checkout finishes, which is not
    // the same as the money having arrived. With a delayed payment method it
    // arrives unpaid and settles later, so fulfilling here would grant access
    // before settlement. `async_payment_succeeded` is the event that says the
    // funds landed, and it is handled by the same path.
    const isFulfillmentEvent =
        event.type === 'checkout.session.completed' ||
        event.type === 'checkout.session.async_payment_succeeded';

    if (event.type === 'checkout.session.async_payment_failed') {
        const failed = event.data.object as Stripe.Checkout.Session;
        await logEvent('warning', `Delayed payment failed for session ${failed.id}`);
        return new Response('Recorded', { status: 200 });
    }

    if (isFulfillmentEvent) {
        const session = event.data.object as Stripe.Checkout.Session;

        // The gate that was missing entirely. An unpaid session is
        // acknowledged so Stripe stops redelivering it, and nothing is
        // granted until the matching async_payment_succeeded arrives.
        if (session.payment_status !== 'paid') {
            await logEvent(
                'info',
                `Session ${session.id} is ${session.payment_status}; waiting for settlement`
            );
            return new Response('Awaiting payment', { status: 200 });
        }
        // Fallback: Check metadata if client_reference_id is missing
        const userId = session.client_reference_id;
        const finalUserId = userId || session.metadata?.userId;

        console.log(`[Stripe Webhook] Session Info: SessionID=${session.id}, UserID=${finalUserId}`);

        // Record that this Stripe event.id was seen. It is a record, NOT a
        // gate: it used to answer a repeat delivery "Already processed" and
        // return, but it is written before the work, and a run that dies
        // mid-way never reaches the catch that removes it — so Stripe's retry
        // of exactly that delivery was turned away and the purchase was never
        // fulfilled. Repeats are made safe per line item instead, by
        // fulfillLineItem: a completed item is skipped, one another delivery
        // is working on is refused, an abandoned one is taken over.
        try {
            const { data: gateRows, error: gateError } = await supabase
                .from('stripe_processed_events')
                .upsert({ event_id: event.id }, { onConflict: 'event_id', ignoreDuplicates: true })
                .select('event_id');

            if (!gateError && Array.isArray(gateRows) && gateRows.length === 0) {
                console.log(`[Stripe Webhook] Repeat delivery of ${event.id}; re-checking its line items.`);
            }
        } catch (gateErr) {
            console.warn('[Stripe Webhook] Could not record event id, proceeding:', gateErr);
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

        // A guest checkout has no user id by design: the buyer had no account
        // when she paid. Resolve or create one from the email Stripe collected
        // and continue exactly as a logged-in purchase would.
        //
        // This block replaces a `return 200` that acknowledged the delivery and
        // silently lost the sale — money taken, nothing granted, no retry.
        let resolvedUserId = finalUserId;
        let isNewAccount = false;
        // Whether she has ever signed in — not whether this delivery made the
        // account. See the claim below.
        let needsWayIn = false;

        if (!resolvedUserId) {
            const hasEmail = customerEmail && customerEmail !== 'No Email';

            if (!hasEmail) {
                // Nothing to attach the purchase to and no way to reach the
                // buyer. Fail loudly so Stripe retries and the event stays
                // visible instead of disappearing.
                await logEvent('fatal_error', 'Session has neither a user id nor an email', {
                    session_id: session.id,
                });
                await releaseIdempotency();
                return new Response('No user id and no email', { status: 500 });
            }

            // A failed account lookup throws (migration 31): "could not look"
            // must not become "no account, create one". This runs before the
            // try below, so it is caught here — an escaped throw would leave
            // the idempotency mark in place and Stripe's retry would be
            // answered "already processed", losing the purchase.
            let resolved: Awaited<ReturnType<typeof resolveOrCreateUserByEmail>>;
            try {
                resolved = await resolveOrCreateUserByEmail(
                    supabase,
                    customerEmail,
                    customerName !== 'No Name' ? customerName : null
                );
            } catch (lookupErr) {
                await logEvent('fatal_error', `Account lookup failed for ${customerEmail}: ${(lookupErr as Error).message}`);
                await releaseIdempotency();
                return new Response('Account lookup failed', { status: 500 });
            }

            if (!resolved) {
                await logEvent('fatal_error', `Could not resolve an account for ${customerEmail}`);
                await releaseIdempotency();
                return new Response('Could not create account', { status: 500 });
            }

            resolvedUserId = resolved.userId;
            isNewAccount = resolved.created;
            needsWayIn = resolved.needsWayIn;
            await logEvent(
                'info',
                `Guest purchase attached to ${resolvedUserId} (new account: ${isNewAccount})`
            );
        }

        // Remembered for the welcome email below, which names what was bought.
        let purchasedTitle = 'your Vault access';

        // A renewal extends the term she already holds and climbs the price
        // ladder; a first purchase starts both. Only the renewal action sets
        // this marker, so anything else is a first purchase by construction.
        const isRenewal = session.metadata?.kind === 'renewal';

        try {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });

            for (const item of lineItems.data) {
                // Handle both expanded object and string ID
                const stripeProductId = typeof item.price?.product === 'string'
                    ? item.price?.product
                    : (item.price?.product as Stripe.Product)?.id;

                console.log(`[Stripe Webhook] Processing Item: ProductID=${stripeProductId}, UserID=${resolvedUserId}`);
                await logEvent('item_processing', `Processing Item ${stripeProductId}`, { product_id: stripeProductId });

                if (!stripeProductId) {
                    await logEvent('warning', 'Item has no Product ID');
                    continue;
                }

                // Claim, record the purchase, grant, settle — per item, via the
                // same path the buyer's checkout return uses. A failure on the
                // third item no longer redoes the first two, and nothing is
                // granted twice. Throws (after recording why) so the delivery
                // fails and Stripe retries; settled items are skipped next time.
                const outcome = await fulfillLineItem(
                    supabase,
                    {
                        lineItemId: item.id,
                        sessionId: session.id,
                        eventId: event.id,
                        userId: resolvedUserId,
                        productId: stripeProductId,
                        amountTotal: item.amount_total,
                        currency: item.currency,
                    },
                    { isRenewal, logFn: logEvent }
                );

                if (outcome === 'already_settled') {
                    await logEvent('info', `Line item ${item.id} already settled`);
                    continue;
                }

                if (outcome === 'in_progress') {
                    // Someone else — a concurrent delivery, or her own checkout
                    // return — is granting this right now. Not ours to do; fail
                    // the delivery so Stripe comes back and finds it settled.
                    throw new Error(`Line item ${item.id} is being fulfilled elsewhere; retry later`);
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

                    if (productTitle) purchasedTitle = productTitle;

                    if (notificationType) {
                        // Verify Profile Exists to avoid FK Constraint Error
                        const { data: profileExists } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('id', resolvedUserId)
                            .single();

                        // If profile missing, fallback to NULL and add note
                        const notificationUserId = profileExists ? resolvedUserId : null;
                        const fallbackMessage = !profileExists ? ` (Profile Missing: ${resolvedUserId})` : "";

                        // One per line item. reference_id is unique across the
                        // table, so it is keyed on the item, not the session:
                        // keyed on the session, every item after the first was
                        // refused. The constraint is also what keeps a replay
                        // from notifying twice.
                        {
                            const { error: notificationError } = await supabase.from('admin_notifications').insert({
                                type: notificationType,
                                title: `New Sale: ${productTitle}`,
                                message: `${customerName} purchased ${productTitle}.${fallbackMessage}`,
                                user_id: notificationUserId,
                                reference_id: `${session.id}:${item.id}`,
                                status: 'unread',
                                metadata: {
                                    original_user_id: resolvedUserId,
                                    customerName,
                                    email: customerEmail,
                                    phone: customerPhone,
                                    amount: item.amount_total ? (item.amount_total / 100).toFixed(2) : '0.00',
                                    currency: item.currency?.toUpperCase() || 'USD',
                                    serviceTitle: productTitle,
                                    serviceImage: productImage,
                                    session_id: session.id,
                                    line_item_id: item.id,
                                }
                            });

                            if (notificationError?.code === '23505') {
                                await logEvent('info', `Admin notification already sent for ${item.id}`);
                            } else if (notificationError) {
                                console.error('[Stripe Webhook] Notification Insert Error:', notificationError);
                                await logEvent('error', `Admin Notification Failed: ${notificationError.message}`);
                            } else {
                                await logEvent('notification', `Admin notification sent for ${productTitle}`);
                            }
                        }
                    }
                } catch (notifyErr) {
                    console.error('[Stripe Webhook] Notification Logic Error:', notifyErr);
                }
            }
            // Whether she still needs a way in, decided from durable state
            // rather than from this delivery.
            //
            // This used to be `if (isNewAccount)`, which broke the moment the
            // line-item loop above started throwing: the first delivery creates
            // the account, fails mid-loop, and the retry then sees an account
            // that already exists — `created: false` — so the welcome email
            // would never be sent at all. She would have access and no way to
            // reach it. 612fed7 moved the email onto the open claim below but
            // left the claim itself behind `isNewAccount`, so the retry still
            // minted none (PAY-002).
            //
            // `needsWayIn` is the durable fact: nobody has ever signed in to
            // this account. The claim is unique on the session, so minting it
            // again on a retry is a no-op, and it is consumed the moment she
            // sets a password by any route. A retry may therefore send a second
            // welcome email, which is a far better failure than sending none.
            if (needsWayIn) {
                // Mint the single-use credential the welcome page's fast lane
                // spends. Keyed to this checkout session and unique on it, so a
                // replayed delivery is a no-op rather than a second live
                // credential.
                const claimed = await createPurchaseClaim(supabase, {
                    userId: resolvedUserId,
                    stripeSessionId: session.id,
                    email: customerEmail,
                });
                if (!claimed) {
                    await logEvent('error', `Could not mint purchase claim for ${customerEmail}`);
                }
            }

            const needsWelcome = await isClaimOpen(supabase, session.id);

            // Only once access is actually granted: an email inviting her in
            // before the grant landed would be a link to a locked Vault.
            if (needsWelcome) {
                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://theacstyle.com';
                const link = await generateSetPasswordLink(
                    supabase,
                    customerEmail,
                    `${siteUrl}/update-password?next=${encodeURIComponent('/vault')}`
                );

                if (link) {
                    // The language she bought in, recorded on the session at
                    // checkout. Falls back to English for anything else,
                    // including sessions created before this was captured.
                    const buyerLocale: EmailLocale =
                        session.metadata?.locale === 'es' ? 'es' : 'en';

                    const { success, error: mailError } = await sendEmail({
                        to: customerEmail,
                        subject: getPurchaseWelcomeSubject(buyerLocale),
                        html: getPurchaseWelcomeHtml(link, purchasedTitle, buyerLocale),
                    });
                    await logEvent(
                        success ? 'notification' : 'error',
                        success
                            ? `Welcome email sent to ${customerEmail}`
                            : `Welcome email FAILED for ${customerEmail}: ${mailError}`
                    );
                } else {
                    // The account and the grant both exist, so this is not worth
                    // a retry of the whole event — it is worth being loud about,
                    // because she cannot get in until someone sends her a link.
                    await logEvent(
                        'error',
                        `Could not generate a set-password link for ${customerEmail}`
                    );
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
