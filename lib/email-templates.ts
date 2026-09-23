/**
 * Transactional email templates.
 *
 * Every template here is transactional in the CAN-SPAM sense: each one is sent
 * in response to something the recipient just did (asked to sign in, asked for
 * a password reset, asked a question, completed a purchase). None of them is a
 * commercial message, so none carries an unsubscribe link — offering to
 * unsubscribe from your own password reset would be worse than useless. If a
 * genuine marketing email is ever added it must not reuse these; it needs its
 * own template with a working unsubscribe.
 *
 * They do carry the postal address. CAN-SPAM only requires it of commercial
 * mail, but a real address in the footer is what separates a legitimate
 * transactional email from a phishing attempt in a recipient's eyes, and it is
 * the one thing every deliverability guide agrees on.
 */

import { SITE_URL } from '@/app/lib/site-url';

/** The registered business address, matching the one published in the legal terms. */
const POSTAL_ADDRESS = 'AC Styling &middot; 1865 S Ocean Dr, Hallandale Beach, FL 33009, United States';

/**
 * Shared footer.
 *
 * Styles are inline rather than leaning on each template's `<style>` block:
 * several email clients strip `<head>` styles entirely, and the address is the
 * part that most needs to survive that.
 *
 * `reason` states why this specific message arrived. A recipient who cannot
 * tell why they got an email treats it as spam, and "you received this
 * because..." is the cheapest way to answer that.
 */
export const emailFooter = (reason: string) => `
        <div style="margin-top: 30px; font-family: Arial, sans-serif; font-size: 10px; line-height: 1.6; color: #8C847B; text-align: center;">
            <p style="margin: 0 0 6px 0; font-size: 10px; color: #8C847B;">You received this email because ${reason}.</p>
            <p style="margin: 0 0 6px 0; font-size: 10px; color: #8C847B;">${POSTAL_ADDRESS}</p>
            <p style="margin: 0; font-size: 10px; color: #8C847B;">
                Questions? <a href="mailto:hello@theacstyle.com" style="color: #8C847B;">hello@theacstyle.com</a>
                &nbsp;&middot;&nbsp; &copy; 2026 AC Styling
            </p>
        </div>
`;

export const getMagicLinkHtml = (url: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign in to AC Styling</title>
    <style>
        body { font-family: 'Times New Roman', serif; background-color: #E6DED6; margin: 0; padding: 0; color: #3D3630; }
        .container { max-width: 600px; margin: 0 auto; background-color: #E6DED6; padding: 40px 20px; text-align: center; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 30px; letter-spacing: 1px; color: #3D3630; }
        .content { background-color: #ffffff; padding: 40px; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        h1 { font-size: 20px; font-weight: normal; margin-bottom: 20px; color: #3D3630; text-transform: uppercase; letter-spacing: 2px; }
        p { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #5A4F44; margin-bottom: 30px; }
        .button { display: inline-block; background-color: #3D3630; color: #E6DED6; padding: 15px 30px; text-decoration: none; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; border-radius: 2px; }
        .footer { margin-top: 30px; font-size: 10px; color: #8C847B; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 1px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">AC STYLING</div>
        <div class="content">
            <h1>Your Access Link</h1>
            <p>Welcome back to the Vault. Use the link below to securely sign in to your styling dashboard.</p>
            <a href="${url}" class="button">Enter The Vault</a>
            <p style="margin-top: 30px; font-size: 12px; color: #8C847B;">This link expires in 24 hours.</p>
        </div>
        ${emailFooter('you asked to sign in to AC Styling')}
    </div>
</body>
</html>
`;

export const getPasswordResetHtml = (url: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
        body { font-family: 'Times New Roman', serif; background-color: #E6DED6; margin: 0; padding: 0; color: #3D3630; }
        .container { max-width: 600px; margin: 0 auto; background-color: #E6DED6; padding: 40px 20px; text-align: center; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 30px; letter-spacing: 1px; color: #3D3630; }
        .content { background-color: #ffffff; padding: 40px; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        h1 { font-size: 20px; font-weight: normal; margin-bottom: 20px; color: #3D3630; text-transform: uppercase; letter-spacing: 2px; }
        p { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #5A4F44; margin-bottom: 30px; }
        .button { display: inline-block; background-color: #3D3630; color: #E6DED6; padding: 15px 30px; text-decoration: none; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; border-radius: 2px; }
        .footer { margin-top: 30px; font-size: 10px; color: #8C847B; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 1px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">AC STYLING</div>
        <div class="content">
            <h1>Reset Password</h1>
            <p>We received a request to reset your password. Click the button below to choose a new one.</p>
            <a href="${url}" class="button">Reset Password</a>
            <p style="margin-top: 30px; font-size: 12px; color: #8C847B;">If you didn't request this, you can safely ignore this email.</p>
        </div>
        ${emailFooter('you asked to reset your AC Styling password')}
    </div>
</body>
</html>
`;

/**
 * Escape user-supplied text before interpolating it into email HTML, to prevent
 * HTML/markup injection into transactional emails.
 */
export const escapeHtml = (value: string): string =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

export const getAnswerNotificationHtml = (question: string, answer: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You Have an Answer - AC Styling</title>
    <style>
        body { font-family: 'Times New Roman', serif; background-color: #E6DED6; margin: 0; padding: 0; color: #3D3630; }
        .container { max-width: 600px; margin: 0 auto; background-color: #E6DED6; padding: 40px 20px; text-align: center; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 30px; letter-spacing: 1px; color: #3D3630; }
        .content { background-color: #ffffff; padding: 40px; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); text-align: left; }
        h1 { font-size: 20px; font-weight: normal; margin-bottom: 20px; color: #3D3630; text-transform: uppercase; letter-spacing: 2px; text-align: center;}
        .message-box { background-color: #F8F5F2; border-left: 2px solid #C4A484; padding: 20px; margin-bottom: 24px; }
        p { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #5A4F44; margin: 0 0 16px 0; }
        .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #8C847B; margin-bottom: 4px; display: block; font-weight: bold; }
        .button { display: inline-block; background-color: #3D3630; color: #E6DED6; padding: 15px 30px; text-decoration: none; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; border-radius: 2px; text-align: center; display: block; margin: 30px auto 0; width: fit-content; }
        .footer { margin-top: 30px; font-size: 10px; color: #8C847B; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 1px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">AC STYLING</div>
        <div class="content">
            <h1>Expert Answer Received</h1>
            <p>Your question has been answered by the AC Styling team.</p>
            
            <div class="message-box">
                <span class="label">Your Question</span>
                <p style="font-style: italic;">"${escapeHtml(question)}"</p>
            </div>

            <div class="message-box" style="border-left-color: #3D3630; background-color: #E6DED6;">
                <span class="label">Alejandra's Answer</span>
                <p>${escapeHtml(answer)}</p>
            </div>

            <a href="${SITE_URL}/vault" class="button">Go to Vault</a>
        </div>
        ${emailFooter('you asked Alejandra a question in the Vault')}
    </div>
</body>
</html>
`;

/** The two locales the site ships. Anything else falls back to English. */
export type EmailLocale = 'en' | 'es';

/**
 * Copy for the purchase welcome email.
 *
 * Kept here rather than in `messages/*.json` because these templates are
 * plain HTML strings assembled outside React, with no next-intl provider to
 * read from. The catalogue is small and self-contained; the important thing is
 * that a Spanish buyer stops receiving an English email at the one moment she
 * is being asked to set a password.
 */
const purchaseWelcomeCopy: Record<EmailLocale, {
    subject: string;
    heading: string;
    confirmed: (product: string) => string;
    choosePassword: string;
    cta: string;
    disclaimer: string;
    footerReason: string;
}> = {
    en: {
        subject: 'Your AC Styling Vault access',
        heading: 'Your access is ready',
        confirmed: (product) =>
            `Thank you for joining the Vault. Your purchase of <strong>${product}</strong> is confirmed and already attached to your account.`,
        choosePassword: 'Choose a password to get in. The link works once.',
        cta: 'Set your password',
        disclaimer: 'If you did not make this purchase, reply to this email and we will sort it out.',
        footerReason: 'you completed a purchase at AC Styling',
    },
    es: {
        subject: 'Tu acceso al Vault de AC Styling',
        heading: 'Tu acceso está listo',
        confirmed: (product) =>
            `Gracias por unirte al Vault. Tu compra de <strong>${product}</strong> está confirmada y ya vinculada a tu cuenta.`,
        choosePassword: 'Elige una contraseña para entrar. El enlace funciona una sola vez.',
        cta: 'Definir tu contraseña',
        disclaimer: 'Si no hiciste esta compra, responde a este correo y lo resolvemos.',
        footerReason: 'completaste una compra en AC Styling',
    },
};

/** The subject line for the purchase welcome email, in the buyer's language. */
export const getPurchaseWelcomeSubject = (locale: EmailLocale = 'en') =>
    purchaseWelcomeCopy[locale]?.subject ?? purchaseWelcomeCopy.en.subject;

/**
 * Sent to someone who bought from the public sales page before having an
 * account. She has already paid, so this is not a sales email — it is the one
 * step between her and the thing she bought.
 */
export const getPurchaseWelcomeHtml = (
    url: string,
    productTitle: string,
    locale: EmailLocale = 'en'
) => {
    const copy = purchaseWelcomeCopy[locale] ?? purchaseWelcomeCopy.en;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${copy.subject}</title>
    <style>
        body { font-family: 'Times New Roman', serif; background-color: #E6DED6; margin: 0; padding: 0; color: #3D3630; }
        .container { max-width: 600px; margin: 0 auto; background-color: #E6DED6; padding: 40px 20px; text-align: center; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 30px; letter-spacing: 1px; color: #3D3630; }
        .content { background-color: #ffffff; padding: 40px; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        h1 { font-size: 20px; font-weight: normal; margin-bottom: 20px; color: #3D3630; text-transform: uppercase; letter-spacing: 2px; }
        p { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #5A4F44; margin-bottom: 30px; }
        .button { display: inline-block; background-color: #3D3630; color: #E6DED6; padding: 15px 30px; text-decoration: none; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; border-radius: 2px; }
        .footer { font-family: Arial, sans-serif; font-size: 11px; color: #8C847B; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">AC STYLING</div>
        <div class="content">
            <h1>${copy.heading}</h1>
            <p>${copy.confirmed(escapeHtml(productTitle))}</p>
            <p>${copy.choosePassword}</p>
            <a href="${url}" class="button">${copy.cta}</a>
            <p class="footer">${copy.disclaimer}</p>
        </div>
        ${emailFooter(copy.footerReason)}
    </div>
</body>
</html>
`;
};
