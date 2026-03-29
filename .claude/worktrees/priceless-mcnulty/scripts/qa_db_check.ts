
import { Client } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing');
    process.exit(1);
}

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runQualityCheck() {
    try {
        await client.connect();
        console.log('Connected to database.');

        // 1. Check Table Existence
        console.log('Checking tables...');
        const tableCheck = await client.query(`
            SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_questions') as "questions_exist",
                   EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admin_notifications') as "notifs_exist";
        `);
        console.log('Tables exist:', tableCheck.rows[0]);

        if (!tableCheck.rows[0].questions_exist) throw new Error("user_questions table missing!");

        // 2. Identify a test user (or just use the first profile found)
        const userRes = await client.query('SELECT id, email, full_name FROM profiles LIMIT 1');
        if (userRes.rows.length === 0) {
            console.log('No profiles found, skipping logic test.');
            return;
        }
        const user = userRes.rows[0];
        console.log(`Using test user: ${user.email} (${user.id})`);

        // 3. Simulate "Ask Question"
        console.log('Simulating Ask Question...');
        const questionText = `QA Check ${Date.now()}`;
        const insertQ = await client.query(`
            INSERT INTO user_questions (user_id, question, status)
            VALUES ($1, $2, 'pending')
            RETURNING id;
        `, [user.id, questionText]);
        const questionId = insertQ.rows[0].id;
        console.log(`Question inserted. ID: ${questionId}`);

        // 4. Verify Admin Notification Creation (This logic is usually in the server action, 
        // effectively tested by checking if the implementation code would trigger it. 
        // Here we simulate the *result* to ensure DB relation holds true).
        // Standard code flow: sending question -> inserts question -> inserts notification.
        // Let's manually insert the notification to verify FK/Types don't crash.

        console.log('Simulating Admin Notification trigger...');
        const insertNotif = await client.query(`
            INSERT INTO admin_notifications (type, title, message, user_id, reference_id, status)
            VALUES ('question', 'New Question', $1, $2, $3, 'unread')
            RETURNING id;
        `, [questionText, user.id, questionId]);
        console.log(`Notification inserted. ID: ${insertNotif.rows[0].id}`);

        // 5. Simulate Admin Reply
        console.log('Simulating Admin Reply...');
        const replyText = "This is a robust answer.";
        await client.query(`
            UPDATE user_questions
            SET answer = $1, status = 'answered', answered_at = NOW()
            WHERE id = $2;
        `, [replyText, questionId]);
        console.log('Question updated with answer.');

        // 6. Check Unread Answers View
        const unreadCheck = await client.query(`
            SELECT * FROM user_questions 
            WHERE user_id = $1 AND status = 'answered';
        `, [user.id]);

        const found = unreadCheck.rows.find(r => r.id === questionId);
        if (found) {
            console.log('SUCCESS: Question retrieval verified.');
        } else {
            console.error('FAILURE: updated question not found in "answered" state.');
        }

        // Cleanup
        console.log('Cleaning up test data...');
        await client.query('DELETE FROM user_questions WHERE id = $1', [questionId]);
        await client.query('DELETE FROM admin_notifications WHERE id = $1', [insertNotif.rows[0].id]);
        console.log('Cleanup complete.');

    } catch (err) {
        console.error('QA Check Failed:', err);
    } finally {
        await client.end();
    }
}

runQualityCheck();
