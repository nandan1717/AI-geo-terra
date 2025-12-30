import { LocationMarker } from '../types';

interface GDELTFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  properties: {
    url: string;
    url_mobile: string;
    title: string;
    seendate: string;
    socialimage: string;
    domain: string;
    language: string;
    sourcecountry: string;
    // Location props
    name?: string;
    cityname?: string;
    adm1name?: string;
    countryname?: string;
    countrycode?: string;
    adm1code?: string;
    shareimage?: string;
    html?: string;
  };
}

interface GDELTResponse {
  type: string;
  features: GDELTFeature[];
}

// Helper to parse GDELT's various date formats
// Returns undefined if parsing fails, so we can detect missing dates
const parseGdeltDate = (dateStr: string | undefined): string | undefined => {
  if (!dateStr) return undefined;

  // Log for debugging
  // console.log("Parsing GDELT Date:", dateStr);

  // 1. "YYYYMMDDTHHMMSSZ" (Standard ISO-like)
  if (dateStr.match(/^\d{8}T\d{6}Z?$/)) {
    const y = dateStr.substring(0, 4);
    const m = dateStr.substring(4, 6);
    const d = dateStr.substring(6, 8);
    const h = dateStr.substring(9, 11);
    const min = dateStr.substring(11, 13);
    const s = dateStr.substring(13, 15);
    return new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`).toISOString();
  }

  // 2. "YYYYMMDDHHMMSS" (Compact - Common in GDELT V2)
  if (dateStr.match(/^\d{14}$/)) {
    const y = dateStr.substring(0, 4);
    const m = dateStr.substring(4, 6);
    const d = dateStr.substring(6, 8);
    const h = dateStr.substring(8, 10);
    const min = dateStr.substring(10, 12);
    const s = dateStr.substring(12, 14);
    return new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`).toISOString();
  }

  // 3. "YYYYMMDDHHMM" (12 digits)
  if (dateStr.match(/^\d{12}$/)) {
    const y = dateStr.substring(0, 4);
    const m = dateStr.substring(4, 6);
    const d = dateStr.substring(6, 8);
    const h = dateStr.substring(8, 10);
    const min = dateStr.substring(10, 12);
    return new Date(`${y}-${m}-${d}T${h}:${min}:00Z`).toISOString();
  }

  // 4. "YYYYMMDD" (8 digits - Date only)
  if (dateStr.match(/^\d{8}$/)) {
    const y = dateStr.substring(0, 4);
    const m = dateStr.substring(4, 6);
    const d = dateStr.substring(6, 8);
    // Assume mid-day or start of day? Let's say 00:00 UTC
    return new Date(`${y}-${m}-${d}T00:00:00Z`).toISOString();
  }

  // 3. "YYYYMMDDHHMM" (Compact without seconds - sometimes seen)
  if (dateStr.match(/^\d{12}$/)) {
    const y = dateStr.substring(0, 4);
    const m = dateStr.substring(4, 6);
    const d = dateStr.substring(6, 8);
    const h = dateStr.substring(8, 10);
    const min = dateStr.substring(10, 12);
    return new Date(`${y}-${m}-${d}T${h}:${min}:00Z`).toISOString();
  }

  // 3. Try standard parser
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
    return undefined;
  } catch (e) {
    return undefined;
  }
};

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
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
};

// Basic Vibe Definition
type VibeType = 'High Energy' | 'Chill' | 'Inspiration' | 'Intense' | 'Trending';

export const fetchGlobalEvents = async (limit: number = 60, vibe: VibeType = 'Trending', additionalQuery: string = ''): Promise<LocationMarker[]> => {
  try {
    // Construct Query based on Vibe
    // We try to exclude hard news (politics, military) and focus on cultural/emotional signals.
    let query = 'sourcelang:eng';

    // Base Filter: Exclude Boring/Hard Stuff
    const baseExclusions = '-theme:POLITICS -theme:MILITARY -theme:GOVERNMENT -theme:TAX_FNCACT -theme:LEGISLATION';

    switch (vibe) {
      case 'High Energy':
        // Keywords: Sport, Music, Festivals, Entertainment
        // "theme:SPORT" can be hit or miss, keywords are safer for "Vibe"
        query += ` (sport OR festival OR concert OR music OR premiere OR "red carpet" OR celebrity) ${baseExclusions}`;
        break;
      case 'Chill':
        // Keywords: Travel, Art, Nature
        query += ` (travel OR vacation OR beach OR park OR museum OR "art gallery" OR hiking OR nature) ${baseExclusions}`;
        break;
      case 'Inspiration':
        // Innovation, Education, Science (Working, keeping mostly same but adding keywords for safety)
        query += ` (theme:EDUCATION OR theme:SCIENCE OR theme:INNOVATION OR theme:CHARITY OR breakthrough OR discovery) ${baseExclusions}`;
        break;
      case 'Intense':
        // High visibility society/media events (Working)
        query += ` (theme:SOCIETY OR theme:MEDIA_MSM OR theme:CRISISLEX OR protest OR rally) ${baseExclusions}`;
        break;
      case 'Trending':
      default:
        // Broad Keywords for general interest
        query += ` (technology OR culture OR fashion OR movie OR viral OR film OR social) ${baseExclusions}`;
        break;
    }

    // Append Personalization
    if (additionalQuery) {
      // e.g. " (sport OR festival ...)" + " OR (US OR Cricket)"
      // Effectively doing: "Standard Vibe Stuff" OR "Personal Stuff"
      // But we want to ensure quality.
      // Actually, GDELT AND logic is strict.
      // If we want to *include* personalized stuff that might NOT be in the vibe, we use OR.
      // query = `(${query}) OR (${additionalQuery} ${baseExclusions})`; 
      // Simply appending it inside the big query string might result in fewer matches if implied AND.
      // GDELT default is AND.
      // Let's broaden the search query loosely.
      query += ` OR ${additionalQuery}`;
    }

    // 1. Fetch Geo 2.0 Data with custom query
    // Changed timespan to 24h for freshness
    // Added sortby=date to ensure we get the latest items
    // Added random cache buster to prevent browser/CDN caching of the exact same query
    const cacheBuster = Math.floor(Date.now() / (1000 * 60 * 5)); // Refresh cache every 5 minutes naturally, or use random for forced.
    // User wants "as soon as refresh", so let's use a true random buster.
    const uniqueReqId = Date.now();

    // Using timespan=24h for freshness. sortby=date (GeoJSON mode might not strictly support sortby, but it respects timespan).
    // Actually, GDELT GeoJSON mode doesn't strictly support `sortby` param in the URL same as the DOC API.
    // But `timespan` is respected.
    const response = await fetch(`https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&mode=PointData&format=geojson&timespan=24h&maxrows=${limit}&_t=${uniqueReqId}`);

    if (!response.ok) {
      throw new Error(`GDELT API error: ${response.statusText}`);
    }

    const data: GDELTResponse = await response.json();

    if (!data.features) {
      return [];
    }

    const markers: LocationMarker[] = data.features.map((feature, index) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      const props = feature.properties as any;

      // Location Name logic
      const locationName = props.name || props.cityname || props.adm1name || props.countryname || '';

      let title = 'Recent Story';
      let url = props.url || '';

      // Clean HTML Title
      if (props.html) {
        const linkMatch = props.html.match(/<a href="([^"]+)"[^>]*>(.*?)<\/a>/);
        if (linkMatch) {
          url = linkMatch[1];
          title = linkMatch[2];
        } else {
          title = props.html.replace(/<[^>]*>?/gm, '');
        }
      }

      // Simple pseudo-sentiment just to populate the field (GDELT GeoJSON doesn't send raw tone score in properties usually, 
      // but we filtered by it so we know the range).
      // We can randomize slightly for UI visualization if needed or set based on Vibe.
      let sentiment = 0;
      if (vibe === 'High Energy') sentiment = 7;
      if (vibe === 'Inspiration') sentiment = 8;
      if (vibe === 'Chill') sentiment = 5;

      // Parse date
      const parsedDate = parseGdeltDate(props.seendate);

      const marker: LocationMarker = {
        id: `event-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: decodeHtmlEntities(title),
        latitude: latitude,
        longitude: longitude,
        description: decodeHtmlEntities(title), // Fallback description
        type: 'Event',
        sourceUrl: url,
        postImageUrl: props.shareimage || props.socialimage || undefined,
        isUserPost: false,
        publishedAt: parsedDate || new Date().toISOString(),
        category: vibe, // Map Vibe to Category for UI display
        vibe: vibe,
        sentiment: sentiment,
        country: locationName || props.sourcecountry || props.countrycode || 'Global',
        region: props.adm1code || '',
        markerColor: [1, 0.8, 0] // Default Golden
      };

      // Recalculate Color based on Vibe
      if (vibe === 'Chill') marker.markerColor = [0.2, 0.9, 0.6]; // Cyan/Green
      if (vibe === 'High Energy') marker.markerColor = [1.0, 0.2, 0.5]; // Hot Pink
      if (vibe === 'Inspiration') marker.markerColor = [0.4, 0.5, 1.0]; // Blue

      return marker;
    }).filter(m => m !== null) as LocationMarker[];

    // 2. Fetch Rich Snippets (Hybrid Approach - Top 15)
    // We limit to 15 to keep initial load fast, but the UI can fetch more on demand.
    try {
      const topMarkers = markers.slice(0, 15);
      await Promise.all(topMarkers.map(async (marker) => {
        const details = await fetchEventDetails(marker.name);
        if (details) {
          if (details.newImage) marker.postImageUrl = details.newImage;
          if (details.newDate) marker.publishedAt = details.newDate;
          if (details.newDesc && details.newDesc !== marker.name) marker.description = details.newDesc;
        }
      }));
    } catch (err) { }

    return markers;

  } catch (error) {
    console.warn("Failed to fetch GDELT events:", error);
    return [];
  }
};

/**
 * Fetches rich context (snippet, image, date) for a specific event query.
 * Exposed for lazy-loading in the UI.
 */
export const fetchEventDetails = async (query: string): Promise<{ newImage?: string, newDate?: string, newDesc?: string } | null> => {
  try {
    const cleanTitle = query.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 60);
    if (cleanTitle.length < 5) return null;
    const encodedTitle = encodeURIComponent(cleanTitle);

    // Strategies to get the "Original" date:
    // 1. Use 'doc' API instead of 'context'.
    // 2. Sort by 'DateAsc' to find the EARLIEST mention (closest to publish time), 
    //    instead of the most recent ingest (which results in "Today").
    // 3. Widen timespan to '1w' to catch stories from a few days ago that are just peaking now.
    const queryUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query="${encodedTitle}"&mode=ArtList&maxrows=1&format=json&sort=DateAsc&timespan=1w`;

    const res = await fetch(queryUrl);
    if (!res.ok) return null;

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { return null; }

    if (json && json.articles && json.articles.length > 0) {
      const match = json.articles[0];
      if (match) {
        const result: any = {};

        if (match.socialimage) result.newImage = match.socialimage;

        if (match.seendate) {
          const contextDate = parseGdeltDate(match.seendate);
          if (contextDate) result.newDate = contextDate;
        }

        const snippet = match.snippet || match.extrasnippet || match.context || match.content;
        if (snippet) {
          result.newDesc = decodeHtmlEntities(snippet.replace(/\s+/g, ' ').trim());
        }

        return result;
      }
    }
    return null;
  } catch (error) {
    return null;
  }
};
