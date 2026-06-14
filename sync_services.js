import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { services } from './src/data/services.js';
import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

// Try to load env
const envContent = readFileSync('.env', 'utf-8');
const lines = envContent.split('\n');
let supabaseUrl = '';
let supabaseKey = '';

for (const line of lines) {
    if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
}

console.log('URL found:', !!supabaseUrl);
console.log('Key found:', !!supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncServices() {
    console.log('Starting sync...');

    // 1. Get all current services
    const { data: currentServices, error: fetchError } = await supabase
        .from('services')
        .select('*');

    if (fetchError) {
        console.error('Error fetching:', fetchError);
        return;
    }

    console.log(`Found ${currentServices.length} existing services in DB.`);
    console.log(`Have ${services.length} new services to sync.`);

    // 2. Clear existing services
    console.log('Clearing old services...');
    const { error: deleteError } = await supabase
        .from('services')
        .delete()
        .neq('id', 'dummy');

    if (deleteError) {
        console.error('Error deleting:', deleteError);
    }

    // 3. Insert new services
    console.log('Inserting new services...');

    // Clean payload
    const payload = services.map(s => {
        const { id, ...rest } = s;
        return rest;
    });

    const { data: inserted, error: insertError } = await supabase
        .from('services')
        .insert(payload)
        .select();

    if (insertError) {
        console.error('Error inserting:', insertError);
    } else {
        console.log(`Successfully inserted ${inserted.length} services.`);
    }
}

syncServices();
