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
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

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

    // 5s timeout for AI calls
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

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
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

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
        if ((cleanedKey.startsWith('"') && cleanedKey.endsWith('"')) || (cleanedKey.startsWith("'") && cleanedKey.endsWith("'"))) {
            cleanedKey = cleanedKey.slice(1, -1);
        }

        if (cleanedKey.startsWith('{')) {
            try {
                serviceAccount = JSON.parse(cleanedKey);
                isServiceAccount = true;
            } catch (parseError) {
                console.error("Failed to parse FCM_SERVER_KEY as JSON:", parseError);
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

            let messageTemplate: any = {
                notification: payload.notification,
                data: payload.data,
                android: payload.android,
                apns: payload.apns,
                webpush: payload.webpush
            };

            if (payload.to && !payload.registration_ids) {
                // Single Send
                let message: any = { ...messageTemplate };
                if (payload.to.startsWith('/topics/')) {
                    message.topic = payload.to.replace('/topics/', '');
                } else {
                    message.token = payload.to;
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

            } else if (payload.registration_ids) {
                // Batch Send via Loop (Parallel Batches)
                console.log(`FCM v1 Batch: Sending to ${payload.registration_ids.length} tokens...`);
                const tokens = payload.registration_ids;
                const BATCH_SIZE = 50; // Parallel requests

                for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
                    const chunk = tokens.slice(i, i + BATCH_SIZE);
                    await Promise.allSettled(chunk.map(async (token: string) => {
                        const singleMessage = { ...messageTemplate, token: token };
                        await fetch(url, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ message: singleMessage })
                        }).catch(e => console.error(`Failed to send to token ${token.slice(0, 10)}...`, e));
                    }));
                }
                console.log(`[FCM] Batch dispatch completed.`);
            }

        } else {
            // Legacy API Fallback
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
                console.log("FCM Legacy Sent Successfully.");
            }
        }
    } catch (e) {
        console.error("FCM Dispatch Error:", e);
    }
};

// --- BACKGROUND PROCESSOR ---
async function processFeeds(customQuery: string | null) {
    console.log(`[BACKGROUND] Starting processing for query: ${customQuery || 'GLOBAL'}`);

    // In-memory deduplication set for notifications
    const notifiedEventIds = new Set<string>();
    // Also track source URLs to be safe against same story with different IDs
    const processedStoryUrls = new Set<string>();

    // 0. Cleanup Old Data
    if (!customQuery) {
        try {
            console.log("Running Cleanup Phase...");
            const gdeltCutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();
            await supabase.from('gdelt_events').delete().lt('created_at', gdeltCutoff);

            const pexelsCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
            await supabase.from('pexels_media').delete().lt('created_at', pexelsCutoff);
        } catch (cleanupErr) {
            console.error("Cleanup phase failed:", cleanupErr);
        }
    }

    // 1. Fetch Pexels Data
    if (!customQuery) {
        const pexelsItems = await fetchPexels();
        if (pexelsItems.length > 0) {
            const { error: pexelsError } = await supabase
                .from('pexels_media')
                .upsert(pexelsItems, { onConflict: 'id' });
            if (pexelsError) console.error("Pexels Upsert Error:", pexelsError);
        }
    }

    // 2. Fetch GDELT Data
    let allGdeltEvents: any[] = [];

    try {
        if (customQuery) {
            const events = await fetchGdeltForQuery(customQuery, 'User Interest');
            allGdeltEvents = [...events];
        } else {
            const vibes = ['Trending', 'High Energy', 'Chill', 'Inspiration', 'Intense'];
            const gdeltPromises = vibes.map(v => fetchGdeltForQuery(null, v));

            // Personalization
            let topicEvents: any[] = [];
            try {
                const { data: profiles } = await supabase
                    .from('app_profiles_v2')
                    .select('followed_topics')
                    .not('followed_topics', 'is', null);

                if (profiles) {
                    const allTopics = new Set<string>();
                    profiles.forEach((p: any) => {
                        if (Array.isArray(p.followed_topics)) {
                            p.followed_topics.forEach((t: string) => allTopics.add(t.toLowerCase().trim()));
                        }
                    });

                    const uniqueTopics = Array.from(allTopics).slice(0, 30);
                    console.log(`[PERSONALIZATION] Processing ${uniqueTopics.length} topics...`);

                    if (uniqueTopics.length > 0) {
                        const BATCH_SIZE = 5;
                        const results: any[] = [];

                        for (let i = 0; i < uniqueTopics.length; i += BATCH_SIZE) {
                            const batch = uniqueTopics.slice(i, i + BATCH_SIZE);

                            // Use allSettled so one failure doesn't break the batch
                            const batchResults = await Promise.allSettled(
                                batch.map(topic => fetchGdeltForQuery(`"${topic}"`, 'User Interest'))
                            );

                            batchResults.forEach(res => {
                                if (res.status === 'fulfilled') {
                                    results.push(...res.value);
                                }
                            });

                            // Small delay
                            if (i + BATCH_SIZE < uniqueTopics.length) {
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        }
                        topicEvents = results;
                    }
                }
            } catch (pErr) {
                console.error("Personalization Fetch Error:", pErr);
            }

            const gdeltResults = await Promise.all(gdeltPromises); // These return empty arrays on fail, safe to await all
            allGdeltEvents = [...gdeltResults.flat(), ...topicEvents];
        }
    } catch (gdeltErr) {
        console.error("GDELT Fetching phase failed:", gdeltErr);
    }

    // 3. Upsert
    let uniqueEvents: any[] = [];
    if (allGdeltEvents.length > 0) {
        uniqueEvents = Array.from(
            new Map(allGdeltEvents.map((item) => [item.id, item])).values()
        );

        const { error: gdeltError } = await supabase
            .from('gdelt_events')
            .upsert(uniqueEvents, { onConflict: 'id' });

        if (gdeltError) {
            console.error("GDELT Upsert Error:", gdeltError);
        } else {
            // NOTIFICATION LOGIC (Only for Global Cron)
            if (!customQuery) {
                const highValueEvents = uniqueEvents.filter((e: any) =>
                    (e.vibe === 'Intense' || e.vibe === 'Inspiration' || e.vibe === 'Trending') &&
                    e.title.length > 10 &&
                    e.image_url && e.image_url.startsWith('http')
                );

                // A. Top Story Broadcast
                const topEvent = highValueEvents[0];
                if (topEvent) {
                    const topic = `news_${topEvent.vibe.toLowerCase().replace(' ', '_')}`;
                    const hookTitle = generateHook(topEvent.title, topEvent.vibe);
                    console.log(`[FCM] Broadcasting Top Story: ${topEvent.title}`);

                    // Add to dedup sets
                    if (topEvent.id) notifiedEventIds.add(topEvent.id);
                    if (topEvent.source_url) processedStoryUrls.add(topEvent.source_url);

                    await sendFcmNotification({
                        "to": `/topics/${topic}`,
                        "notification": {
                            "title": hookTitle,
                            "body": "Tap to read full story.",
                            "image": topEvent.image_url
                        },
                        "data": {
                            "eventId": topEvent.id,
                            "type": "NEWS_ALERT",
                            "actions": JSON.stringify([{ title: 'Read Summary', action: 'read_summary' }])
                        }
                    });
                }

                // B. Immediate Interest Matching (Personalized)
                try {
                    // Filter out events we already broadcasted
                    const availableEvents = highValueEvents
                        .filter(e => !processedStoryUrls.has(e.source_url) && !notifiedEventIds.has(e.id));

                    if (availableEvents.length > 0) {
                        const topicToEventsMap = new Map<string, any[]>();
                        const allCandidateKeywords = new Set<string>();

                        // 1. Map Keywords -> Events
                        const MAX_EVENTS_TO_CHECK = 10;
                        for (const event of availableEvents.slice(0, MAX_EVENTS_TO_CHECK)) {
                            const rawKeywords = event.title.split(' ').filter((w: string) => w.length > 5 && /^[A-Z]/.test(w));
                            if (event.country && event.country !== 'Global') rawKeywords.push(event.country);

                            const uniqueEventKeywords = [...new Set(rawKeywords)];
                            for (const kw of uniqueEventKeywords) {
                                const topicKey = (kw as string).toLowerCase().trim();
                                if (topicKey.length > 3) {
                                    allCandidateKeywords.add(topicKey);
                                    if (!topicToEventsMap.has(topicKey)) topicToEventsMap.set(topicKey, []);
                                    topicToEventsMap.get(topicKey)?.push(event);
                                }
                            }
                        }

                        const keywordArray = Array.from(allCandidateKeywords);
                        if (keywordArray.length > 0) {
                            // 2. Find Interested Users with Cooldown Check
                            // We explicitly check last_notified_at is older than 1 hour (or null)
                            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

                            const { data: profiles, error: matchError } = await supabase
                                .from('app_profiles_v2')
                                .select('id, fcm_token, followed_topics, last_notified_at')
                                .overlaps('followed_topics', keywordArray)
                                .not('fcm_token', 'is', null)
                                .or(`last_notified_at.is.null,last_notified_at.lt.${oneHourAgo}`);

                            if (matchError) {
                                console.error("Error matching users for interests:", matchError);
                            } else if (profiles && profiles.length > 0) {
                                const userNotifications = new Map<string, { event: any, userId: string }>(); // One event per user

                                for (const profile of profiles) {
                                    const userToken = profile.fcm_token;
                                    const userId = profile.id;
                                    const userTopics = profile.followed_topics || [];
                                    const interestingTopics = userTopics.filter((t: string) => allCandidateKeywords.has(t));

                                    for (const topic of interestingTopics) {
                                        const events = topicToEventsMap.get(topic);
                                        if (events && events.length > 0) {
                                            // Pick first matching event
                                            if (!userNotifications.has(userToken)) {
                                                const candidateEvent = events[0];
                                                // Double check processed URL
                                                if (!processedStoryUrls.has(candidateEvent.source_url)) {
                                                    userNotifications.set(userToken, { event: candidateEvent, userId });
                                                }
                                            }
                                        }
                                    }
                                }

                                console.log(`[FCM] Dispatching ${userNotifications.size} personalized alerts (Interest Match).`);

                                const userIdsToUpdate = new Set<string>();

                                // 3. Batch Send & Update State
                                for (const [token, { event, userId }] of userNotifications) {
                                    await sendFcmNotification({
                                        "to": token,
                                        "notification": {
                                            "title": `News for you`,
                                            "body": event.title,
                                            "image": event.image_url
                                        },
                                        "data": {
                                            "eventId": event.id,
                                            "type": "NEWS_ALERT",
                                            "url": event.source_url,
                                            "isTopicAlert": "true"
                                        }
                                    });
                                    userIdsToUpdate.add(userId);
                                }

                                // 4. Update last_notified_at
                                if (userIdsToUpdate.size > 0) {
                                    const { error: updateError } = await supabase
                                        .from('app_profiles_v2')
                                        .update({ last_notified_at: new Date().toISOString() })
                                        .in('id', Array.from(userIdsToUpdate));

                                    if (updateError) console.error("Failed to update last_notified_at:", updateError);
                                }
                            }
                        }
                    }

                } catch (notifErr) {
                    console.error("Error processing personalized notifications:", notifErr);
                }
            }
        }
    }

    console.log(`[STATUS] Background tasks completed.`);
}

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
            throw new Error("Server Misconfiguration: Missing API Keys");
        }

        let customQuery: string | null = null;
        try {
            if (req.method === 'POST') {
                // Catch empty bodies
                const text = await req.text();
                if (text) {
                    const payload = JSON.parse(text);
                    customQuery = payload.query;
                }
            }
        } catch (e) {
            console.warn("Body parse warning:", e);
        }

        console.log(`[CRON] Triggered at ${new Date().toISOString()}`);

        // --- CORE CHANGE: RESPONSE FIRST, PROCESS LATER ---
        // @ts-ignore
        EdgeRuntime.waitUntil(processFeeds(customQuery));

        return new Response(JSON.stringify({
            success: true,
            message: "Processing started in background"
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("Function Error:", err);
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
