import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TOTAL_USERS = 100;
const DELAY_MS = 200; // Delay between actions to avoid instant rate limiting

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const randomString = (length) => Math.random().toString(36).substring(2, 2 + length);

async function runLoadTest() {
    console.log(`Starting load test with ${TOTAL_USERS} users...`);
    const results = {
        success: 0,
        failed: 0,
        details: []
    };

    for (let i = 0; i < TOTAL_USERS; i++) {
        const userNum = i + 1;
        const email = `loadtest_${Date.now()}_${userNum}@example.com`;
        const password = 'testpassword123';
        const username = `tester_${randomString(5)}`;

        console.log(`[User ${userNum}/${TOTAL_USERS}] Starting flow for ${email}...`);

        try {
            // 1. Sign Up
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) throw new Error(`Auth failed: ${authError.message}`);

            const userId = authData.user?.id;
            if (!userId) throw new Error('Auth succeeded but no user ID returned (maybe email confirmation required?)');

            console.log(`[User ${userNum}] Signed up. ID: ${userId}`);

            // 2. Create/Update Profile
            // Note: The app now auto-creates profiles on fetch, but here we simulate the "Edit Profile" action
            const profileUpdates = {
                id: userId,
                username: username,
                full_name: `Load Tester ${userNum}`,
                bio: `I am load tester number ${userNum}`,
                occupation: 'Bot',
                location: 'Simulated Reality',
                explored_percent: Math.floor(Math.random() * 100),
                regions_count: Math.floor(Math.random() * 10),
                places_count: Math.floor(Math.random() * 20)
            };

            const { error: profileError } = await supabase
                .from('app_profiles_v2')
                .upsert(profileUpdates);

            if (profileError) throw new Error(`Profile update failed: ${profileError.message}`);
            console.log(`[User ${userNum}] Profile updated.`);

            // 3. Create a Post
            const { data: postData, error: postError } = await supabase
                .from('app_posts')
                .insert({
                    user_id: userId,
                    caption: `Load test post from user ${userNum} #testing`,
                    location_name: 'Test City',
                    location_lat: 0,
                    location_lng: 0,
                    is_hidden: false
                })
                .select()
                .single();

            if (postError) throw new Error(`Post creation failed: ${postError.message}`);
            console.log(`[User ${userNum}] Post created. ID: ${postData.id}`);

            // 4. Like a Post (Like their own post for simplicity, or a random previous one if we tracked it)
            const { error: likeError } = await supabase
                .from('app_likes')
                .insert({
                    user_id: userId,
                    post_id: postData.id
                });

            if (likeError) throw new Error(`Like failed: ${likeError.message}`);
            console.log(`[User ${userNum}] Liked post.`);

            // 5. Comment on a Post
            const { error: commentError } = await supabase
                .from('app_comments')
                .insert({
                    user_id: userId,
                    post_id: postData.id,
                    content: `Automated comment from user ${userNum}`
                });

            if (commentError) throw new Error(`Comment failed: ${commentError.message}`);
            console.log(`[User ${userNum}] Commented on post.`);

            results.success++;

        } catch (error) {
            console.error(`[User ${userNum}] FAILED: ${error.message}`);
            results.failed++;
            results.details.push({ user: userNum, error: error.message });
        }

        await sleep(DELAY_MS);
    }

    console.log('\n--- Load Test Complete ---');
    console.log(`Total Users: ${TOTAL_USERS}`);
    console.log(`Success: ${results.success}`);
    console.log(`Failed: ${results.failed}`);
    if (results.failed > 0) {
        console.log('Failures:', JSON.stringify(results.details, null, 2));
    }
}

runLoadTest().catch(console.error);
