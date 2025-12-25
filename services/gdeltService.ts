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

export const fetchGlobalEvents = async (limit: number = 60): Promise<LocationMarker[]> => {
  try {
    // 1. Fetch Geo 2.0 Data (For Coordinates & Initial Location Name)
    // We fetch a larger batch (e.g. 60) to allow for client-side pagination/buffering
    const response = await fetch(`https://api.gdeltproject.org/api/v2/geo/geo?query=sourcelang:eng&mode=PointData&format=geojson&timespan=24h&maxrows=${limit}`);

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

      let title = 'Breaking News';
      let url = props.url || '';

      if (props.html) {
        const linkMatch = props.html.match(/<a href="([^"]+)"[^>]*>(.*?)<\/a>/);
        if (linkMatch) {
          url = linkMatch[1];
          title = linkMatch[2];
        } else {
          title = props.html.replace(/<[^>]*>?/gm, '');
        }
      }

      // Categorization
      const lowerTitle = title.toLowerCase();
      let category: LocationMarker['category'] = 'General';
      let markerColor: [number, number, number] = [0.2, 0.4, 1.0];

      if (lowerTitle.match(/climate|environment|pollution|forest|ecology|carbon|warming/)) {
        category = 'Environmental';
        markerColor = [1, 0.2, 0.2];
      } else if (lowerTitle.match(/development|economy|growth|infrastructure|business|market|trade/)) {
        category = 'Development';
        markerColor = [0.2, 1.0, 0.2];
      } else if (lowerTitle.match(/war|conflict|fight|attack|military/)) {
        category = 'Conflict';
        markerColor = [1.0, 0.6, 0.0];
      }

      // Parse date safely. If undefined, we use new Date() ONLY as a last resort in the valid object, 
      // but ideally we want the real date. 
      // Geo API usually returns 'seendate' in YYYYMMDDTHHMMSSZ format.
      const parsedDate = parseGdeltDate(props.seendate);

      return {
        id: `event-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: decodeHtmlEntities(title),
        latitude: latitude,
        longitude: longitude,
        description: decodeHtmlEntities(title), // Fallback
        type: 'Event',
        sourceUrl: url,
        postImageUrl: props.shareimage || props.socialimage || undefined,
        isUserPost: false,
        // If parsedDate is undefined, falling back to ISO string of now is standard behavior for "Live" feed,
        // but user wants to know it's NOT from "now" if possible. 
        // We'll keep the fallback but rely on improved parsing to catch the real date.
        publishedAt: parsedDate || new Date().toISOString(),
        category,
        markerColor,
        country: locationName || props.sourcecountry || props.countrycode || 'Global',
        region: props.adm1code || '',
      };
    }).filter(m => m !== null) as LocationMarker[];

    // 2. Fetch Rich Snippets (Hybrid Approach - Parallel Requests)
    // Only fetch context for the FIRST 15 to save bandwidth, defer others or let UI handle it?
    // Actually, for the "Reels" experience, we need images/snippets. 
    // We'll fetch context for the top 15 to ensure the first batch is rich.
    try {
      const topMarkers = markers.slice(0, 15);

      await Promise.all(topMarkers.map(async (marker) => {
        try {
          const cleanTitle = marker.name.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 60);
          const encodedTitle = encodeURIComponent(cleanTitle);

          if (cleanTitle.length < 5) return;

          const queryUrl = `https://api.gdeltproject.org/api/v2/context/context?query="${encodedTitle}"&mode=ArtList&maxrows=1&format=json&timespan=24h`;

          const res = await fetch(queryUrl);
          if (!res.ok) return;

          const text = await res.text();
          let json;
          try {
            json = JSON.parse(text);
          } catch (e) {
            return;
          }

          if (json && json.articles && json.articles.length > 0) {
            const match = json.articles[0];

            if (match) {
              if (marker.country === 'Global' && match.sourcecountry) {
                marker.country = match.sourcecountry;
              }
              if (!marker.postImageUrl && match.socialimage) {
                marker.postImageUrl = match.socialimage;
              }

              // Update timestamp if available
              if (match.seendate) {
                const contextDate = parseGdeltDate(match.seendate);
                if (contextDate) {
                  marker.publishedAt = contextDate;
                }
              }

              const snippet = match.snippet || match.extrasnippet || match.context || match.content || match.title;

              if (snippet && snippet !== marker.name) {
                marker.description = decodeHtmlEntities(snippet.replace(/\s+/g, ' ').trim());
              }
            }
          }
        } catch (innerErr) {
          // Ignore individual fetch errors
        }
      }));

    } catch (err) {
      console.warn('Batch Context fetch failed:', err);
    }

    return markers;

  } catch (error) {
    console.warn("Failed to fetch GDELT events:", error);
    return [];
  }
};
