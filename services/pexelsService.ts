
const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY || process.env.VITE_PEXELS_API_KEY;
const PEXELS_API_URL = "https://api.pexels.com/v1/search";

export interface PexelsPhoto {
    id: number;
    width: number;
    height: number;
    url: string;
    photographer: string;
    photographer_url: string;
    photographer_id: number;
    avg_color: string;
    src: {
        original: string;
        large2x: string;
        large: string;
        medium: string;
        small: string;
        portrait: string;
        landscape: string;
        tiny: string;
    };
    alt: string;
}

const PEXELS_VIDEO_API_URL = "https://api.pexels.com/videos/search";
let isRateLimited = false;

export interface PexelsVideo {
    id: number;
    width: number;
    height: number;
    url: string;
    image: string; // Thumbnail
    duration: number;
    user: {
        id: number;
        name: string;
        url: string;
    };
    video_files: {
        id: number;
        quality: 'hd' | 'sd' | 'hls'; // hd usually
        file_type: 'video/mp4';
        width: number;
        height: number;
        link: string; // The URL to play
    }[];
}

export const pexelsService = {
    /**
     * Searches for photos on Pexels.
     */
    searchPhotos: async (query: string, perPage: number = 1): Promise<PexelsPhoto[]> => {
        try {
            const response = await fetch(`${PEXELS_API_URL}?query=${encodeURIComponent(query)}&per_page=${perPage}`, {
                headers: {
                    Authorization: PEXELS_API_KEY
                }
            });

            if (!response.ok) return [];

            const data = await response.json();
            return data.photos || [];
        } catch (error) {
            console.error("Pexels Photo Request Failed:", error);
            return [];
        }
    },

    /**
     * Searches for VIDEOS on Pexels.
     * @param query Search term
     * @param perPage Number of results (default 1)
     */
    searchVideos: async (query: string, perPage: number = 1): Promise<PexelsVideo[]> => {
        if (isRateLimited) {
            console.warn("Pexels API Rate Limited - Skipping request");
            return [];
        }

        try {
            const response = await fetch(`${PEXELS_VIDEO_API_URL}?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=portrait`, {
                headers: {
                    Authorization: PEXELS_API_KEY
                }
            });

            if (response.status === 429) {
                console.warn("Pexels API Rate Limit Reached (429). Pausing requests for 60s.");
                isRateLimited = true;
                setTimeout(() => isRateLimited = false, 60000);
                return [];
            }

            if (!response.ok) {
                console.warn(`Pexels Video API Error: ${response.status}`);
                return [];
            }

            const data = await response.json();
            return data.videos || [];
        } catch (error) {
            console.error("Pexels Video Request Failed:", error);
            return [];
        }
    },

    /**
     * Fetches a curated list of photos from Supabase (previously populated by Edge Function).
     */
    getCuratedPhotos: async (perPage: number = 15): Promise<PexelsPhoto[]> => {
        try {
            const { supabase } = await import('./supabaseClient');
            const { data, error } = await supabase
                .from('pexels_media')
                .select('*')
                .eq('media_type', 'image')
                .order('created_at', { ascending: false })
                .limit(perPage);

            if (error) {
                console.error("Supabase Pexels Fetch Error:", error);
                return [];
            }
            if (!data) return [];

            return data.map((p: any) => ({
                id: p.id,
                width: 1920, // Default/Placeholder
                height: 1080, // Default/Placeholder
                url: p.url,
                photographer: p.photographer,
                photographer_url: '',
                photographer_id: 0,
                avg_color: '#333333',
                src: {
                    original: p.image_url,
                    large2x: p.image_url,
                    large: p.image_url,
                    medium: p.image_url,
                    small: p.image_url,
                    portrait: p.image_url,
                    landscape: p.image_url,
                    tiny: p.image_url
                },
                alt: p.caption || 'Pexels Photo'
            }));
        } catch (error) {
            console.error("Failed to fetch Pexels photos from Supabase:", error);
            return [];
        }
    },

    /**
     * Fetches curated photos with captions for StoryBar usage.
     * Returns raw data including caption for direct story generation.
     */
    getCuratedPhotosForStories: async (perPage: number = 10): Promise<{
        id: number;
        url: string;
        photographer: string;
        image_url: string;
        caption: string;
    }[]> => {
        try {
            const { supabase } = await import('./supabaseClient');
            const { data, error } = await supabase
                .from('pexels_media')
                .select('id, url, photographer, image_url, caption')
                .eq('media_type', 'image')
                .not('caption', 'is', null) // Only get items with captions
                .order('created_at', { ascending: false })
                .limit(perPage);

            if (error) {
                console.error("Supabase Pexels Stories Fetch Error:", error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error("Failed to fetch Pexels photos for stories:", error);
            return [];
        }
    }
};
