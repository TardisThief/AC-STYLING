import { Resend } from 'resend';
import { htmlToText } from './html-to-text';

const resend = new Resend(process.env.RESEND_API_KEY);

/** Where replies should go. The sending address is not a monitored inbox. */
const REPLY_TO = 'fashionstylist.ac@gmail.com';


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
        const data = await resend.emails.send({
            from: 'AC Styling <hello@theacstyle.com>',
            to,
            subject,
            html,
            // multipart/alternative rather than HTML-only: see htmlToText above.
            text: text ?? htmlToText(html),
            // The from address is unmonitored; replies belong in the real inbox.
            replyTo: REPLY_TO,
        });
        console.log('[Resend] Success:', data);
        return { success: true, data };
    } catch (error) {
        console.error('[Resend] Failed to send email:', error);
        return { success: false, error };
    }
};

export { htmlToText };
