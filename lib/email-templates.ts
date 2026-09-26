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

/** The two locales the site ships. Anything else falls back to English. */
export type EmailLocale = 'en' | 'es';

/** A value that may be any string, narrowed to a locale we ship. */
export const emailLocale = (value: string | null | undefined): EmailLocale => (value === 'es' ? 'es' : 'en');

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
const footerCopy: Record<EmailLocale, { because: (reason: string) => string; questions: string }> = {
    en: { because: (reason) => `You received this email because ${reason}.`, questions: 'Questions?' },
    es: { because: (reason) => `Recibiste este correo porque ${reason}.`, questions: '¿Preguntas?' },
};

export const emailFooter = (reason: string, locale: EmailLocale = 'en') => {
    const copy = footerCopy[locale] ?? footerCopy.en;
    return `
        <div style="margin-top: 30px; font-family: Arial, sans-serif; font-size: 10px; line-height: 1.6; color: #8C847B; text-align: center;">
            <p style="margin: 0 0 6px 0; font-size: 10px; color: #8C847B;">${copy.because(reason)}</p>
            <p style="margin: 0 0 6px 0; font-size: 10px; color: #8C847B;">${POSTAL_ADDRESS}</p>
            <p style="margin: 0; font-size: 10px; color: #8C847B;">
                ${copy.questions} <a href="mailto:hello@theacstyle.com" style="color: #8C847B;">hello@theacstyle.com</a>
                &nbsp;&middot;&nbsp; &copy; 2026 AC Styling
            </p>
        </div>
`;
};

/**
 * Copy for the three emails an auth action sends: signing in, a new account,
 * and a password reset. In both locales, because a Spanish reader used to get
 * every one of them in English — and the signup email reused the sign-in copy
 * ("Welcome back"), which greeted a brand-new member as a returning one
 * (I18N-001, 2026-09-25 external assessment).
 *
 * Kept here, not in messages/*.json, for the same reason as the purchase
 * welcome below: these are HTML strings built outside React.
 */
export type AuthEmailKind = 'signin' | 'signup' | 'reset';

const authEmailCopy: Record<AuthEmailKind, Record<EmailLocale, {
    subject: string;
    heading: string;
    body: string;
    cta: string;
    note: string;
    footerReason: string;
}>> = {
    signin: {
        en: {
            subject: 'Sign in to AC Styling',
            heading: 'Your Access Link',
            body: 'Welcome back to the Vault. Use the link below to securely sign in to your styling dashboard.',
            cta: 'Enter The Vault',
            note: 'This link expires in 24 hours.',
            footerReason: 'you asked to sign in to AC Styling',
        },
        es: {
            subject: 'Inicia sesión en AC Styling',
            heading: 'Tu enlace de acceso',
            body: 'Bienvenida de nuevo al Vault. Usa el enlace de abajo para entrar de forma segura a tu espacio de estilo.',
            cta: 'Entrar al Vault',
            note: 'Este enlace caduca en 24 horas.',
            footerReason: 'pediste iniciar sesión en AC Styling',
        },
    },
    signup: {
        en: {
            subject: 'Welcome to AC Styling - confirm your email',
            heading: 'Welcome to the Vault',
            body: 'Confirm your email address to finish creating your account.',
            cta: 'Confirm and enter',
            note: 'This link expires in 24 hours. If you did not sign up, you can ignore this email.',
            footerReason: 'someone created an AC Styling account with this address',
        },
        es: {
            subject: 'Bienvenida a AC Styling: confirma tu correo',
            heading: 'Bienvenida al Vault',
            body: 'Confirma tu correo electrónico para terminar de crear tu cuenta.',
            cta: 'Confirmar y entrar',
            note: 'Este enlace caduca en 24 horas. Si no te registraste, puedes ignorar este correo.',
            footerReason: 'alguien creó una cuenta de AC Styling con esta dirección',
        },
    },
    reset: {
        en: {
            subject: 'Reset your AC Styling password',
            heading: 'Reset Password',
            body: 'We received a request to reset your password. Click the button below to choose a new one.',
            cta: 'Reset Password',
            note: "If you didn't request this, you can safely ignore this email.",
            footerReason: 'you asked to reset your AC Styling password',
        },
        es: {
            subject: 'Restablece tu contraseña de AC Styling',
            heading: 'Restablecer contraseña',
            body: 'Recibimos una solicitud para restablecer tu contraseña. Pulsa el botón de abajo para elegir una nueva.',
            cta: 'Restablecer contraseña',
            note: 'Si no lo pediste, puedes ignorar este correo sin problema.',
            footerReason: 'pediste restablecer tu contraseña de AC Styling',
        },
    },
};

/** The subject line for an auth email, in the reader's language. */
export const getAuthEmailSubject = (kind: AuthEmailKind, locale: EmailLocale = 'en') =>
    (authEmailCopy[kind][locale] ?? authEmailCopy[kind].en).subject;

const authEmailHtml = (kind: AuthEmailKind, url: string, locale: EmailLocale) => {
    const copy = authEmailCopy[kind][locale] ?? authEmailCopy[kind].en;
    return `
<!DOCTYPE html>
<html lang="${locale}">
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
        .footer { margin-top: 30px; font-size: 10px; color: #8C847B; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 1px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">AC STYLING</div>
        <div class="content">
            <h1>${copy.heading}</h1>
            <p>${copy.body}</p>
            <a href="${url}" class="button">${copy.cta}</a>
            <p style="margin-top: 30px; font-size: 12px; color: #8C847B;">${copy.note}</p>
        </div>
        ${emailFooter(copy.footerReason, locale)}
    </div>
</body>
</html>
`;
};

export const getMagicLinkHtml = (url: string, locale: EmailLocale = 'en') => authEmailHtml('signin', url, locale);

/** A new account's confirmation. It used to reuse the sign-in email's "Welcome back". */
export const getSignupConfirmHtml = (url: string, locale: EmailLocale = 'en') => authEmailHtml('signup', url, locale);

export const getPasswordResetHtml = (url: string, locale: EmailLocale = 'en') => authEmailHtml('reset', url, locale);

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

const answerCopy: Record<EmailLocale, {
    subject: string;
    heading: string;
    intro: string;
    yourQuestion: string;
    theAnswer: string;
    cta: string;
    footerReason: string;
}> = {
    en: {
        subject: 'Answer to your question - AC Styling',
        heading: 'Expert Answer Received',
        intro: 'Your question has been answered by the AC Styling team.',
        yourQuestion: 'Your Question',
        theAnswer: "Alejandra's Answer",
        cta: 'Go to Vault',
        footerReason: 'you asked Alejandra a question in the Vault',
    },
    es: {
        subject: 'Respuesta a tu pregunta - AC Styling',
        heading: 'Tienes una respuesta',
        intro: 'El equipo de AC Styling ha respondido a tu pregunta.',
        yourQuestion: 'Tu pregunta',
        theAnswer: 'La respuesta de Alejandra',
        cta: 'Ir al Vault',
        footerReason: 'le hiciste una pregunta a Alejandra en el Vault',
    },
};

/** The subject line for the answer notification, in the member's language. */
export const getAnswerNotificationSubject = (locale: EmailLocale = 'en') =>
    (answerCopy[locale] ?? answerCopy.en).subject;

export const getAnswerNotificationHtml = (question: string, answer: string, locale: EmailLocale = 'en') => {
    const copy = answerCopy[locale] ?? answerCopy.en;
    return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${copy.subject}</title>
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
            <h1>${copy.heading}</h1>
            <p>${copy.intro}</p>

            <div class="message-box">
                <span class="label">${copy.yourQuestion}</span>
                <p style="font-style: italic;">"${escapeHtml(question)}"</p>
            </div>

            <div class="message-box" style="border-left-color: #3D3630; background-color: #E6DED6;">
                <span class="label">${copy.theAnswer}</span>
                <p>${escapeHtml(answer)}</p>
            </div>

            <a href="${SITE_URL}/${locale}/vault" class="button">${copy.cta}</a>
        </div>
        ${emailFooter(copy.footerReason, locale)}
    </div>
</body>
</html>
`;
};

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
<html lang="${locale}">
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
        ${emailFooter(copy.footerReason, locale)}
    </div>
</body>
</html>
`;
};
