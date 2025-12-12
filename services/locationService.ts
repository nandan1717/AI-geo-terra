const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export interface LocationResult {
    id: string;
    name: string;
    place_name: string;
    center: [number, number]; // [lng, lat]
    country?: string;
    region?: string;
    continent?: string;
}

const getContinent = (countryCode: string | undefined): string | undefined => {
    if (!countryCode) return undefined;
    const c = countryCode.toUpperCase();
    if (['US', 'CA', 'MX', 'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA', 'JM', 'CU', 'BS', 'HT', 'DO'].includes(c)) return 'North America';
    if (['BR', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY', 'GY', 'SR'].includes(c)) return 'South America';
    if (['GB', 'FR', 'DE', 'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'IE', 'PL', 'GR', 'UA', 'RU', 'CZ', 'HU', 'RO'].includes(c)) return 'Europe';
    if (['CN', 'JP', 'IN', 'KR', 'ID', 'TH', 'VN', 'MY', 'PH', 'SG', 'SA', 'AE', 'IL', 'TR', 'PK', 'BD', 'LK'].includes(c)) return 'Asia';
    if (['AU', 'NZ', 'FJ', 'PG'].includes(c)) return 'Oceania';
    if (['EG', 'ZA', 'NG', 'KE', 'MA', 'GH', 'TZ', 'ET'].includes(c)) return 'Africa';
    if (['AQ'].includes(c)) return 'Antarctica';
    return undefined; // Let Gemini handle edge cases if null, or default to "Unknown"
};

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
            return data.features.map((feature: any) => {
                const context = feature.context || [];
                const country = context.find((c: any) => c.id.startsWith('country'))?.text;
                const countryCode = context.find((c: any) => c.id.startsWith('country'))?.short_code;
                const region = context.find((c: any) => c.id.startsWith('region'))?.text;
                const continent = getContinent(countryCode);

                return {
                    id: feature.id,
                    name: feature.text,
                    place_name: feature.place_name,
                    center: feature.center,
                    country,
                    region,
                    continent
                };
            });
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
