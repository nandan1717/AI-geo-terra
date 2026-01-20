import { supabase } from './supabaseClient';

export interface Post {
    id: number;
    user_id: string;
    image_url?: string; // Optional for text-only
    caption: string;
    location_name?: string; // Optional for text-only
    location_lat?: number;
    location_lng?: number;
    created_at: string;
    user: {
        username: string;
        full_name: string;
        avatar_url: string;
    };
    likes_count: number;
    comments_count: number;
    has_liked: boolean;
    is_hidden?: boolean;
    xp_earned?: number;
    country?: string;
    region?: string;
    continent?: string;
    rarity_score: number;
    is_extraordinary: boolean;
}

export interface Comment {
    id: number;
    user_id: string;
    content: string;
    created_at: string;
    user: {
        username: string;
        full_name: string;
        avatar_url: string;
    };
}

export const socialService = {
    async updatePost(postId: number, updates: { caption?: string, location_name?: string, location_lat?: number, location_lng?: number }) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase
            .from('app_posts')
            .update(updates)
            .eq('id', postId)
            .eq('user_id', user.id);

        if (error) throw error;
    },

    async deletePost(postId: number) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // 1. Fetch Post for Rollback
        const { data: post } = await supabase.from('app_posts').select('*').eq('id', postId).single();

        if (post && post.xp_earned > 0) {
            const { data: profile } = await supabase.from('app_profiles_v2').select('*').eq('id', user.id).single();
            if (profile) {
                const newXP = Math.max(0, (profile.xp || 0) - post.xp_earned);
                const newLevel = Math.floor(newXP / 1000) + 1;

                const regionStats = profile.region_stats || {};
                if (post.region && regionStats[post.region]) {
                    regionStats[post.region] = Math.max(0, regionStats[post.region] - post.xp_earned);
                    if (regionStats[post.region] <= 0) delete regionStats[post.region];
                }

                let visitedRegions = profile.visited_regions || [];
                if (post.region) {
                    // Check if this was the last post in this region
                    const { count } = await supabase.from('app_posts').select('*', { count: 'exact', head: true })
                        .eq('user_id', user.id).eq('region', post.region).neq('id', postId);
                    if (count === 0) visitedRegions = visitedRegions.filter((r: string) => r !== post.region);
                }

                let visitedCountries = profile.visited_countries || [];
                if (post.country) {
                    const { count } = await supabase.from('app_posts').select('*', { count: 'exact', head: true })
                        .eq('user_id', user.id).eq('country', post.country).neq('id', postId);
                    if (count === 0) visitedCountries = visitedCountries.filter((c: string) => c !== post.country);
                }

                let visitedContinents = profile.visited_continents || [];
                if (post.continent) {
                    const { count } = await supabase.from('app_posts').select('*', { count: 'exact', head: true })
                        .eq('user_id', user.id).eq('continent', post.continent).neq('id', postId);
                    if (count === 0) visitedContinents = visitedContinents.filter((c: string) => c !== post.continent);
                }

                await socialService.updateProfile({
                    xp: newXP,
                    level: newLevel,
                    region_stats: regionStats,
                    visited_regions: visitedRegions,
                    visited_countries: visitedCountries,
                    visited_continents: visitedContinents
                } as any);
            }
        }

        const { error } = await supabase
            .from('app_posts')
            .delete()
            .eq('id', postId)
            .eq('user_id', user.id);

        if (error) throw error;
    },

    async toggleHidePost(postId: number, isHidden: boolean) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase
            .from('app_posts')
            .update({ is_hidden: isHidden })
            .eq('id', postId)
            .eq('user_id', user.id);

        if (error) throw error;
    },

    async fetchPosts(userId?: string, postType?: 'global' | 'story' | 'local', since?: string) {
        const { data: { user } } = await supabase.auth.getUser();

        let query = supabase
            .from('app_posts')
            .select(`
                *,
                user:app_profiles_v2(username, full_name, avatar_url),
                likes:app_likes(count),
                comments:app_comments(count)
            `)
            .order('created_at', { ascending: false });

        if (userId) {
            query = query.eq('user_id', userId);
        }

        if (postType) {
            query = query.eq('post_type', postType);
        }

        if (since) {
            query = query.gte('created_at', since);
        }

        // If logged in, show own hidden posts + all visible posts
        // If not logged in, show only visible posts
        // RLS should handle this, but for client-side filtering/logic:
        // We can't easily do "OR" with complex conditions in one simple query without RLS.
        // Assuming RLS allows viewing all posts, we filter here or trust RLS.
        // Better: Fetch all, then filter in memory if needed, or rely on RLS policies.
        // For now, let's assume we fetch all and the UI handles the "Hidden" tag for the owner.
        // But we should filter out hidden posts for OTHERS.

        const { data, error } = await query;
        if (error) throw error;

        let userLikes: number[] = [];
        if (user) {
            const { data: likes } = await supabase
                .from('app_likes')
                .select('post_id')
                .eq('user_id', user.id);
            if (likes) userLikes = likes.map(l => l.post_id);
        }

        return data
            .filter(post => !post.is_hidden || (user && post.user_id === user.id))
            .map(post => ({
                ...post,
                likes_count: post.likes[0]?.count || 0,
                comments_count: post.comments[0]?.count || 0,
                has_liked: userLikes.includes(post.id)
            }));
    },

    async fetchGlobalPosts() {
        return this.fetchPosts(undefined, 'global');
    },

    async createPost(
        file: File | null,
        caption: string,
        location: { name: string, lat: number, lng: number, region?: string, country?: string, continent?: string } | null,
        rarity?: { score: number, isExtraordinary: boolean, continent?: string | null },
        postType: 'global' | 'story' | 'local' = 'local'
    ) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        let publicUrl = null;
        let xpGained = 0;
        let finalLocation: {
            name: string | null;
            lat: number | null;
            lng: number | null;
            country?: string | null;
            region?: string | null;
            continent?: string | null;
        } = {
            name: null,
            lat: null,
            lng: null,
            country: null,
            region: null,
            continent: null
        };

        // 1. Handle Image Upload (If file is provided)
        if (file) {

            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('social_media')
                .upload(fileName, file);

            if (uploadError) {
                console.error("Upload failed:", uploadError);
                throw uploadError;
            }

            const { data: { publicUrl: url } } = supabase.storage
                .from('social_media')
                .getPublicUrl(fileName);


            publicUrl = url;
        }

        // 2. Handle Location Stats & XP (Only if Location is provided)
        if (location) {
            finalLocation = { ...location };
            xpGained = 1;

            // Fetch current profile for Stats Update
            const { data: profile } = await supabase
                .from('app_profiles_v2')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profile) {
                // Update Stats (Visited Lists) - No extra XP, just tracking
                const visitedRegions = profile.visited_regions || [];
                if (location.region && !visitedRegions.includes(location.region)) {
                    visitedRegions.push(location.region);
                }

                const visitedCountries = profile.visited_countries || [];
                if (location.country && !visitedCountries.includes(location.country)) {
                    visitedCountries.push(location.country);
                }

                const visitedContinents = profile.visited_continents || [];
                const continent = rarity?.continent || location.continent;
                if (continent && !visitedContinents.includes(continent)) {
                    visitedContinents.push(continent);
                }

                // Update Profile Stats
                const newXP = (profile.xp || 0) + xpGained;
                const newLevel = Math.floor(newXP / 1000) + 1;

                // Region Stats
                const regionStats = profile.region_stats || {};
                if (location.region) {
                    regionStats[location.region] = (regionStats[location.region] || 0) + xpGained;
                }

                await socialService.updateProfile({
                    xp: newXP,
                    level: newLevel,
                    region_stats: regionStats,
                    visited_regions: visitedRegions,
                    visited_countries: visitedCountries,
                    visited_continents: visitedContinents
                } as any);
            }
        }

        // 3. Create Post Record
        const { data, error } = await supabase
            .from('app_posts')
            .insert({
                user_id: user.id,
                image_url: publicUrl,
                caption: caption,
                location_name: finalLocation.name,
                location_lat: finalLocation.lat,
                location_lng: finalLocation.lng,
                is_hidden: false,
                xp_earned: xpGained,
                rarity_score: rarity?.score || 0,
                is_extraordinary: rarity?.isExtraordinary || false,
                country: finalLocation.country,
                region: finalLocation.region,
                continent: rarity?.continent || finalLocation.continent,
                post_type: postType
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Internal helper to avoid circular dependency if possible, or just use the existing one
    // But wait, `updateProfile` above calls `supabase.from('app_profiles_v2').update...`
    // I used `facebookService.updateProfile` in the code above, which is WRONG. It should be `socialService`.


    async toggleLike(postId: number, hasLiked: boolean) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        if (hasLiked) {
            // Unlike
            const { error } = await supabase
                .from('app_likes')
                .delete()
                .eq('post_id', postId)
                .eq('user_id', user.id);
            if (error) throw error;
        } else {
            // Like
            const { error } = await supabase
                .from('app_likes')
                .insert({
                    post_id: postId,
                    user_id: user.id
                });
            if (error) throw error;
        }
    },

    async getComments(postId: number) {
        const { data, error } = await supabase
            .from('app_comments')
            .select(`
                *,
                user:app_profiles_v2(username, full_name, avatar_url)
            `)
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data;
    },

    async addComment(postId: number, content: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data, error } = await supabase
            .from('app_comments')
            .insert({
                post_id: postId,
                user_id: user.id,
                content
            })
            .select(`
                *,
                user:app_profiles_v2(username, full_name, avatar_url)
            `)
            .single();

        if (error) throw error;
        return data;
    },

    async updateProfile(updates: { full_name?: string, bio?: string, occupation?: string, location?: string, avatar_url?: string }) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase
            .from('app_profiles_v2')
            .update(updates)
            .eq('id', user.id);

        if (error) throw error;
    },

    async uploadAvatar(file: File) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const fileExt = file.name.split('.').pop();
        const fileName = `avatars/${user.id}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('social_media')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('social_media')
            .getPublicUrl(fileName);

        return publicUrl;
    },

    async getRecentUsers(limit: number = 20) {
        const { data, error } = await supabase
            .from('app_profiles_v2')
            .select('id, username, full_name, avatar_url, occupation, location, bio')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    async searchUsers(query: string) {
        if (!query || query.length < 2) return [];

        const { data, error } = await supabase
            .from('app_profiles_v2')
            .select('id, username, full_name, avatar_url, occupation, location, bio')
            .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
            .limit(20);

        if (error) throw error;
        return data || [];
    }
};
