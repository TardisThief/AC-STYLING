"use server";

import { Resend } from 'resend';
import { createClient } from '@/utils/supabase/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendQuestion(formData: FormData) {
    const question = formData.get('question') as string;

    // Get User Context
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    // Fetch Profile for Name & Context
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, style_essentials')
        .eq('id', user.id)
        .single();

    const userName = profile?.full_name || user.email; // Fallback to email if name missing
    const userEmail = user.email || 'noreply@ac-styling.com'; // Should always exist for auth user
    const essentials = profile?.style_essentials || {};

    // Format Context
    const contextHtml = `
        <div style="background: #f4f4f4; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #7F8968;">Styling Essence Context</h3>
            <p><strong>Name:</strong> ${userName}</p>
            <p><strong>Email:</strong> ${userEmail}</p>
            <p><strong>Style Words:</strong> ${essentials.style_words || 'Not set'}</p>
            <p><strong>Style Mood:</strong> ${essentials.style_mood || 'Not set'}</p>
             <p><strong>Power Color:</strong> ${essentials.power_color || 'Not set'}</p>
        </div>
    `;

    try {
        const { data, error } = await resend.emails.send({
            from: 'AC Styling Lab <onboarding@resend.dev>',
            to: ['magomezf94@gmail.com'],
            replyTo: userEmail, // Valid Reply-To
            subject: `[Vault Question] - ${userName}`,
            html: `
                <div style="font-family: sans-serif; color: #333;">
                    <h1>New Question from ${userName}</h1>
                    ${contextHtml}
                    <div style="border-left: 4px solid #D4AF37; padding-left: 15px;">
                        <p style="font-size: 16px; line-height: 1.5;">${question}</p>
                    </div>
                </div>
            `
        });

        if (error) {
            console.error("Resend Error:", error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (e) {
        console.error("Server Error:", e);
        return { success: false, error: "Failed to send email" };
    }
}
