import { LocationMarker } from '../types';

// Basic Vibe Definition
type VibeType = 'High Energy' | 'Chill' | 'Inspiration' | 'Intense' | 'Trending';

export const fetchGlobalEvents = async (limit: number = 60, vibe: VibeType = 'Trending', additionalQuery: string = ''): Promise<LocationMarker[]> => {
  try {
    // Import supabase client
    const { supabase } = await import('./supabaseClient');

    // Query Supabase
    let query = supabase
      .from('gdelt_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply Filter based on Vibe
    // We store vibe in the DB.
    if (vibe !== 'Trending') {
      query = query.eq('vibe', vibe);
    }
    // For 'Trending', we might want everything or just 'Trending'. 
    // Usually 'Trending' view shows a mix, but let's stick to strict if usage implies categorization.
    // If the user wants "Global" mixed feed, they might pass Trending.
    // If we only fetch "Trending" tagged items, we miss others.
    // Let's assume Trending means "Show me everything" or specific "Trending" tag.
    // In Edge Function we fetch specific vibes.

    // If additionalQuery is present, we can't easily filter by it in Supabase unless we have full text search.
    // We'll rely on the DB feed for now as requested.

    const { data, error } = await query;

    if (error) {
      console.error("Supabase GDELT Fetch Error:", error);
      return [];
    }

    if (!data) return [];

    const markers: LocationMarker[] = data.map((event: any) => ({
      id: event.id,
      name: event.title,
      latitude: event.latitude,
      longitude: event.longitude,
      description: event.description || event.title,
      type: 'Event',
      sourceUrl: event.source_url,
      postImageUrl: event.image_url,
      isUserPost: false,
      publishedAt: event.published_at,
      category: event.vibe,
      vibe: event.vibe as VibeType,
      sentiment: event.sentiment,
      country: event.country,
      region: '', // DB doesn't have region right now
      markerColor: getMarkerColor(event.vibe as VibeType)
    }));

    return markers;

  } catch (error) {
    console.warn("Failed to fetch GDELT events from Supabase:", error);
    return [];
  }
};

const getMarkerColor = (vibe: VibeType): [number, number, number] => {
  if (vibe === 'Chill') return [0.2, 0.9, 0.6]; // Cyan/Green
  if (vibe === 'High Energy') return [1.0, 0.2, 0.5]; // Hot Pink
  if (vibe === 'Inspiration') return [0.4, 0.5, 1.0]; // Blue
  return [1, 0.8, 0]; // Default Golden
};
