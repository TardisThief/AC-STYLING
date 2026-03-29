
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log('--- Checking Price Configurations ---');

    // Fetch Tables
    const { data: offers } = await supabase.from('offers').select('id, slug, stripe_product_id, price_id, active');
    const { data: mcs } = await supabase.from('masterclasses').select('id, title, stripe_product_id, price_id');
    const { data: chapters } = await supabase.from('chapters').select('id, title, stripe_product_id, price_id');

    // Log Data
    console.log(`\n--- Offers ---`);
    offers?.forEach(o => console.log(`[Offer] ${o.slug}: \n    Product: ${o.stripe_product_id}\n    Price: ${o.price_id}`));

    console.log(`\n--- Masterclasses ---`);
    mcs?.forEach(mc => console.log(`[Masterclass] ${mc.title}: \n    Product: ${mc.stripe_product_id}\n    Price:   ${mc.price_id}`));

    console.log(`\n--- Chapters ---`);
    chapters?.forEach(ch => console.log(`[Chapter] ${ch.title}: \n    Product: ${ch.stripe_product_id}\n    Price: ${ch.price_id}`));

    console.log(`\n--- Potential Misconfiguration Check ---`);
    // If a Masterclass has a Price ID that is NOT associated with its Product ID in Stripe...
    // We can't check Stripe API here (no secret key loaded for Stripe client in this script directly? 
    // We have STRIPE_SECRET_KEY in env, we could use stripe client).

    if (process.env.STRIPE_SECRET_KEY) {
        console.log('Stripe Key found. Verifying against Stripe API...');
        const Stripe = require('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' }); // Use version roughly matching project

        // Check one masterclass as example
        if (mcs && mcs.length > 0) {
            const mc = mcs[0];
            if (mc.price_id) {
                try {
                    const price = await stripe.prices.retrieve(mc.price_id);
                    console.log(`\n[Checking Stripe] Masterclass "${mc.title}"`);
                    console.log(`  DB Product ID: ${mc.stripe_product_id}`);
                    console.log(`  DB Price ID:   ${mc.price_id}`);
                    console.log(`  Stripe Price points to Product: ${price.product}`);

                    if (price.product !== mc.stripe_product_id) {
                        console.error(`  [!!!] MISMATCH: Stripe Price ${mc.price_id} is linked to Product ${price.product}, but DB expects ${mc.stripe_product_id}`);
                        if (offers?.some(o => o.stripe_product_id === price.product)) {
                            console.error('  [!!!] AND that Product ID belongs to an OFFER!');
                            console.error('  ROOT CAUSE FOUND: The Price used for Masterclass is actually for the Offer.');
                        }
                    } else {
                        console.log('  match verified.');
                    }

                } catch (e: any) {
                    console.error('  Stripe API Error:', e.message);
                }
            }
        }
    } else {
        console.log('No STRIPE_SECRET_KEY. Cannot verify against Stripe API.');
    }
}

main().catch(console.error);
