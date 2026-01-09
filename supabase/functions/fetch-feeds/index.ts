// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// GDELT Helpers
const decodeHtmlEntities = (text: string | null | undefined): string => {
    if (!text) return '';
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_: any, dec: string) => String.fromCharCode(parseInt(dec, 10)));
};

const parseGdeltDate = (dateStr: string | undefined): string | undefined => {
    if (!dateStr) return undefined;
    if (dateStr.match(/^\d{8}T\d{6}Z?$/)) {
        const y = dateStr.substring(0, 4);
        const m = dateStr.substring(4, 6);
        const d = dateStr.substring(6, 8);
        const h = dateStr.substring(9, 11);
        const min = dateStr.substring(11, 13);
        const s = dateStr.substring(13, 15);
        return new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`).toISOString();
    }
    // Try standard
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d.toISOString();
    } catch (_e) { }
    return undefined;
};

// Helper to validate and return original URL
const validateAndCleanUrl = (url: string | undefined | null): string | null => {
    if (!url) return null;
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http')) return null;

    // Validate URL format
    try {
        new URL(cleanUrl);
        return cleanUrl;
    } catch (e) {
        return null;
    }
};

const fetchGdeltForQuery = async (customQuery: string | null, vibe: string) => {
    // Construct Query based on Vibe OR Custom Query
    let query = 'sourcelang:eng';
    const baseExclusions = '-theme:POLITICS -theme:MILITARY -theme:GOVERNMENT -theme:TAX_FNCACT -theme:LEGISLATION';

    if (customQuery) {
        // Targeted Query
        // We append the custom query directly.
        // e.g. (Japan OR Tokyo)
        query += ` ${customQuery} ${baseExclusions}`;
    } else {
        // Standard Vibe Query
        switch (vibe) {
            case 'High Energy': query += ` (sport OR festival OR concert OR music OR premiere OR "red carpet" OR celebrity) ${baseExclusions}`; break;
            case 'Chill': query += ` (travel OR vacation OR beach OR park OR museum OR "art gallery" OR hiking OR nature) ${baseExclusions}`; break;
            case 'Inspiration': query += ` (theme:EDUCATION OR theme:SCIENCE OR theme:INNOVATION OR theme:CHARITY OR breakthrough OR discovery) ${baseExclusions}`; break;
            case 'Intense': query += ` (theme:SOCIETY OR theme:MEDIA_MSM OR theme:CRISISLEX OR protest OR rally) ${baseExclusions}`; break;
            case 'Trending':
            default: query += ` (technology OR culture OR fashion OR movie OR viral OR film OR social) ${baseExclusions}`; break;
        }
    }

    const limit = 40;
    const uniqueReqId = Date.now();
    const resp = await fetch(`https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&mode=PointData&format=geojson&timespan=24h&maxrows=${limit}&_t=${uniqueReqId}`);
    if (!resp.ok) return [];

    const data = await resp.json();
    if (!data.features) return [];

    // Parallel validation of features
    const events = await Promise.all(data.features.map(async (feature: any) => {
        const props = feature.properties;
        const [lon, lat] = feature.geometry.coordinates;

        let url = props.url || '';
        let title = 'Recent Story';

        // Clean Title
        if (props.html) {
            const linkMatch = props.html.match(/<a href="([^"]+)"[^>]*>(.*?)<\/a>/);
            if (linkMatch) {
                url = linkMatch[1];
                title = linkMatch[2];
            } else {
                title = props.html.replace(/<[^>]*>?/gm, '');
            }
        }
        title = decodeHtmlEntities(title);

        // ID Generation
        const rawId = url || props.url_mobile || title || `event-${lat}-${lon}`;
        let safeId = rawId.replace(/[^a-zA-Z0-9]/g, '');
        if (safeId.length > 50) safeId = safeId.substring(0, 50);
        const stableId = `gdelt-${safeId}-${lat}-${lon}`;

        // Sentiment
        let sentiment = 0;
        if (vibe === 'High Energy') sentiment = 7;
        if (vibe === 'Inspiration') sentiment = 8;
        if (vibe === 'Chill') sentiment = 5;

        // Image check
        // Check socialimage first, then shareimage
        const possibleImage = props.socialimage || props.shareimage;
        const finalImageUrl = validateAndCleanUrl(possibleImage);

        return {
            id: stableId,
            title: title,
            description: title,
            source_url: url,
            image_url: finalImageUrl,
            latitude: lat,
            longitude: lon,
            published_at: parseGdeltDate(props.seendate) || new Date().toISOString(),
            vibe: vibe,
            sentiment: sentiment,
            country: props.countryname || props.sourcecountry || props.name || 'Global',
            created_at: new Date().toISOString()
        };
    }));

    return events;
};

const fetchPexels = async (url: string) => {
    const resp = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
    if (!resp.ok) return [];
    const data = await resp.json();
    const photos = data.photos || [];
    return photos.map((p: any) => ({
        id: p.id,
        url: p.url,
        photographer: p.photographer,
        image_url: p.src.large2x,
        video_url: null,
        media_type: 'image',
        created_at: new Date().toISOString()
    }));
};

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Main Handler
// Main Handler
Deno.serve(async (req) => {
    // Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (!PEXELS_API_KEY) {
            console.error("Missing PEXELS_API_KEY environment variable");
            throw new Error("Server Misconfiguration: Missing API Keys");
        }

        // Parse Request Body (if any)
        let customQuery: string | null = null;
        try {
            // Only attempt to parse body if method is POST and body exists
            if (req.method === 'POST' && req.body) {
                const payload = await req.json();
                customQuery = payload.query;
            }
        } catch (e) {
            console.warn("Failed to parse request body, proceeding without custom query:", e);
            // Ignore JSON parse error (likely empty body from CRON or GET request)
        }

        console.log(`Starting Feed Update. Custom Query: ${customQuery || 'None (Global Cron)'}`);

        // 1. Fetch GDELT Data
        let allGdeltEvents: any[] = [];

        try {
            if (customQuery) {
                // Targeted User Fetch
                // Use a simpler 'Trending' vibe for custom queries to ensure we get results
                const events = await fetchGdeltForQuery(customQuery, 'User Interest');
                allGdeltEvents = [...events];
            } else {
                // Standard Global Cron Fetch
                const vibes = ['Trending', 'High Energy', 'Chill', 'Inspiration', 'Intense'];
                // Execute sequentially to avoid rate limits or memory bursts if critical
                // but Promise.all is usually fine for 5 reqs.
                const gdeltPromises = vibes.map(v => fetchGdeltForQuery(null, v).catch(err => {
                    console.error(`Failed to fetch GDELT for vibe ${v}:`, err);
                    return [];
                }));

                // --- PERSONALIZATION ---
                // Fetch unique topics followed by ANY user to populate the shared pool
                let topicEvents: any[] = [];
                try {
                    const { data: profiles, error: profileError } = await supabase
                        .from('app_profiles_v2')
                        .select('followed_topics')
                        .not('followed_topics', 'is', null);

                    if (!profileError && profiles) {
                        // Flatten and Unique
                        const allTopics = new Set<string>();
                        profiles.forEach((p: any) => {
                            if (Array.isArray(p.followed_topics)) {
                                p.followed_topics.forEach((t: string) => allTopics.add(t.toLowerCase().trim()));
                            }
                        });

                        const uniqueTopics = Array.from(allTopics).slice(0, 30); // Limit to 30 topics for now
                        console.log(`Found ${uniqueTopics.length} unique user topics to fetch:`, uniqueTopics);

                        if (uniqueTopics.length > 0) {
                            const topicPromises = uniqueTopics.map(topic =>
                                fetchGdeltForQuery(`"${topic}"`, 'User Interest').catch(e => [])
                            );
                            const topicResults = await Promise.all(topicPromises);
                            topicEvents = topicResults.flat();
                            console.log(`Fetched ${topicEvents.length} personalized events.`);
                        }
                    }
                } catch (pErr) {
                    console.error("Personalization Fetch Error:", pErr);
                }

                const gdeltResults = await Promise.all(gdeltPromises);
                allGdeltEvents = [...gdeltResults.flat(), ...topicEvents];
            }
        } catch (gdeltErr) {
            console.error("CRITICAL: GDELT Fetching phase failed entirely:", gdeltErr);
            // We continue to Pexels so we don't return partial failure if possible
        }

        // 2. Fetch Pexels Data - REMOVED (User Request 2025-01-09)
        // We no longer fetch generic stock videos/images for the feed.

        // 3. Upsert to Supabase
        let uniqueEvents: any[] = [];
        if (allGdeltEvents.length > 0) {
            uniqueEvents = Array.from(
                new Map(allGdeltEvents.map((item) => [item.id, item])).values()
            );

            console.log(`Deduplicated GDELT events: ${allGdeltEvents.length} -> ${uniqueEvents.length}`);

            const { error: gdeltError } = await supabase
                .from('gdelt_events')
                .upsert(uniqueEvents, { onConflict: 'id' });

            if (gdeltError) console.error("GDELT Upsert Error:", gdeltError);
            else {
                console.log(`Upserted ${uniqueEvents.length} GDELT events.`);

                // NOTIFICATION LOGIC (Only for Global Cron)
                if (!customQuery) {
                    const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY');
                    if (FCM_SERVER_KEY) {
                        const highValueEvents = uniqueEvents.filter((e: any) => e.sentiment >= 8 || e.vibe === 'Intense' || e.vibe === 'Inspiration');
                        const topEvent = highValueEvents[0];
                        if (topEvent) {
                            const topic = `news_${topEvent.vibe.toLowerCase().replace(' ', '_')}`;
                            console.log(`Broadcasting Notification for: ${topEvent.title} to topic: ${topic}`);

                            try {
                                const fcmPayload = {
                                    "to": `/topics/${topic}`,
                                    "notification": {
                                        "title": `🚨 Breaking in ${topEvent.country}`,
                                        "body": topEvent.title,
                                        "sound": "default",
                                        "click_action": "geo-terra:view-news-item"
                                    },
                                    "data": { "eventId": topEvent.id, "type": "NEWS_ALERT", "vibe": topEvent.vibe }
                                };
                                const fcmResp = await fetch('https://fcm.googleapis.com/fcm/send', {
                                    method: 'POST',
                                    headers: { 'Authorization': `key=${FCM_SERVER_KEY}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify(fcmPayload)
                                });

                                if (!fcmResp.ok) {
                                    console.error("FCM Send Failed:", await fcmResp.text());
                                } else {
                                    console.log("FCM Broadcast Sent Successfully.");
                                }
                            } catch (e) {
                                console.error("FCM Dispatch Error:", e);
                            }
                        }
                    }
                }
            }
        } else {
            console.log("No GDELT events found to upsert.");
        }

        // Upsert Pexels - REMOVED

        // 4. Cleanup Old Data (> 20 mins) - Only on Cron Run
        if (!customQuery) {
            try {
                const cutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();
                const { error: cleanupGdeltError } = await supabase.from('gdelt_events').delete().lt('created_at', cutoff);
                if (cleanupGdeltError) console.error("GDELT Cleanup Error:", cleanupGdeltError);
                // Pexels Cleanup - REMOVED
            } catch (cleanupErr) {
                console.error("Cleanup phase failed:", cleanupErr);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            message: customQuery ? "Custom feed fetched" : "Global feeds updated",
            events: uniqueEvents
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("Function Error:", err);
        // Important: Return JSON with error details AND CORS headers so client doesn't get a network error
        return new Response(JSON.stringify({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown Error',
            details: String(err)
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
