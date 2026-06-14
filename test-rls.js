import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function testRLS() {
    // Try authenticating first? We don't have the user's password.
    // Let's just try inserting without auth to see if it gives the RLS error. If it does, we know it's a policy issue for anons. If the app uses auth, the token is what we're missing.

    // Actually, we can just login with the first user we can find? No wait, we shouldn't guess passwords.

    // Let's see if we can get the policy definitions via the API.
    const { data, error } = await supabase.rpc('debug_rls', {}); // Probably doesn't exist.

    console.log("Creating dummy order...");
    const { data: order, error: orderErr } = await supabase.from('orders').insert({
        ticket_number: 'TEST-12345',
        client_id: 'dummy',
        article_type: 'sneakers',
        material: 'leather',
        total_amount: 0,
        paid_amount: 0
    }).select().single();

    console.log("Order error:", orderErr);

    const { data: photo, error: photoErr } = await supabase.from('photos').insert({
        order_id: order?.id || '00000000-0000-0000-0000-000000000000',
        url: 'http://test.com/photo.jpg',
        type: 'before'
    });

    console.log("Photo error:", photoErr);
}

testRLS();
