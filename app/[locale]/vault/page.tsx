import { createClient } from "@/utils/supabase/server";
import QuickActions from "@/components/vault/QuickActions";
import SmartRecommendations from "@/components/vault/SmartRecommendations";
import WhatsNew from "@/components/vault/WhatsNew";

export default async function VaultPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch profile
    let fullName = "Guest";
    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();
        if (profile?.full_name) {
            fullName = profile.full_name;
        } else {
            // Fallback to metadata if profile is not yet created/synced
            fullName = user.user_metadata?.full_name || "Style Icon";
        }
    }

    return (
        <div className="flex flex-col gap-10">
            {/* Simple Greeting Header */}
            <div className="fade-in-up">
                <h1 className="font-serif text-3xl md:text-4xl text-ac-taupe">
                    Welcome back, {fullName}
                </h1>
            </div>

            {/* Main Content Grid: WhatsNew (Left) + QuickActions (Right Sidebar) */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
                {/* Main: What's New takes 3 cols */}
                <div className="lg:col-span-3">
                    <WhatsNew />
                </div>

                {/* Sidebar: Quick Actions takes 1 col */}
                <div className="lg:col-span-1">
                    <QuickActions />
                </div>
            </div>

            {/* Footer: Recommendations */}
            <SmartRecommendations hasStartedCourse={true} />
        </div>
    );
}
