
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
                console.log("Engagement skipped: Frequency cap hit");
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
            } else {
                // Advanced Engagement
                await triggerExplorationNudge(userId, state);

                // Profile Stats Reminder (Random chance if they have history)
                if (state.visitedLocations.length > 5 && Math.random() > 0.7) {
                    await createNotification(userId, 'ENGAGEMENT_SAYS', {
                        message: `You've explored ${state.visitedLocations.length} locations. Check your stats!`,
                    });
                }
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

    // We rely on the notificationService to handle the creation, 
    // which in turn should trigger any listeners for UI updates.
    // Real push notifications would be handled by a backend trigger on the 'notifications' table usually,
    // or we can manually call a hypothetical sendPush here if we had a backend.

    // For now, we simulate the "Push" effect by creating the in-app notification 
    // which effectively "pings" the user when they open the app.
}

/**
 * AI-Driven Exploration Nudge
 * Uses DeepSeek to find unvisited places based on history
 */
async function triggerExplorationNudge(userId: string, state: UserState) {
    if (state.visitedLocations.length === 0) return;

    // DeepSeek Prompt
    const visitedStr = state.visitedLocations.slice(0, 5).join(", ");

    // Generate Recommendation
    const prompt = `
        User has visited: ${visitedStr}.
        Suggest 1 new, unvisited specific location (City or Landmark) they should explore next.
        Must be geographically relevant or thematically similar.
        Output JSON: { "location": "Name", "reason": "Short reason why" }
    `;

    try {
        const responseJson = await queryDeepSeek([
            { role: "system", content: "You are a travel recommender. Output strictly valid JSON." },
            { role: "user", content: prompt }
        ], true);

        const data = JSON.parse(responseJson);

        if (data.location) {
            await createNotification(userId, 'APP_TIP', {
                feature: `Mission: ${data.location}`,
                systemMessage: `Based on your travels to ${visitedStr.split(',')[0]}, intelligence suggests exploring ${data.location}. ${data.reason}`
            }, {
                actionPath: `/?search=${encodeURIComponent(data.location)}`
            });
        }
    } catch (e) {
        console.error("AI Recommendation Failed:", e);
    }
}
