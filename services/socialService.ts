import { supabase } from './supabaseClient';

export interface Post {
    id: number;
    user_id: string;
    image_url: string;
    caption: string;
    location_name: string;
    location_lat: number;
    location_lng: number;
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

        // Delete from storage first (optional but good practice)
        // For now, just delete the record, cascade will handle likes/comments
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

    async fetchPosts(userId?: string) {
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

    async createPost(file: File, caption: string, location: { name: string, lat: number, lng: number }) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // 1. Upload Image
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
            .from('social_media')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('social_media')
            .getPublicUrl(fileName);

        // 2. Create Post Record
        const { data, error } = await supabase
            .from('app_posts')
            .insert({
                user_id: user.id,
                image_url: publicUrl,
                caption,
                location_name: location.name,
                location_lat: location.lat,
                location_lng: location.lng,
                is_hidden: false
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

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
    }
};
