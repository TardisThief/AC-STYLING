"use server";

import { stripe } from '@/utils/stripe';
import { createClient } from '@/utils/supabase/server';

async function checkAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { authorized: false };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    return {
        authorized: profile?.role === 'admin'
    };
}

export async function createStripeProduct(name: string, amountInDollars: number, type: 'masterclass' | 'course' | 'chapter' | 'service') {
    const { authorized } = await checkAdmin();
    if (!authorized) {
        return { success: false, error: "Unauthorized" };
    }

    if (!name) return { success: false, error: "Product Name is required" };
    if (!amountInDollars || amountInDollars <= 0) return { success: false, error: "Valid price is required" };

    try {
        // 1. Create Product
        const product = await stripe.products.create({
            name: `AC Styling: ${name}`,
            metadata: {
                type: type,
                generated_by: 'admin_panel'
            }
        });

        // 2. Create Price
        const price = await stripe.prices.create({
            product: product.id,
            unit_amount: Math.round(amountInDollars * 100), // Convert to cents
            currency: 'usd',
        });

        return {
            success: true,
            productId: product.id,
            priceId: price.id
        };
    } catch (error: any) {
        console.error("Stripe Generation Error:", error);
        return { success: false, error: error.message };
    }
}
