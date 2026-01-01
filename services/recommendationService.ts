import { LocationMarker } from '../types';

interface InterestProfile {
    themes: Record<string, number>;
    countries: Record<string, number>;
    keywords: Record<string, number>; // For things like 'Space', 'AI', etc.
    lastUpdated: number;
}

const STORAGE_KEY = 'mortals_user_interests';
const MAX_SCORE = 100;
const DECAY_RATE = 0.95; // Decay scores by 5% on every significant update/session start

export const recommendationService = {

    getProfile(): InterestProfile {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.error("Failed to load interest profile", e);
        }
        return { themes: {}, countries: {}, keywords: {}, lastUpdated: Date.now() };
    },

    saveProfile(profile: InterestProfile) {
        profile.lastUpdated = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    },

    /**
     * Boosts scores based on interaction type.
     * CLICK = Strong Signal (+5)
     * VIEW/HOVER = Weak Signal (+1) - (To be implemented if needed)
     */
    trackInteraction(marker: LocationMarker, type: 'CLICK' | 'VIEW' = 'CLICK') {
        const profile = this.getProfile();
        const scoreToAdd = type === 'CLICK' ? 5 : 1;

        // 1. Track Country
        if (marker.country) {
            const current = profile.countries[marker.country] || 0;
            profile.countries[marker.country] = Math.min(MAX_SCORE, current + scoreToAdd);
        }

        // 2. Track Themes (from Category or inferred)
        if (marker.category) {
            const current = profile.themes[marker.category] || 0;
            profile.themes[marker.category] = Math.min(MAX_SCORE, current + scoreToAdd);
        }

        // 3. Track Keywords from Name (Simple Tokenization)
        // We filter for meaningful words (len > 4) to avoid "The", "And" clutter
        const words = (marker.name || "").split(/\s+/);
        words.forEach(w => {
            const clean = w.replace(/[^a-zA-Z]/g, '').toLowerCase();
            if (clean.length > 4) {
                const current = profile.keywords[clean] || 0;
                profile.keywords[clean] = Math.min(MAX_SCORE, current + (scoreToAdd * 0.5)); // Keywords weight less
            }
        });

        this.saveProfile(profile);
        // console.log("Updated Profile:", profile);
    },

    /**
     * Generates a GDELT-compatible OR query segment to mix in personalized results.
     * e.g. "(sourcelang:eng (theme:SPORT OR country:US))"
     */
    getPersonalizedQuery(): string {
        const profile = this.getProfile();
        const terms: string[] = [];

        // Top 3 Countries
        Object.entries(profile.countries)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 3)
            .forEach(([country]) => {
                // GDELT uses 'sourcecountry' or 'countryname' depending on api mode
                // usually simple keyword match helps for country name
                terms.push(`"${country}"`);
            });

        // Top 3 Themes
        Object.entries(profile.themes)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 3)
            .forEach(([theme]) => {
                terms.push(theme);
            });

        // Top 3 Keywords
        Object.entries(profile.keywords)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 3)
            .forEach(([keyword]) => {
                terms.push(keyword);
            });

        if (terms.length === 0) return "";

        // Join with OR to say "Show me stuff about A OR B OR C"
        // usage: query += " (term1 OR term2)"
        return `(${terms.join(' OR ')})`;
    },

    /**
     * Re-ranks a list of items based on similarity to user profile.
     */
    rankItems(items: LocationMarker[]): LocationMarker[] {
        const profile = this.getProfile();

        // Calculate scores for each item
        const scoredItems = items.map(item => {
            let score = 0;

            // Country Match
            if (item.country && profile.countries[item.country]) {
                score += profile.countries[item.country];
            }

            // Theme Match
            if (item.category && profile.themes[item.category]) {
                score += profile.themes[item.category];
            }

            // Keyword Match
            const words = (item.name || "").toLowerCase();
            Object.keys(profile.keywords).forEach(k => {
                if (words.includes(k)) {
                    score += profile.keywords[k];
                }
            });

            return { item, score };
        });

        // Sort descending by score
        scoredItems.sort((a, b) => b.score - a.score);

        return scoredItems.map(wrapper => wrapper.item);
    }
};
