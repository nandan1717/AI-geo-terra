import { supabase } from './supabaseClient';
import { Notification, NotificationType, NotificationData } from '../types';
import { queryDeepSeek } from './deepseekService';

// Mock notifications for demo mode (fallback if Supabase fails or for testing)
const mockNotifications: Notification[] = [];
let mockListeners: Array<(notifications: Notification[]) => void> = [];

/**
 * Generate AI-powered notification content using DeepSeek
 */
const generateAINotification = async (
    type: NotificationType,
    context: Record<string, any>
): Promise<{ title: string; message: string }> => {
    try {
        const systemPrompt = `You are the voice of "Mortals", a vibrant social connection app connecting people across the globe.
Your tone is warm, engaging, human, and slightly playful. You are NOT a robot or a space commander.
You are a community builder who loves bringing people together.
Use emojis effectively to convey emotion. Keep notifications concise (title: max 40 chars, message: max 120 chars).
Focus on human connection, discovery, and shared experiences.`;

        let userPrompt = '';

        switch (type) {
            case 'FRIEND_REQUEST':
                userPrompt = `Write a notification that ${context.requesterName} wants to be friends. Make it sound like a great opportunity to connect.`;
                break;
            case 'FRIEND_ACCEPTED':
                userPrompt = `Write a celebratory notification that ${context.friendName} accepted the friend request. Make it feel like the start of a great friendship.`;
                break;
            case 'LOGIN':
                userPrompt = `Write a warm "welcome back" notification for ${context.userName}. Ask them what they want to explore or who they want to meet today. Time of day: ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}.`;
                break;
            case 'WELCOME':
                userPrompt = `Write an enthusiastic first-time welcome for ${context.userName}. Welcome them to the Mortals community and encourage them to find their tribe.`;
                break;
            case 'APP_TIP':
                userPrompt = `Share a quick tip about ${context.feature}. Make it sound like a helpful friend sharing a secret.`;
                break;
            case 'SYSTEM':
                userPrompt = `Write a system update about: ${context.systemMessage}. Keep it clear but friendly.`;
                break;
            default:
                userPrompt = `Create a notification with context: ${JSON.stringify(context)}`;
        }

        userPrompt += '\n\nRespond ONLY with valid JSON in this exact format: {"title": "...", "message": "..."}';

        const response = await queryDeepSeek([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], true, 0.9); // JSON mode, creative temperature

        const parsed = JSON.parse(response);
        return {
            title: parsed.title || 'Notification',
            message: parsed.message || 'You have a new notification'
        };
    } catch (error) {
        console.error('AI notification generation failed, using fallback:', error);
        return getFallbackNotification(type, context);
    }
};

/**
 * Fallback notification content when AI generation fails
 */
const getFallbackNotification = (
    type: NotificationType,
    context: Record<string, any>
): { title: string; message: string } => {
    switch (type) {
        case 'FRIEND_REQUEST':
            return {
                title: '🤝 New Connection Request',
                message: `${context.requesterName} wants to connect with you`
            };
        case 'FRIEND_ACCEPTED':
            return {
                title: '✨ Connection Established',
                message: `${context.friendName} is now your ally`
            };
        case 'LOGIN':
            return {
                title: '👋 Welcome Back!',
                message: 'Ready to connect with the world?'
            };
        case 'WELCOME':
            return {
                title: '🎉 Welcome to Mortals',
                message: 'Your journey of connection starts here.'
            };
        case 'APP_TIP':
            return {
                title: '💡 Discovery',
                message: context.feature || 'New feature available'
            };
        case 'SYSTEM':
            return {
                title: '⚙️ System Update',
                message: context.systemMessage || 'System notification'
            };
        default:
            return {
                title: 'Notification',
                message: 'You have a new notification'
            };
    }
};

/**
 * Create a new notification with AI-generated content
 */
export const createNotification = async (
    userId: string,
    type: NotificationType,
    context: Record<string, any> = {},
    data?: NotificationData
): Promise<void> => {
    // Generate AI-powered notification content
    const { title, message } = await generateAINotification(type, context);

    const notificationPayload = {
        user_id: userId,
        type,
        title,
        message,
        data: data || {},
        read: false,
        created_at: new Date().toISOString(),
        expires_at: context.expiresAt ? new Date(context.expiresAt).toISOString() : null
    };

    try {
        const { error } = await supabase
            .from('notifications')
            .insert(notificationPayload);

        if (error) throw error;
        console.log('📬 Notification created:', { userId, type, title });
    } catch (error) {
        console.error('Failed to create notification:', error);
        // Fallback to mock if DB fails
        const mockNotif: Notification = {
            id: `mock-${Date.now()}-${Math.random()}`,
            type,
            title,
            message,
            data: data || {},
            read: false,
            createdAt: new Date(),
            expiresAt: context.expiresAt
        };
        mockNotifications.unshift(mockNotif);
        mockListeners.forEach(listener => listener([...mockNotifications]));
    }
};

/**
 * Subscribe to real-time notifications for a user
 */
export const subscribeToNotifications = (
    userId: string,
    callback: (notifications: Notification[]) => void
): (() => void) => {
    // Initial fetch
    const fetchNotifications = async () => {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (!error && data) {
            const notifications: Notification[] = data.map(n => ({
                id: n.id,
                type: n.type as NotificationType,
                title: n.title,
                message: n.message,
                data: n.data || {},
                read: n.read,
                createdAt: new Date(n.created_at),
                expiresAt: n.expires_at ? new Date(n.expires_at) : undefined
            }));
            callback(notifications);
        }
    };

    fetchNotifications();

    // Real-time subscription
    const subscription = supabase
        .channel(`notifications:${userId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`
            },
            () => {
                // Refresh list on any change
                fetchNotifications();
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(subscription);
    };
};

/**
 * Mark a notification as read
 */
export const markAsRead = async (userId: string, notificationId: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId)
            .eq('user_id', userId);

        if (error) throw error;
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
    }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (userId: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', userId)
            .eq('read', false);

        if (error) throw error;
    } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
    }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (userId: string, notificationId: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId)
            .eq('user_id', userId);

        if (error) throw error;
    } catch (error) {
        console.error('Failed to delete notification:', error);
    }
};

/**
 * Get unread notification count
 */
export const getUnreadCount = (notifications: Notification[]): number => {
    return notifications.filter(n => !n.read).length;
};

/**
 * Clear all mock notifications (for testing)
 */
export const clearMockNotifications = () => {
    mockNotifications.length = 0;
    mockListeners.forEach(listener => listener([]));
};

/**
 * DeepSeek Engagement Engine
 * Generates compelling push notification content to drive user engagement
 */

interface EngagementContext {
    userName?: string;
    lastActiveDate?: Date;
    hasProfile?: boolean;
    hasPosted?: boolean;
    hasChatted?: boolean;
    currentLocation?: string;
}

/**
 * Generate push notification content using DeepSeek
 * Converts app features into "urges" to open the app
 */
export const generatePushContent = async (
    feature: string,
    context: EngagementContext
): Promise<{ title: string; body: string }> => {
    try {
        const systemPrompt = `You are the engagement engine for "Mortals", a social connection app.
Your job is to write IRRESISTIBLE push notifications that make users want to open the app RIGHT NOW.
Be warm, human, playful, and slightly mysterious. Create FOMO (fear of missing out).
Use emojis strategically. Keep it SHORT: title max 40 chars, body max 120 chars.
Focus on human connection, discovery, and curiosity.`;

        let userPrompt = '';

        switch (feature) {
            case 'EXPLORE_MAP':
                userPrompt = `Write a push notification urging ${context.userName || 'the user'} to explore the global map. Make them curious about what's happening in a random exciting city right now.`;
                break;
            case 'MEET_LOCALS':
                userPrompt = `Write a push notification suggesting ${context.userName || 'the user'} chat with an AI local. Mention a specific interesting persona (e.g., "a jazz musician in New Orleans" or "a street artist in Berlin").`;
                break;
            case 'COMPLETE_PROFILE':
                userPrompt = `Write a push notification encouraging ${context.userName || 'the user'} to complete their profile. Make it sound like they're missing out on connections.`;
                break;
            case 'FIRST_POST':
                userPrompt = `Write a push notification nudging ${context.userName || 'the user'} to make their first post. Make it feel like the community is waiting for them.`;
                break;
            case 'SEARCH_LOCATION':
                userPrompt = `Write a push notification inviting ${context.userName || 'the user'} to search for a location they've always wanted to visit. Mention a famous landmark or city.`;
                break;
            case 'DAILY_DISCOVERY':
                userPrompt = `Write a daily "discovery" push notification. Highlight something new or interesting happening in the Mortals community today.`;
                break;
            case 'INACTIVE_USER':
                const daysSinceActive = context.lastActiveDate
                    ? Math.floor((new Date().getTime() - context.lastActiveDate.getTime()) / (1000 * 60 * 60 * 24))
                    : 7;
                userPrompt = `Write a re-engagement push notification for ${context.userName || 'a user'} who hasn't been active for ${daysSinceActive} days. Make them feel missed and curious about what they've been missing.`;
                break;
            default:
                userPrompt = `Write an engaging push notification about: ${feature}. Make it compelling and create urgency.`;
        }

        userPrompt += '\n\nRespond ONLY with valid JSON in this exact format: {"title": "...", "body": "..."}';

        const response = await queryDeepSeek([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], true, 1.0); // JSON mode, maximum creativity

        const parsed = JSON.parse(response);
        return {
            title: parsed.title || '🌍 Mortals',
            body: parsed.body || 'Something exciting is happening...'
        };
    } catch (error) {
        console.error('Push content generation failed, using fallback:', error);
        return getFallbackPushContent(feature, context);
    }
};

/**
 * Fallback push notification content
 */
const getFallbackPushContent = (
    feature: string,
    context: EngagementContext
): { title: string; body: string } => {
    const userName = context.userName || 'there';

    switch (feature) {
        case 'EXPLORE_MAP':
            return {
                title: '🗺️ The world awaits',
                body: 'See what\'s happening in Tokyo, Paris, or Rio right now!'
            };
        case 'MEET_LOCALS':
            return {
                title: '👋 Someone wants to chat',
                body: 'A local in New Orleans is online. Say hello?'
            };
        case 'COMPLETE_PROFILE':
            return {
                title: '✨ Stand out',
                body: 'Add a photo to your profile and get noticed!'
            };
        case 'FIRST_POST':
            return {
                title: '📝 Your voice matters',
                body: 'The community is waiting. Share your first thought!'
            };
        case 'SEARCH_LOCATION':
            return {
                title: '🔍 Where to next?',
                body: 'Search for the Pyramids, Eiffel Tower, or anywhere!'
            };
        case 'DAILY_DISCOVERY':
            return {
                title: '🌟 Daily Discovery',
                body: 'New connections are happening. Don\'t miss out!'
            };
        case 'INACTIVE_USER':
            return {
                title: `👋 We miss you, ${userName}!`,
                body: 'The world has been moving. Come see what\'s new!'
            };
        default:
            return {
                title: '🌍 Mortals',
                body: 'Something exciting is happening...'
            };
    }
};
