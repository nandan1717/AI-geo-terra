
import { supabase } from './supabaseClient';
import { createNotification } from './notificationService';
import { generatePushContent } from './notificationService';
import { queryDeepSeek } from './deepseekService';

interface UserState {
    hasProfile: boolean;
    postCount: number;
    lastLocation?: string;
    visitedLocations: string[];
    daysInactive: number;
    lastPostDate?: Date; // Added for engagement checks
}

export const engagementService = {
    /**
     * Main Entry Point: Analyze user and trigger next best action
     */
    checkAndEngage: async (userId: string) => {
        // Frequency Cap: Check if we already engaged today
        const lastEngaged = localStorage.getItem(`last_engagement_${userId}`);
        const now = new Date();
        if (lastEngaged) {
            const lastDate = new Date(lastEngaged);
            // Engage max once every 12 hours
            if (now.getTime() - lastDate.getTime() < 12 * 60 * 60 * 1000) {

                return;
            }
        }

        try {
            // 1. Gather State
            const state = await fetchUserState(userId);

            // 2. Determine Action
            // Enhanced Engagement Logic:
            const daysSincePost = state.postCount > 0 ? 0 : 999; // Simplified for now, should ideally check last_post_date

            if (!state.hasProfile) {
                await triggerNudge(userId, 'COMPLETE_PROFILE');
            } else if (state.postCount === 0) {
                await triggerNudge(userId, 'FIRST_POST');
            } else if (daysSincePost > 7) {
                // Remind to post if inactive
                await createNotification(userId, 'CONTENT_DROP', {
                    message: "It's been a while. Share your latest adventure.",
                });
            }

            // Update timestamp
            localStorage.setItem(`last_engagement_${userId}`, now.toISOString());

        } catch (error) {
            console.error("Engagement Check Failed:", error);
        }
    }
};

/**
 * Fetch detailed user state from Supabase
 */
async function fetchUserState(userId: string): Promise<UserState> {
    const { data: profile } = await supabase
        .from('app_profiles_v2')
        .select('full_name, location')
        .eq('id', userId)
        .single();

    // Check posts
    const { count, data: posts } = await supabase
        .from('app_posts')
        .select('location_name', { count: 'exact' })
        .eq('user_id', userId);

    const visited = posts?.map(p => p.location_name).filter(Boolean) as string[] || [];

    return {
        hasProfile: !!(profile?.full_name),
        postCount: count || 0,
        lastLocation: visited[0] || profile?.location,
        visitedLocations: [...new Set(visited)], // Unique locations
        daysInactive: 0 // TODO: Calculate from last_seen
    };
}

/**
 * Trigger a basic nudge notification
 */
async function triggerNudge(userId: string, type: 'COMPLETE_PROFILE' | 'FIRST_POST') {
    const content = await generatePushContent(type, { userName: 'Commander' });

    await createNotification(userId, 'APP_TIP', {
        feature: type === 'COMPLETE_PROFILE' ? 'User Profile' : 'Camera Uplink',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h expiry
    }, {
        actionPath: type === 'COMPLETE_PROFILE' ? '/profile' : '/'
    });
}
