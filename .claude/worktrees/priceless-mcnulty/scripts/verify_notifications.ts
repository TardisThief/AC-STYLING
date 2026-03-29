
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkNotifications() {
    console.log('Checking recent admin notifications...');
    const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching notifications:', error);
        return;
    }

    console.log('Found notifications:', data.length);
    data.forEach((n) => {
        console.log(`[${n.type}] ${n.title} - Status: ${n.status}`);
        console.log(`   Message: ${n.message}`);
        console.log('---');
    });
}

checkNotifications();
