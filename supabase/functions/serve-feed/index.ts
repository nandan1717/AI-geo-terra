
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing environment variables')
        }

        // Create a Supabase client with the Auth context of the logged in user
        const authHeader = req.headers.get('Authorization')

        // We use the service role key to bypass RLS for fetching the profile if needed, 
        // but ideally we should use the user's token. 
        // However, to filter effectively on the server side without complex RLS, 
        // we'll simpler logic: Get User -> Get Topics -> Query Global Table
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Get User
        let userId: string | null = null
        if (authHeader) {
            const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
            if (!authError && user) userId = user.id
        }

        let searchTerms: string[] = []

        if (userId) {
            // 2. Fetch User's Followed Topics
            const { data: profile } = await supabase
                .from('app_profiles_v2')
                .select('followed_topics')
                .eq('id', userId)
                .single()

            if (profile && profile.followed_topics && Array.isArray(profile.followed_topics)) {
                searchTerms = profile.followed_topics
            }
        } else {
            // Fallback for anonymous or guests if we want to support it, 
            // or just return trending.
        }

        console.log(`User ${userId} follows:`, searchTerms)

        let query = supabase
            .from('gdelt_events')
            .select('*')
            .order('published_at', { ascending: false })
            .limit(60)

        // 3. Apply Filters
        if (searchTerms.length > 0) {
            // Construct an OR query for FTS
            // We want: (japan OR tech OR "stranger things")
            // websearch_to_tsquery handles quotes and operators nicely.
            // But we can join with ' OR ' and use plainto_tsquery or websearch.

            const ftsQuery = searchTerms.map(t => `"${t}"`).join(' OR ');
            query = query.textSearch('fts', ftsQuery, {
                type: 'websearch',
                config: 'english'
            });
        } else {
            // Fallback: Show Trending/High Energy if no follows
            query = query.eq('vibe', 'Trending')
        }

        const { data: events, error } = await query

        if (error) {
            console.error('Feed Query Error:', error)
            throw error
        }

        return new Response(JSON.stringify(events), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error('Edge Function Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
