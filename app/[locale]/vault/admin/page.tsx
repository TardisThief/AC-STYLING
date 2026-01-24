import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin/AdminDashboard";

export default async function AdminPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Check admin role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        redirect('/vault');
    }

    return (
        <div className="min-h-screen py-12">
            <div className="container mx-auto px-6">
                <div className="mb-8">
                    <h1 className="font-serif text-4xl text-ac-taupe mb-2">Content Manager</h1>
                    <p className="text-ac-taupe/60">Manage Masterclass chapters and resources</p>
                </div>

                <AdminDashboard />
            </div>
        </div>
    );
}
