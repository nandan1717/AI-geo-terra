// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { createClient } from '@supabase/supabase-js'
import { SignJWT, importPKCS8 } from 'jose'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY') || '';
const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY') || '';
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') || '';

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

// Helper to generate a "Hook" title
const generateHook = (title: string, vibe: string): string => {
    const cleanTitle = title.split(' - ')[0]; // Remove source suffix if common
    const starters = ['Just in:', 'Developing:', 'Update:', 'Alert:', 'Trending:'];

    // Heuristic: If title is short enough, prefix it.
    if (cleanTitle.length < 50) {
        const starter = starters[Math.floor(Math.random() * starters.length)];
        return `${starter} ${cleanTitle}`;
    }

    // Heuristic: For specific vibes, force a prefix
    if (vibe === 'Intense') return `Breaking: ${cleanTitle}`;
    if (vibe === 'Inspiration') return `Good News: ${cleanTitle}`;

    return cleanTitle;
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

    // Add Timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
        const resp = await fetch(`https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&mode=PointData&format=geojson&timespan=24h&maxrows=${limit}&_t=${uniqueReqId}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

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
    } catch (error) {
        // @ts-ignore
        if (error.name === 'AbortError') {
            console.warn(`Timeout fetching GDELT query: ${customQuery || vibe}`);
        } else {
            console.error(`Error fetching GDELT query: ${customQuery || vibe}`, error);
        }
        return [];
    }
};

const getAccessToken = async (serviceAccount: any) => {
    try {
        const alg = 'RS256';
        const pkcs8 = serviceAccount.private_key;
        const privateKey = await importPKCS8(pkcs8, alg);

        const jwt = await new SignJWT({
            iss: serviceAccount.client_email,
            sub: serviceAccount.client_email,
            aud: 'https://oauth2.googleapis.com/token',
            scope: 'https://www.googleapis.com/auth/firebase.messaging',
        })
            .setProtectedHeader({ alg, typ: 'JWT' })
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(privateKey);

        const params = new URLSearchParams();
        params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
        params.append('assertion', jwt);

        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            body: params,
        });
        const data = await res.json();
        return data.access_token;
    } catch (err) {
        console.error("Error getting access token:", err);
        return null;
    }
}

// Generate creative caption for Pexels photo using DeepSeek
const generatePexelsCaption = async (photographer: string, altText: string): Promise<string> => {
    if (!DEEPSEEK_API_KEY) return '';
    try {
        const prompt = `Generate a short, engaging Instagram-style caption (max 15 words) for a photo by ${photographer}. Photo description: ${altText || 'A beautiful curated photo'}. Be creative, poetic, and inspiring. Just return the caption, no quotes or extra text.`;

        const resp = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 50,
                temperature: 0.8
            })
        });

        if (!resp.ok) return '';
        const data = await resp.json();
        return data.choices?.[0]?.message?.content?.trim() || '';
    } catch (e) {
        console.error("DeepSeek Caption Error:", e);
        return '';
    }
};

const fetchPexels = async () => {
    if (!PEXELS_API_KEY) return [];
    try {
        const resp = await fetch('https://api.pexels.com/v1/curated?per_page=20', {
            headers: { Authorization: PEXELS_API_KEY }
        });

        if (!resp.ok) {
            console.error("Pexels API Error:", await resp.text());
            return [];
        }

        const data = await resp.json();
        if (!data.photos) return [];

        // Generate captions in batches to avoid rate limits
        const mediaItems = [];
        for (const p of data.photos.slice(0, 10)) { // Limit to 10 for caption generation
            const caption = await generatePexelsCaption(p.photographer, p.alt || '');
            mediaItems.push({
                id: p.id,
                url: p.url,
                photographer: p.photographer,
                image_url: p.src.large2x || p.src.large,
                video_url: null,
                media_type: 'image',
                caption: caption,
                created_at: new Date().toISOString()
            });
            // Small delay between API calls
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return mediaItems;
    } catch (e) {
        console.error("Pexels Fetch Error:", e);
        return [];
    }
};

const sendFcmNotification = async (payload: any) => {
    if (!FCM_SERVER_KEY) {
        console.warn("FCM_SERVER_KEY not set. Skipping notification.");
        return;
    }

    let isServiceAccount = false;
    let serviceAccount: any = null;

    try {
        let cleanedKey = FCM_SERVER_KEY.trim();
        // Handle potentially quoted env vars (e.g. "{"type":...}")
        if ((cleanedKey.startsWith('"') && cleanedKey.endsWith('"')) || (cleanedKey.startsWith("'") && cleanedKey.endsWith("'"))) {
            cleanedKey = cleanedKey.slice(1, -1);
        }

        if (cleanedKey.startsWith('{')) {
            try {
                serviceAccount = JSON.parse(cleanedKey);
                isServiceAccount = true;
            } catch (parseError) {
                console.error("Failed to parse FCM_SERVER_KEY as JSON:", parseError);
                // IF it looks like JSON but matches nothing, don't try legacy, it will fail headers.
                return;
            }
        }
    } catch (e) {
        console.warn("Error processing FCM key format", e);
    }

    try {
        if (isServiceAccount && serviceAccount) {
            // HTTP v1 API
            const accessToken = await getAccessToken(serviceAccount);
            if (!accessToken) {
                console.error("Failed to generate access token for FCM v1");
                return;
            }

            const projectId = serviceAccount.project_id;
            const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

            // Map Legacy Payload to v1 Message
            // Legacy uses: to (topic or token), notification, data
            // v1 uses: message: { topic/token, notification, data }

            let message: any = {
                notification: payload.notification,
                data: payload.data
            };

            if (payload.to) {
                if (payload.to.startsWith('/topics/')) {
                    message.topic = payload.to.replace('/topics/', '');
                } else {
                    message.token = payload.to;
                }
            } else if (payload.registration_ids) {
                // v1 does not support multicast (registration_ids). 
                // We must loop. Ideally call this function in a loop from caller, but for now we handle it here if possible.
                // Or better: The caller (Granular Topic) already batches. The caller sends `registration_ids`.
                // We MUST iterate here because v1 is single send.
                // NOTE: Batch sending in v1 is "sendAll" but likely better to just simple loop for now or warn.
                // Converting `registration_ids` to individual calls:
                console.warn("FCM v1 does not support 'registration_ids' (multicast). Sending sequentially.");

                const tokens = payload.registration_ids;
                for (const token of tokens) {
                    const singleMessage = { ...message, token: token };
                    // Recursively call send or just fetch here?
                    // Let's just fetch to avoid infinite recursion complexity with modified payload
                    await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ message: singleMessage })
                    });
                }
                console.log(`Sent ${tokens.length} messages sequentially via FCM v1`);
                return;
            }

            const fcmResp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            if (!fcmResp.ok) {
                console.error("FCM v1 Send Failed:", await fcmResp.text());
            } else {
                console.log("FCM v1 Sent Successfully:", message.topic || message.token);
            }

        } else {
            // Legacy API Fallback
            // Safety Check: If parse failed but it LOOKS like a Service Account, do NOT use Legacy
            if (FCM_SERVER_KEY.trim().startsWith('{') || FCM_SERVER_KEY.trim().includes('"type": "service_account"')) {
                console.error("FCM_SERVER_KEY indicates Service Account but parsing failed. Skipping Legacy Fallback.");
                return;
            }

            const fcmResp = await fetch('https://fcm.googleapis.com/fcm/send', {
                method: 'POST',
                headers: { 'Authorization': `key=${FCM_SERVER_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!fcmResp.ok) {
                console.error("FCM Legacy Send Failed:", await fcmResp.text());
            } else {
                console.log("FCM Legacy Sent Successfully:", payload.to);
            }
        }
    } catch (e) {
        console.error("FCM Dispatch Error:", e);
    }
};

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://geo-terra.vercel.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
};

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

        // 0. Cleanup Old Data - Run FIRST to ensure storage health & avoid timeout prevention
        if (!customQuery) {
            try {
                console.log("Running Cleanup Phase...");
                // GDELT: 20 minutes cleanup
                const gdeltCutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();
                const { error: cleanupGdeltError } = await supabase.from('gdelt_events').delete().lt('created_at', gdeltCutoff);
                if (cleanupGdeltError) console.error("GDELT Cleanup Error:", cleanupGdeltError);
                else console.log("GDELT Cleanup completed.");

                // Pexels: 6 hours cleanup
                const pexelsCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
                const { error: cleanupPexelsError } = await supabase.from('pexels_media').delete().lt('created_at', pexelsCutoff);
                if (cleanupPexelsError) console.error("Pexels Cleanup Error:", cleanupPexelsError);
                else console.log("Pexels Cleanup completed (6 hour rotation).");
            } catch (cleanupErr) {
                console.error("Cleanup phase failed:", cleanupErr);
            }
        }

        // 1. Fetch Pexels Data (Restored Logic)
        if (!customQuery) {
            const pexelsItems = await fetchPexels();
            if (pexelsItems.length > 0) {
                const { error: pexelsError } = await supabase
                    .from('pexels_media')
                    .upsert(pexelsItems, { onConflict: 'id' });

                if (pexelsError) console.error("Pexels Upsert Error:", pexelsError);
                else console.log(`Upserted ${pexelsItems.length} Pexels items.`);
            }
        }

        // 2. Fetch GDELT Data
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

                        // Personalization - Batched Fetching to prevent Timeouts
                        const uniqueTopics = Array.from(allTopics).slice(0, 30); // Limit to 30 topics for now
                        console.log(`Found ${uniqueTopics.length} unique user topics to fetch:`, uniqueTopics);

                        if (uniqueTopics.length > 0) {
                            const BATCH_SIZE = 5;
                            const results: any[] = [];

                            for (let i = 0; i < uniqueTopics.length; i += BATCH_SIZE) {
                                const batch = uniqueTopics.slice(i, i + BATCH_SIZE);
                                console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uniqueTopics.length / BATCH_SIZE)}:`, batch);

                                const batchPromises = batch.map(topic =>
                                    fetchGdeltForQuery(`"${topic}"`, 'User Interest')
                                        .catch(e => {
                                            console.error(`Error fetching topic "${topic}":`, e);
                                            return [];
                                        })
                                );

                                // Wait for this batch to finish before starting the next
                                const batchResults = await Promise.all(batchPromises);
                                results.push(...batchResults.flat());

                                // Small delay to be nice to the API
                                if (i + BATCH_SIZE < uniqueTopics.length) {
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                }
                            }

                            topicEvents = results;
                            console.log(`Fetched ${topicEvents.length} personalized events total.`);
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
        }

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
                    // Filter "High Value" events for Notification
                    // Valid Image URL is required for Rich Media
                    const highValueEvents = uniqueEvents.filter((e: any) =>
                        (e.vibe === 'Intense' || e.vibe === 'Inspiration' || e.vibe === 'Trending') &&
                        e.title.length > 10 &&
                        e.image_url && e.image_url.startsWith('http')
                    );

                    // 1. Send Top Story to Global Topics (Generic Vibe)
                    const topEvent = highValueEvents[0];
                    if (topEvent) {
                        const topic = `news_${topEvent.vibe.toLowerCase().replace(' ', '_')}`;
                        const hookTitle = generateHook(topEvent.title, topEvent.vibe);

                        console.log(`Broadcasting Rich Notification for: ${topEvent.title} to topic: ${topic}`);

                        await sendFcmNotification({
                            "to": `/topics/${topic}`,
                            "notification": {
                                "title": hookTitle,
                                "body": "Tap to read the full story.",
                                "image": topEvent.image_url
                            },
                            "webpush": {
                                "notification": {
                                    "icon": "/icon.png"
                                },
                                "fcm_options": {
                                    "link": "/feed"
                                }
                            },
                            "data": {
                                "eventId": topEvent.id,
                                "type": "NEWS_ALERT",
                                "vibe": topEvent.vibe,
                                "url": topEvent.source_url,
                                "imageUrl": topEvent.image_url,
                                "actions": JSON.stringify([{ title: 'Read Summary', action: 'read_summary' }])
                            }
                        });
                    }

                    // 2. Send Granular Topic Notifications (OPTIMIZED)
                    // limit to a few to avoid spamming self during testing
                    const granularCandidates = highValueEvents.slice(0, 5);
                    const topicToEventsMap = new Map<string, any[]>();
                    const allCandidateKeywords = new Set<string>();

                    // Step A: Collect all keywords and map them to events
                    for (const event of granularCandidates) {
                        const rawKeywords = event.title.split(' ').filter((w: string) => w.length > 5 && /^[A-Z]/.test(w));
                        if (event.country && event.country !== 'Global') {
                            rawKeywords.push(event.country);
                        }
                        const uniqueEventKeywords = [...new Set(rawKeywords)];

                        for (const kw of uniqueEventKeywords) {
                            const topicKey = (kw as string).toLowerCase().trim();
                            if (topicKey.length > 3) {
                                allCandidateKeywords.add(topicKey);

                                if (!topicToEventsMap.has(topicKey)) {
                                    topicToEventsMap.set(topicKey, []);
                                }
                                topicToEventsMap.get(topicKey)?.push(event);
                            }
                        }
                    }

                    // Step B: Single Query for ALL interested users
                    const keywordArray = Array.from(allCandidateKeywords);
                    if (keywordArray.length > 0) {
                        console.log(`Checking DB for users interested in ANY of ${keywordArray.length} keywords...`);

                        // Use overlaps (&&) to find users who follow ANY of the keywords
                        const { data: profiles, error: matchError } = await supabase
                            .from('app_profiles_v2')
                            .select('fcm_token, followed_topics')
                            .overlaps('followed_topics', keywordArray)
                            .not('fcm_token', 'is', null);

                        if (!matchError && profiles && profiles.length > 0) {
                            console.log(`Found ${profiles.length} user profiles with potential matches.`);

                            // Step C: Match Users to Events in Memory & Deduplicate Notifications
                            // Map<fcmToken, Set<Event>>
                            const userNotifications = new Map<string, Set<any>>();

                            for (const profile of profiles) {
                                const userTopics = profile.followed_topics || [];
                                const userToken = profile.fcm_token;

                                // Find intersection
                                const interestingTopics = userTopics.filter((t: string) => allCandidateKeywords.has(t));

                                for (const topic of interestingTopics) {
                                    const eventsForTopic = topicToEventsMap.get(topic);
                                    if (eventsForTopic) {
                                        if (!userNotifications.has(userToken)) {
                                            userNotifications.set(userToken, new Set());
                                        }
                                        eventsForTopic.forEach(e => userNotifications.get(userToken)?.add(e));
                                    }
                                }
                            }

                            console.log(`Preparing notifications for ${userNotifications.size} unique users.`);

                            // Step D: Send Notifications (Batched by User)
                            for (const [token, eventsSet] of userNotifications) {
                                const events = Array.from(eventsSet);
                                const event = events[0]; // Send the first relevant event (avoid spamming multiple)

                                // In a real system, we might send a digest or queue multiple, but let's stick to 1 per run per user to be safe
                                await sendFcmNotification({
                                    "to": token, // Direct to token
                                    "notification": {
                                        "title": `News for you`,
                                        "body": event.title,
                                        "image": event.image_url
                                    },
                                    "webpush": {
                                        "notification": {
                                            "icon": "/icon.png"
                                        },
                                        "fcm_options": {
                                            "link": "/feed"
                                        }
                                    },
                                    "android": {
                                        "notification": {
                                            "click_action": "geo-terra:view-news-item"
                                        }
                                    },
                                    "apns": {
                                        "payload": {
                                            "aps": {
                                                "category": "geo-terra:view-news-item",
                                                "mutable-content": 1
                                            }
                                        }
                                    },
                                    "data": {
                                        "eventId": event.id,
                                        "type": "NEWS_ALERT",
                                        "isTopicAlert": "true"
                                    }
                                });
                            }
                        } else if (matchError) {
                            console.error("Error matching users for granular topics:", matchError);
                        }
                    }

                    // 3. Daily Brief Logic (Placeholder)
                    // Check time: 8 AM UTC (roughly 8 AM London / 9 AM Paris)
                    const now = new Date();
                    if (now.getUTCHours() === 8 && now.getUTCMinutes() < 20) {
                        console.log("Creating Daily Brief Notification...");
                        // Server-Side Targeting for Daily Brief
                        const { data: profiles } = await supabase
                            .from('app_profiles_v2')
                            .select('fcm_token')
                            .contains('followed_topics', ['daily_brief'])
                            .not('fcm_token', 'is', null);

                        if (profiles && profiles.length > 0) {
                            const tokens = profiles.map((p: any) => p.fcm_token);
                            const uniqueTokens = [...new Set(tokens)];

                            const batchSize = 1000;
                            for (let i = 0; i < uniqueTokens.length; i += batchSize) {
                                const batch = uniqueTokens.slice(i, i + batchSize);
                                await sendFcmNotification({
                                    "registration_ids": batch,
                                    "notification": {
                                        "title": "☕️ Your Daily Brief",
                                        "body": `Here are the top stories from around the world.`,
                                        "image": topEvent?.image_url
                                    },
                                    "data": {
                                        "type": "DAILY_BRIEF"
                                    }
                                });
                            }
                        }
                    }
                }
            }
        } else {
            console.log("No GDELT events found to upsert.");
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
