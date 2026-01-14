import { LocationMarker } from '../types';

interface InterestProfile {
    themes: Record<string, number>;
    countries: Record<string, number>;
    keywords: Record<string, number>; // For things like 'Space', 'AI', etc.
    followedTopics?: string[]; // New: Explicit Follows
    topicExpirations?: Record<string, number>; // Check for expiration timestamps
    lastUpdated: number;
}

const STORAGE_KEY_PREFIX = 'mortals_user_interests_';
const MAX_SCORE = 100;
const DECAY_RATE = 0.95; // Decay scores by 5% on every significant update/session start

// Cache current user ID to avoid repeated async calls
let _currentUserId: string | null = null;

export const recommendationService = {

    // Set the current user ID (call on login)
    setCurrentUser(userId: string) {
        _currentUserId = userId;
    },

    // Clear user data (call on logout)
    clearCurrentUser() {
        _currentUserId = null;
    },

    // Get user-specific storage key
    _getStorageKey(): string {
        if (_currentUserId) {
            return `${STORAGE_KEY_PREFIX}${_currentUserId}`;
        }
        // Fallback to legacy key for migration (will be overwritten on next sync)
        return 'mortals_user_interests';
    },

    getProfile(): InterestProfile {
        try {
            const raw = localStorage.getItem(this._getStorageKey());
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.error("Failed to load interest profile", e);
        }
        return { themes: {}, countries: {}, keywords: {}, lastUpdated: Date.now() };
    },

    saveProfile(profile: InterestProfile) {
        profile.lastUpdated = Date.now();
        localStorage.setItem(this._getStorageKey(), JSON.stringify(profile));
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

    // Explicit Follows
    async follow(topic: string, duration: '12h' | '1w' | '30d' | 'forever' = 'forever') {
        const profile = this.getProfile();
        if (!profile.followedTopics) profile.followedTopics = [];

        const normalized = topic.trim().toLowerCase();

        // Add to list if not present
        if (!profile.followedTopics.includes(normalized)) {
            profile.followedTopics.push(normalized);
        }

        // Calculate Expiration
        let expiresAt: number | null = null;
        const now = Date.now();
        if (duration === '12h') expiresAt = now + 12 * 60 * 60 * 1000;
        else if (duration === '1w') expiresAt = now + 7 * 24 * 60 * 60 * 1000;
        else if (duration === '30d') expiresAt = now + 30 * 24 * 60 * 60 * 1000;

        // Update Meta
        // We store meta in a separate key in local storage to keep InterestProfile clean-ish, 
        // or just extend InterestProfile. Let's extend it dynamically or use a text map.
        // For simplicity in this key-value interaction, let's assume we add a 'topicMeta' field to InterestProfile interface inside the function.
        // But since we can't easily change the interface in this replace block without changing the top of the file, 
        // we'll assume the sync to DB sends the meta map constructed on the fly or we modify the profile object loosely.

        // Actually, let's just create the meta object for the DB sync.
        // For local storage, we might need to store it to persist across reloads.
        // Let's add it to the profile object as 'topicExpirations'.

        const profileAny = profile as any;
        if (!profileAny.topicExpirations) profileAny.topicExpirations = {};
        if (expiresAt) {
            profileAny.topicExpirations[normalized] = expiresAt;
        } else {
            delete profileAny.topicExpirations[normalized]; // Forever = no expiration
        }

        this.saveProfile(profile);

        // Sync to DB
        try {
            const { supabase } = await import('./supabaseClient');
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from('app_profiles_v2')
                    .update({
                        followed_topics: profile.followedTopics,
                        followed_topics_meta: profileAny.topicExpirations
                    })
                    .eq('id', user.id);
            }
        } catch (e) {
            console.warn("Failed to sync follow to DB", e);
        }
    },

    async unfollow(topic: string) {
        const profile = this.getProfile();
        if (!profile.followedTopics) return;

        const normalized = topic.trim().toLowerCase();
        profile.followedTopics = profile.followedTopics.filter(t => t !== normalized);

        const profileAny = profile as any;
        if (profileAny.topicExpirations) {
            delete profileAny.topicExpirations[normalized];
        }

        this.saveProfile(profile);

        // Sync to DB
        try {
            const { supabase } = await import('./supabaseClient');
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from('app_profiles_v2')
                    .update({
                        followed_topics: profile.followedTopics,
                        followed_topics_meta: profileAny.topicExpirations
                    })
                    .eq('id', user.id);
            }
        } catch (e) {
            console.warn("Failed to sync unfollow to DB", e);
        }
    },

    isFollowing(topic: string): boolean {
        const profile = this.getProfile();
        const normalized = topic.trim().toLowerCase();
        if (!(profile.followedTopics || []).includes(normalized)) return false;

        // Check Expiration
        const profileAny = profile as any;
        if (profileAny.topicExpirations && profileAny.topicExpirations[normalized]) {
            if (Date.now() > profileAny.topicExpirations[normalized]) {
                // Expired! Lazy delete? 
                // For UI responsiveness, just say false. Cleanup can happen on sync.
                return false;
            }
        }
        return true;
    },

    /**
     * Syncs local profile with Database (called on startup)
     */
    async syncProfile() {
        try {
            const { supabase } = await import('./supabaseClient');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) return;

            const { data, error } = await supabase
                .from('app_profiles_v2')
                .select('followed_topics, followed_topics_meta')
                .eq('id', user.id)
                .single();

            if (data) {
                const profile = this.getProfile();
                const profileAny = profile as any;

                // Sync Lists
                const localList = new Set(profile.followedTopics || []);
                if (data.followed_topics) {
                    data.followed_topics.forEach((t: string) => localList.add(t));
                }
                profile.followedTopics = Array.from(localList);

                // Sync Meta
                if (data.followed_topics_meta) {
                    profileAny.topicExpirations = { ...(profileAny.topicExpirations || {}), ...data.followed_topics_meta };
                }

                // Cleanup Expired
                const now = Date.now();
                if (profileAny.topicExpirations) {
                    // Check all topics
                    const validTopics: string[] = [];
                    profile.followedTopics.forEach(t => {
                        const exp = profileAny.topicExpirations[t];
                        if (!exp || exp > now) {
                            validTopics.push(t);
                        } else {
                            // Expired
                            delete profileAny.topicExpirations[t];
                        }
                    });
                    // Note: We are currently NOT removing them from the text array 'followedTopics' permanently in the DB here 
                    // to avoid aggressive deletion, but `isFollowing` will return false.
                    // The edge function will also filter them out.
                    // Optionally we could update key `followedTopics` here to remove expired ones.
                }

                this.saveProfile(profile);
            }
        } catch (e) {
            console.warn("Profile sync failed", e);
        }
    },

    /**
     * Generates a GDELT-compatible OR query segment to mix in personalized results.
     * e.g. "(sourcelang:eng (theme:SPORT OR country:US))"
     */
    getPersonalizedQuery(): string {
        const profile = this.getProfile();

        // STRICT FILTERING: If User Follows topics, show ONLY those (as requested).
        if (profile.followedTopics && profile.followedTopics.length > 0) {
            const terms = profile.followedTopics.map(t => `"${t}"`); // Quote for exact phrase match
            return `(${terms.join(' OR ')})`;
        }

        // --- Standard Implicit Interest Logic (Fallback) ---
        const terms: string[] = [];

        // Top 3 Countries
        Object.entries(profile.countries)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 3)
            .forEach(([country]) => {
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
        return `(${terms.join(' OR ')})`;
    },

    /**
     * Re-ranks a list of items based on similarity to user profile.
     */
    rankItems(items: LocationMarker[]): LocationMarker[] {
        const profile = this.getProfile();
        const follows = profile.followedTopics || [];

        // Calculate scores for each item
        const scoredItems = items.map(item => {
            let score = 0;

            // Followed Topic (Massive Boost)
            const combinedText = (item.name + " " + (item.country || "")).toLowerCase();
            follows.forEach(f => {
                if (combinedText.includes(f)) score += 500;
            });

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
