import { getMessaging, getToken, onMessage, deleteToken } from "firebase/messaging";
import { app, firebaseConfig } from "./firebase";
import logger from './logger';

const messaging = getMessaging(app);

export const requestForToken = async () => {
    try {
        // Register service worker with dynamic Firebase config
        const registration = await navigator.serviceWorker.register(
            `/firebase-messaging-sw.js?${new URLSearchParams(firebaseConfig as any).toString()}`
        );

        const currentToken = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_FCM_VAPID_KEY,
            serviceWorkerRegistration: registration
        });

        if (currentToken) {

            return currentToken;
        } else {
            console.warn('No registration token available. Request permission to generate one.');
            return null;
        }
    } catch (err) {
        console.error('An error occurred while retrieving token:', err);
        return null;
    }
};

export const deleteFCMToken = async () => {
    try {
        await deleteToken(messaging);

    } catch (err) {
        console.error('Error deleting FCM token:', err);
    }
};

export const onMessageListener = () =>
    new Promise((resolve) => {
        onMessage(messaging, (payload) => {

            resolve(payload);
        });
    });

/**
 * Subscribe the current device to a specific FCM topic.
 * Calls the 'manage-subscriptions' Edge Function.
 */
export const subscribeToTopic = async (topic: string): Promise<boolean> => {
    try {
        const token = await requestForToken();
        if (!token) return false;

        const { supabase } = await import('./supabaseClient');
        const { data, error } = await supabase.functions.invoke('manage-subscriptions', {
            body: { token, topic, subscribe: true }
        });

        if (error) {
            console.error(`Failed to subscribe to topic ${topic}:`, error);
            return false;
        }

        logger.debug(`Subscribed to topic: ${topic}`);
        return true;
    } catch (e) {
        console.error("Error subscribing to topic:", e);
        return false;
    }
};

/**
 * Unsubscribe the current device from a specific FCM topic.
 */
export const unsubscribeFromTopic = async (topic: string): Promise<boolean> => {
    try {
        const token = await requestForToken();
        if (!token) return false;

        const { supabase } = await import('./supabaseClient');
        const { data, error } = await supabase.functions.invoke('manage-subscriptions', {
            body: { token, topic, subscribe: false }
        });

        if (error) {
            console.error(`Failed to unsubscribe from topic ${topic}:`, error);
            return false;
        }

        logger.debug(`Unsubscribed from topic: ${topic}`);
        return true;
    } catch (e) {
        console.error("Error unsubscribing from topic:", e);
        return false;
    }
};
