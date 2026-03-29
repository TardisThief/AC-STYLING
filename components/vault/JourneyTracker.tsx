import { JourneyStats } from "@/app/actions/vault/journey";
import { BookOpen, Sparkles, Trophy, Calendar } from "lucide-react";

export default function JourneyTracker({ stats }: { stats: JourneyStats }) {
    const memberSince = stats.memberSince
        ? new Date(stats.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : null;

    const masterclassLabel = stats.hasFullAccess
        ? `Full Vault`
        : `${stats.masterclassesAccessCount} of ${stats.totalMasterclasses}`;

    return (
        <div className="mt-8 mb-4">
            <p className="text-[10px] uppercase tracking-widest text-ac-taupe/40 font-bold mb-4">Your Journey</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {memberSince && (
                    <div className="bg-white/40 backdrop-blur-sm border border-white/50 rounded-sm p-4 text-center">
                        <Calendar size={18} className="mx-auto text-ac-taupe/30 mb-2" />
                        <div className="font-serif text-sm text-ac-taupe">{memberSince}</div>
                        <div className="text-[9px] uppercase tracking-widest text-ac-taupe/40 mt-1">Member Since</div>
                    </div>
                )}
                <div className="bg-white/40 backdrop-blur-sm border border-white/50 rounded-sm p-4 text-center">
                    <BookOpen size={18} className="mx-auto text-ac-taupe/30 mb-2" />
                    <div className="font-serif text-sm text-ac-taupe">{masterclassLabel}</div>
                    <div className="text-[9px] uppercase tracking-widest text-ac-taupe/40 mt-1">Masterclasses</div>
                </div>
                <div className="bg-white/40 backdrop-blur-sm border border-white/50 rounded-sm p-4 text-center">
                    <Sparkles size={18} className="mx-auto text-ac-gold/60 mb-2" />
                    <div className="font-serif text-sm text-ac-taupe">{stats.essenceLabsCompleted}</div>
                    <div className="text-[9px] uppercase tracking-widest text-ac-taupe/40 mt-1">Labs Completed</div>
                </div>
                {stats.coursesAccessCount > 0 && (
                    <div className="bg-white/40 backdrop-blur-sm border border-white/50 rounded-sm p-4 text-center">
                        <Trophy size={18} className="mx-auto text-ac-olive/60 mb-2" />
                        <div className="font-serif text-sm text-ac-taupe">{stats.coursesAccessCount}</div>
                        <div className="text-[9px] uppercase tracking-widest text-ac-taupe/40 mt-1">Courses</div>
                    </div>
                )}
            </div>
        </div>
    );
}
