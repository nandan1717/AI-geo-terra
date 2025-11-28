const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export interface LocationResult {
    id: string;
    name: string;
    place_name: string;
    center: [number, number]; // [lng, lat]
}

export const locationService = {
    async searchPlaces(query: string): Promise<LocationResult[]> {
        if (!query || query.length < 3) return [];
        if (!MAPBOX_ACCESS_TOKEN) {
            console.error("Mapbox Access Token is missing!");
            return [];
        }

        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=10`
            );

            if (!response.ok) throw new Error("Mapbox API error");

            const data = await response.json();
            return data.features.map((feature: any) => ({
                id: feature.id,
                name: feature.text,
                place_name: feature.place_name,
                center: feature.center
            }));
        } catch (error) {
            console.error("Error searching places:", error);
            return [];
        }
    },

    async reverseGeocode(lat: number, lng: number): Promise<string> {
        if (!MAPBOX_ACCESS_TOKEN) return "Unknown Location";

        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=place,locality,neighborhood,address&limit=1`
            );

            if (!response.ok) throw new Error("Mapbox API error");

            const data = await response.json();
            if (data.features && data.features.length > 0) {
                return data.features[0].place_name; // Or feature.text for shorter name
            }
            return "Unknown Location";
        } catch (error) {
            console.error("Error reverse geocoding:", error);
            return "Unknown Location";
        }
    }
};
