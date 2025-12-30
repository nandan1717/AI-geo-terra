
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
        try {
            const response = await fetch(`${PEXELS_VIDEO_API_URL}?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=portrait`, {
                headers: {
                    Authorization: PEXELS_API_KEY
                }
            });

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
     * Fetches a curated list of photos (if needed, otherwise just uses search with generic terms)
     */
    getCuratedPhotos: async (perPage: number = 15): Promise<PexelsPhoto[]> => {
        try {
            const response = await fetch(`https://api.pexels.com/v1/curated?per_page=${perPage}`, {
                headers: {
                    Authorization: PEXELS_API_KEY
                }
            });

            if (!response.ok) return [];
            const data = await response.json();
            return data.photos || [];
        } catch (error) {
            return [];
        }
    }
};
