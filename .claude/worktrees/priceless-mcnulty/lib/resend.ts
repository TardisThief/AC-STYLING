import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async ({
    to,
    subject,
    html,
}: {
    to: string;
    subject: string;
    html: string;
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
        });
        console.log('[Resend] Success:', data);
        return { success: true, data };
    } catch (error) {
        console.error('[Resend] Failed to send email:', error);
        return { success: false, error };
    }
};
