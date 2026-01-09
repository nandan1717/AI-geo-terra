import { LocationMarker } from '../types';

// Basic Vibe Definition
type VibeType = 'High Energy' | 'Chill' | 'Inspiration' | 'Intense' | 'Trending';

export const fetchGlobalEvents = async (limit: number = 60, vibe: VibeType = 'Trending', additionalQuery: string = ''): Promise<LocationMarker[]> => {
  try {
    // Import supabase client
    const { supabase } = await import('./supabaseClient');

    let data: any[] | null = null;
    let error: any = null;

    // Use Edge Function for the main "Trending" feed to get Personalization
    if (vibe === 'Trending') {
      const response = await supabase.functions.invoke('serve-feed', {
        method: 'GET',
      });
      if (response.error) {
        console.warn("Edge Function served-feed failed, falling back to direct query:", response.error);
        // Fallback will happen below
      } else {
        console.log("Fetched personalized feed from Edge Function");
        data = response.data;
      }
    }

    // Fallback / Standard Query for other vibes or if Edge Function failed/returned nothing
    if (!data) {
      let query = supabase
        .from('gdelt_events')
        .select('*')
        .order('published_at', { ascending: false }) // Use published_at for recency
        .limit(limit);

      // Apply Filter based on Vibe
      if (vibe !== 'Trending') {
        query = query.eq('vibe', vibe);
      }

      const result = await query;
      data = result.data;
      error = result.error;
    }

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
    console.warn("Failed to fetch GDELT events:", error);
    return [];
  }
};

export const searchEvents = async (queryTerm: string): Promise<LocationMarker[]> => {
  try {
    const { supabase } = await import('./supabaseClient');
    // Calculate Start of Today (UTC) to ensure "Today's News"
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const dateString = startOfToday.toISOString();

    // 1. Search in Country (Location), Title, or Description
    // 2. Filter for THIS DAY only
    const { data, error } = await supabase
      .from('gdelt_events')
      .select('*')
      .or(`country.ilike.%${queryTerm}%,title.ilike.%${queryTerm}%,description.ilike.%${queryTerm}%`)
      .gte('published_at', dateString)
      .order('published_at', { ascending: false })
      .limit(30);

    if (error || !data) return [];

    return data.map((event: any) => ({
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
      markerColor: getMarkerColor(event.vibe as VibeType)
    }));
  } catch (e) {
    console.error("GDELT Search failed", e);
    return [];
  }
};

const getMarkerColor = (vibe: VibeType): [number, number, number] => {
  if (vibe === 'Chill') return [0.2, 0.9, 0.6]; // Cyan/Green
  if (vibe === 'High Energy') return [1.0, 0.2, 0.5]; // Hot Pink
  if (vibe === 'Inspiration') return [0.4, 0.5, 1.0]; // Blue
  return [1, 0.8, 0]; // Default Golden
};
