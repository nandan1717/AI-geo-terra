import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import logger from './logger';

export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

export const requestForToken = async (userId?: string) => {
    try {
        if ('serviceWorker' in navigator) {
            const firebaseConfigParams = new URLSearchParams({
                apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
                authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
                projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
                storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
                messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
                appId: import.meta.env.VITE_FIREBASE_APP_ID,
            }).toString();

            const registration = await navigator.serviceWorker.register(
                `/firebase-messaging-sw.js?${firebaseConfigParams}`
            );

            const currentToken = await getToken(messaging, {
                vapidKey: import.meta.env.VITE_FCM_VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (currentToken) {
                logger.debug('FCM Token generated:', currentToken);

                // Save to Supabase if userId is provided
                if (userId) {
                    try {
                        const { supabase } = await import('./supabaseClient');
                        const { error } = await supabase
                            .from('app_profiles_v2')
                            .update({
                                fcm_token: currentToken,
                                last_seen: new Date().toISOString()
                            })
                            .eq('id', userId);

                        if (error) console.error("Failed to save FCM token to DB:", error);
                        else logger.debug("FCM Token saved to profile");
                    } catch (dbError) {
                        console.error("Error saving token to Supabase:", dbError);
                    }
                }

                return currentToken;
            } else {
                console.warn('No registration token available. Request permission to generate one.');
                return null;
            }
        } else {
            console.warn('Service workers are not supported in this browser.');
            return null;
        }
    } catch (err: any) {
        console.error('An error occurred while retrieving token:', err);
        // Handle Brave browser or blocking extensions gracefully
        if (err.toString().includes('AbortError') || err.toString().includes('blocked')) {
            console.warn("Notifications likely blocked by browser settings or extensions.");
        }
        return null;
    }
};

export const onMessageListener = () =>
    new Promise((resolve) => {
        onMessage(messaging, (payload) => {
            resolve(payload);
        });
    });
