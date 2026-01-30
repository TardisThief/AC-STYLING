
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load envs
dotenv.config();
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
    for (const k in envConfig) process.env[k] = envConfig[k];
}

async function run() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    try {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'services';
        `);
        console.log("Columns in 'services' table:");
        res.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
