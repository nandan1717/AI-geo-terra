import { supabase } from './supabaseClient';
import { Notification, NotificationType, NotificationData } from '../types';

// Mock notifications for demo mode (fallback if Supabase fails or for testing)
const mockNotifications: Notification[] = [];
let mockListeners: Array<(notifications: Notification[]) => void> = [];

/**
 * Get static notification content based on type and context
 */
const getNotificationTemplate = (
    type: NotificationType,
    context: Record<string, any>
): { title: string; message: string } => {
    switch (type) {
        case 'FRIEND_REQUEST':
            return {
                title: '🤝 New Connection Request',
                message: `${context.requesterName} wants to connect with you.`
            };
        case 'FRIEND_ACCEPTED':
            return {
                title: '✨ Connection Established',
                message: `${context.friendName} is now your ally.`
            };
        case 'LOGIN':
            const timeOfDay = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening';
            return {
                title: '👋 Welcome Back!',
                message: `Good ${timeOfDay}, ${context.userName}. Ready to explore?`
            };
        case 'WELCOME':
            return {
                title: '🎉 Welcome to Mortals',
                message: `Welcome aboard, ${context.userName}. Your journey starts now.`
            };
        case 'APP_TIP':
            return {
                title: '💡 Did you know?',
                message: `Try ${context.feature} to discover more about the world.`
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
    // Generate notification content from template
    const { title, message } = getNotificationTemplate(type, context);

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
            expiresAt: context.expiresAt ? new Date(context.expiresAt) : undefined
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
/**
 * Get static push notification content
 */
export const generatePushContent = async (
    feature: string,
    context: EngagementContext
): Promise<{ title: string; body: string }> => {
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
