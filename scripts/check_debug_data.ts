
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log('--- Checking Services Table ---');
    const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('id, title, price_id, stripe_product_id, active');

    if (servicesError) {
        console.error('Error fetching services:', servicesError);
    } else {
        // Log as JSON to see full field values
        console.log(JSON.stringify(services?.map(s => ({
            title: s.title,
            price_id: s.price_id,
            stripe_product_id: s.stripe_product_id,
            active: s.active
        })), null, 2));
    }

    console.log('\n--- Checking Recent Wardrobe Items (Inbox) ---');
    const { data: items, error: itemsError } = await supabase
        .from('wardrobe_items')
        .select('id, status, client_note, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (itemsError) {
        console.error('Error fetching wardrobe items:', itemsError);
    } else {
        console.table(items);
    }

    console.log('\n--- Checking Webhook Logs ---');
    const { data: logs, error: logsError } = await supabase
        .from('webhook_events')
        .select('id, event_type, status, error_message')
        // .order('created_at', { ascending: false }) // created_at might be missing
        .limit(5);

    if (logsError) {
        console.log('Could not fetch webhook_events (table might not exist):', logsError.message);
    } else {
        console.table(logs);
    }
}

main();
