import { supabase } from './supabaseClient';
import { UserProfile } from '../types';
import { PORTRAIT_DATA } from './portraitLibrary';

export class ProfileService {

    /**
     * Fetch a profile by ID.
     * Handles RLS errors (returns null if private and not connected).
     */
    static async getProfile(userId: string): Promise<UserProfile | null> {
        const { data, error } = await supabase
            .from('app_profiles_v2')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.warn("Error fetching profile (might be private):", error.message);
            return null;
        }
        return data as UserProfile;
    }

    /**
     * Update the current user's profile.
     */
    static async updateProfile(updates: Partial<UserProfile>) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase
            .from('app_profiles_v2')
            .update(updates)
            .eq('id', user.id);

        if (error) throw error;
    }

    /**
     * Set Avatar from Library
     */
    static async setLibraryAvatar(gender: 'male' | 'female', age: number) {
        const isOld = age > 45;
        let key = gender === 'female' ? 'female' : 'male';
        key += isOld ? '_old' : '_young';

        // @ts-ignore
        const list = PORTRAIT_DATA[key] || PORTRAIT_DATA.default;
        const url = list[Math.floor(Math.random() * list.length)];

        await this.updateProfile({
            avatar_url: url,
            avatar_source: 'library'
        });

        return url;
    }

    /**
     * Check connection status between two users
     */
    static async getConnectionStatus(targetId: string): Promise<'none' | 'pending' | 'accepted'> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return 'none';

        const { data } = await supabase
            .from('app_connections_v2')
            .select('status')
            .or(`and(requester_id.eq.${user.id},target_id.eq.${targetId}),and(requester_id.eq.${targetId},target_id.eq.${user.id})`)
            .maybeSingle();

        return data?.status || 'none';
    }

    /**
     * Send connection request
     */
    static async sendConnectionRequest(targetId: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase
            .from('app_connections_v2')
            .insert({
                requester_id: user.id,
                target_id: targetId,
                status: 'pending'
            });

        if (error) throw error;

        // Get requester profile for notification
        const requesterProfile = await this.getProfile(user.id);

        // Send notification to target user
        import('./notificationService').then(({ createNotification }) => {
            createNotification(targetId, 'FRIEND_REQUEST', {
                requesterName: requesterProfile?.full_name || requesterProfile?.username || 'Someone',
                requesterId: user.id,
                requesterAvatar: requesterProfile?.avatar_url
            }, {
                friendRequest: {
                    requesterId: user.id,
                    requesterName: requesterProfile?.full_name || requesterProfile?.username || 'Someone',
                    requesterAvatar: requesterProfile?.avatar_url
                }
            });
        });
    }

    /**
     * Accept connection request
     */
    static async acceptConnectionRequest(requesterId: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase
            .from('app_connections_v2')
            .update({ status: 'accepted' })
            .eq('requester_id', requesterId)
            .eq('target_id', user.id);

        if (error) throw error;

        // Get accepter profile for notification
        const accepterProfile = await this.getProfile(user.id);

        // Send notification to requester
        import('./notificationService').then(({ createNotification }) => {
            createNotification(requesterId, 'FRIEND_ACCEPTED', {
                friendName: accepterProfile?.full_name || accepterProfile?.username || 'Someone',
                friendId: user.id,
                friendAvatar: accepterProfile?.avatar_url
            }, {
                friendAccepted: {
                    friendId: user.id,
                    friendName: accepterProfile?.full_name || accepterProfile?.username || 'Someone',
                    friendAvatar: accepterProfile?.avatar_url
                }
            });
        });
    }
}
