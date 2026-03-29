
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function injectTestNotification() {
    console.log('Injecting test Sales notification...');

    // Get a user
    const { data: user } = await supabase.from('profiles').select('id').limit(1).single();
    const userId = user?.id || null;

    const { error } = await supabase.from('admin_notifications').insert({
        type: 'masterclass_purchase',
        title: 'New Sale: Style DNA Masterclass',
        message: 'Test User purchased Style DNA Masterclass (Manual Verification)',
        user_id: userId,
        status: 'unread',
        metadata: {
            amount: '97.00',
            currency: 'USD',
            serviceTitle: 'Style DNA Masterclass',
            email: 'test@example.com'
        }
    });

    if (error) console.error('Error:', error);
    else console.log('Success! Check the "Sales" tab in Admin Panel.');
}

injectTestNotification();
