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

const getProxiedUrl = (url: string | undefined | null) => {
    if (!url) return null;
    const cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http')) return null;
    // Basic URL validation
    try {
        new URL(cleanUrl);
    } catch (e) {
        return null;
    }
    return `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}&w=800&q=80`;
};

const checkImage = async (url: string): Promise<boolean> => {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 1500); // 1.5s Timeout
        const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
        clearTimeout(id);
        return res.ok;
    } catch (e) {
        return false;
    }
};

const fetchGdeltForVibe = async (vibe: string) => {
    // Construct Query based on Vibe
    let query = 'sourcelang:eng';
    const baseExclusions = '-theme:POLITICS -theme:MILITARY -theme:GOVERNMENT -theme:TAX_FNCACT -theme:LEGISLATION';

    switch (vibe) {
        case 'High Energy': query += ` (sport OR festival OR concert OR music OR premiere OR "red carpet" OR celebrity) ${baseExclusions}`; break;
        case 'Chill': query += ` (travel OR vacation OR beach OR park OR museum OR "art gallery" OR hiking OR nature) ${baseExclusions}`; break;
        case 'Inspiration': query += ` (theme:EDUCATION OR theme:SCIENCE OR theme:INNOVATION OR theme:CHARITY OR breakthrough OR discovery) ${baseExclusions}`; break;
        case 'Intense': query += ` (theme:SOCIETY OR theme:MEDIA_MSM OR theme:CRISISLEX OR protest OR rally) ${baseExclusions}`; break;
        case 'Trending':
        default: query += ` (technology OR culture OR fashion OR movie OR viral OR film OR social) ${baseExclusions}`; break;
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

        // Image check (HEAD request)
        let finalImageUrl: string | null = getProxiedUrl(props.shareimage || props.socialimage);
        if (finalImageUrl) {
            const originalImg = props.shareimage || props.socialimage;
            if (originalImg) {
                const isValid = await checkImage(originalImg);
                if (!isValid) finalImageUrl = null;
            } else {
                finalImageUrl = null;
            }
        }

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
            country: props.countryname || props.sourcecountry || 'Global',
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

// Main Handler
Deno.serve(async (_req) => {
    try {
        if (!PEXELS_API_KEY) {
            throw new Error("Missing PEXELS_API_KEY");
        }

        console.log("Starting Feed Update...");

        // 1. Fetch GDELT Data
        const vibes = ['Trending', 'High Energy', 'Chill', 'Inspiration', 'Intense'];
        const gdeltPromises = vibes.map(v => fetchGdeltForVibe(v));
        const gdeltResults = await Promise.all(gdeltPromises);
        const allGdeltEvents = gdeltResults.flat();

        // 2. Fetch Pexels Data
        const pexelsCurated = await fetchPexels(`https://api.pexels.com/v1/curated?per_page=40`);
        const allPexelsMedia = [...pexelsCurated];

        // 3. Upsert to Supabase
        // Upsert GDELT
        if (allGdeltEvents.length > 0) {
            const uniqueEvents = Array.from(
                new Map(allGdeltEvents.map((item) => [item.id, item])).values()
            );

            console.log(`Deduplicated GDELT events: ${allGdeltEvents.length} -> ${uniqueEvents.length}`);

            const { error: gdeltError } = await supabase
                .from('gdelt_events')
                .upsert(uniqueEvents, { onConflict: 'id' });

            if (gdeltError) console.error("GDELT Upsert Error:", gdeltError);
            else console.log(`Upserted ${uniqueEvents.length} GDELT events.`);
        }

        // Upsert Pexels
        if (allPexelsMedia.length > 0) {
            const { error: pexelsError } = await supabase
                .from('pexels_media')
                .upsert(allPexelsMedia, { onConflict: 'id' });

            if (pexelsError) console.error("Pexels Upsert Error:", pexelsError);
            else console.log(`Upserted ${allPexelsMedia.length} Pexels items.`);
        }

        // 4. Cleanup Old Data (> 20 mins)
        const cutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();

        const { error: cleanupGdeltError } = await supabase
            .from('gdelt_events')
            .delete()
            .lt('created_at', cutoff);

        if (cleanupGdeltError) console.error("GDELT Cleanup Error:", cleanupGdeltError);

        const { error: cleanupPexelsError } = await supabase
            .from('pexels_media')
            .delete()
            .lt('created_at', cutoff);

        if (cleanupPexelsError) console.error("Pexels Cleanup Error:", cleanupPexelsError);

        return new Response(JSON.stringify({ success: true, message: "Feeds updated" }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("Function Error:", err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
