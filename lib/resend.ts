import { Resend } from 'resend';
import { htmlToText } from './html-to-text';

const resend = new Resend(process.env.RESEND_API_KEY);

/*
 * There is deliberately no Reply-To header.
 *
 * Pointing it at the brand's Gmail address cost 2.503 spam points on
 * mail-tester (FREEMAIL_FORGED_REPLYTO) — a Reply-To on a freemail domain that
 * does not match the From domain is a textbook phishing signature, and filters
 * score it accordingly. Dropping it took the same message from 7.6/10 to a
 * clean run.
 *
 * With no Reply-To, replies go to the From address, hello@theacstyle.com.
 * That mailbox needs to actually deliver somewhere — see docs/OWNER-ACTIONS.md.
 * A Reply-To may come back only if it is on theacstyle.com itself.
 */


export const sendEmail = async ({
    to,
    subject,
    html,
    text,
}: {
    to: string;
    subject: string;
    html: string;
    /** Overrides the derived plain-text part; rarely needed. */
    text?: string;
}) => {
    console.log('[Resend] Attempting to send email...');
    console.log('[Resend] To:', to);
    console.log('[Resend] Subject:', subject);

    if (!process.env.RESEND_API_KEY) {
        console.warn('[Resend] RESEND_API_KEY is not set. Email not sent.');
        return { success: false, error: 'Configuration Error: RESEND_API_KEY missing' };
    }

    try {
        // The SDK does not throw when Resend refuses a message (bad address,
        // unverified domain, rate limit, revoked key): it resolves with
        // `{ data: null, error }`. Only checking for a throw reported every
        // refusal as sent — see tests/unit/resend-result.test.ts.
        const { data, error } = await resend.emails.send({
            from: 'AC Styling <hello@theacstyle.com>',
            to,
            subject,
            html,
            // multipart/alternative rather than HTML-only: see htmlToText above.
            text: text ?? htmlToText(html),
        });
        if (error || !data?.id) {
            const message = error?.message ?? 'Resend accepted no message';
            console.error('[Resend] Refused:', error?.name ?? 'unknown', message);
            return { success: false, error: message };
        }
        console.log('[Resend] Accepted:', data.id);
        return { success: true, data };
    } catch (error) {
        console.error('[Resend] Failed to send email:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
};

export { htmlToText };
