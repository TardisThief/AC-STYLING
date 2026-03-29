'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { deleteAccount } from '@/app/actions/vault/account';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LogOut, Trash2, AlertTriangle, X } from 'lucide-react';

export default function AccountSettings() {
    const [isDeleting, setIsDeleting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.refresh(); // Refresh connection state
        router.push('/login');
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await deleteAccount();
            if (res.success) {
                toast.success("Account deleted successfully.");
                router.push('/'); // Redirect to home/landing
            } else {
                toast.error(res.error || "Failed to delete account.");
                setIsDeleting(false);
                setShowConfirm(false);
            }
        } catch (e) {
            toast.error("An error occurred.");
            setIsDeleting(false);
            setShowConfirm(false);
        }
    };

    return (
        <div className="mt-8 py-8 flex flex-col items-center">
            {/* <h3 className="font-serif text-xl text-ac-taupe mb-6">Account Settings</h3> */}

            <div className="flex flex-col gap-6 items-center">
                <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 bg-ac-taupe text-white px-6 py-3 rounded-sm text-[10px] uppercase tracking-widest font-bold hover:bg-ac-taupe/90 transition-colors shadow-sm"
                >
                    <LogOut size={14} />
                    Sign Out
                </button>

                <div>
                    {!showConfirm ? (
                        <button
                            onClick={() => setShowConfirm(true)}
                            className="flex items-center gap-2 text-red-400 hover:text-red-500 transition-colors text-[10px] uppercase tracking-widest font-bold opacity-60 hover:opacity-100"
                        >
                            <Trash2 size={14} />
                            Delete Account
                        </button>
                    ) : (
                        <div className="bg-red-50 border border-red-100 p-6 rounded-sm max-w-md animate-in fade-in slide-in-from-top-2 text-center">
                            <div className="flex justify-center items-center gap-3 text-red-600 mb-2">
                                <AlertTriangle size={20} />
                                <span className="font-bold uppercase tracking-widest text-xs">Danger Zone</span>
                            </div>
                            <p className="text-sm text-red-800/80 mb-6">
                                This action is permanent. All your data will be lost.
                            </p>

                            <div className="flex justify-center items-center gap-4">
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
                                >
                                    {isDeleting ? "Deleting..." : "Confirm Deletion"}
                                </button>
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    disabled={isDeleting}
                                    className="text-ac-taupe/60 hover:text-ac-taupe underline text-xs"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
