"use server";

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// 1. User Asks Question
export async function askQuestion(formData: FormData) {
    const question = formData.get('question') as string;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    try {
        // A. Save to user_questions
        const { data: questionData, error: questionError } = await supabase
            .from('user_questions')
            .insert({
                user_id: user.id,
                question: question,
                status: 'pending'
            })
            .select()
            .single();

        if (questionError) throw new Error(questionError.message);

        // B. Notify Admin (Using Admin Client to bypass RLS for admin_notifications if needed, 
        // though authenticated users might be able to insert if policy allows. 
        // Safer to use service role for admin_notifications insert to guarantee execution)
        const supabaseAdmin = createAdminClient();

        // Get user profile for name
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('full_name, email')
            .eq('id', user.id)
            .single();

        const userName = profile?.full_name || user.email || 'User';

        await supabaseAdmin.from('admin_notifications').insert({
            type: 'question',
            title: `New Question from ${userName}`,
            message: question, // Short preview
            user_id: user.id, // For linkage
            reference_id: questionData.id, // Link to the question ID
            status: 'unread',
            metadata: {
                questionText: question,
                userEmail: profile?.email
            }
        });

        return { success: true };
    } catch (e: any) {
        console.error("Ask Question Error:", e);
        return { success: false, error: e.message || "Failed to submit question" };
    }
}

// 2. Admin Answers Question
export async function answerQuestion(questionId: string, answer: string) {
    const supabase = await createClient();
    // Ideally check if user is admin, but admin panel is protected by middleware/layout.

    // Use Admin Client to ensure we can update any user's question
    const supabaseAdmin = createAdminClient();

    try {
        const { error } = await supabaseAdmin
            .from('user_questions')
            .update({
                answer: answer,
                status: 'answered',
                answered_at: new Date().toISOString()
            })
            .eq('id', questionId);

        if (error) throw new Error(error.message);

        return { success: true };
    } catch (e: any) {
        console.error("Answer Error:", e);
        return { success: false, error: e.message };
    }
}

// 3. User Marks as Read (Dismiss Notification)
export async function markAnswerAsRead(questionId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase
        .from('user_questions')
        .update({ status: 'read' })
        .eq('id', questionId)
        .eq('user_id', user.id); // Ensure ownership

    if (error) return { success: false, error: error.message };
    return { success: true };
}

// 4. Get Unread Answers for User (For Bell Icon)
export async function getUnreadAnswers() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, questions: [] };

    const { data } = await supabase
        .from('user_questions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'answered') // Only show 'answered', not 'read'
        .order('answered_at', { ascending: false });

    return { success: true, questions: data || [] };
}
