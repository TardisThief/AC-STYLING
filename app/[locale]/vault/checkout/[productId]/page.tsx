'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { purchaseProduct } from '@/app/actions/commerce';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ShieldCheck, CreditCard, Lock, ArrowRight, Loader2 } from 'lucide-react';

export default function CheckoutPage({ params }: { params: { productId: string } }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { productId } = params;

    // Mock Product Data
    const getProductDetails = (id: string) => {
        const products: any = {
            'style-audit': { title: 'The Style Audit', price: '$199', description: 'Comprehensive wardrobe analysis.' },
            'foundations': { title: 'Style Foundations', price: '$299', description: 'Building your core aesthetic.' },
            'color-theory': { title: 'Color Theory', price: '$149', description: 'Mastering your personal palette.' },
            'silhouette': { title: 'Silhouette & Shape', price: '$149', description: 'Dressing for your body type.' },
            'capsule': { title: 'Capsule Wardrobe', price: '$249', description: 'Creating a versatile collection.' },
            'shopping': { title: 'Strategic Shopping', price: '$199', description: 'Buying less, but better.' }
        };
        return products[id] || { title: 'Premium Masterclass', price: '$199', description: 'Exclusive content.' };
    };

    const product = getProductDetails(productId);

    const handlePurchase = async () => {
        setLoading(true);
        try {
            const result = await purchaseProduct(productId);
            if (result.success) {
                toast.success('Purchase successful! Unlocking content...');
                router.refresh(); // Refresh server data
                setTimeout(() => {
                    router.push('/vault/gallery');
                }, 1000);
            } else {
                toast.error(result.message || 'Payment failed. Please try again.');
            }
        } catch (error) {
            toast.error('An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-ac-sand flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl rounded-sm overflow-hidden"
            >
                {/* Header */}
                <div className="bg-ac-taupe text-white p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <ShieldCheck size={120} />
                    </div>
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-60 mb-2">Secure Checkout</p>
                    <h1 className="font-serif text-3xl">{product.title}</h1>
                    <p className="font-sans text-2xl mt-4 font-bold text-ac-gold">{product.price}</p>
                </div>

                {/* Body */}
                <div className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-ac-taupe/40 font-bold">Order Summary</label>
                        <div className="bg-white/40 p-4 rounded-sm border border-ac-taupe/10 flex justify-between items-center">
                            <span className="text-sm text-ac-taupe">{product.title}</span>
                            <span className="text-sm font-bold text-ac-taupe">{product.price}</span>
                        </div>
                        <p className="text-xs text-ac-taupe/60 italic px-2">{product.description}</p>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-ac-taupe/10">
                        <div className="flex items-center gap-3 p-3 bg-ac-taupe/5 rounded-sm border border-ac-taupe/10 opacity-60">
                            <CreditCard size={20} className="text-ac-taupe/40" />
                            <div className="flex-1">
                                <p className="text-xs font-bold text-ac-taupe/60">•••• •••• •••• 4242</p>
                            </div>
                            <Lock size={14} className="text-ac-taupe/40" />
                        </div>

                        <button
                            onClick={handlePurchase}
                            disabled={loading}
                            className="w-full bg-ac-gold text-white py-4 rounded-sm font-bold uppercase tracking-widest text-xs hover:bg-ac-taupe transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin" size={16} /> : (
                                <>
                                    Complete Purchase
                                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>

                    <p className="text-[10px] text-center text-ac-taupe/30">
                        By confirming, you agree to our Terms of Service. <br />
                        This is a secure 256-bit SSL encrypted transaction.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
