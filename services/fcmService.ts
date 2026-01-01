import { getMessaging, getToken, onMessage, deleteToken } from "firebase/messaging";
import { app, firebaseConfig } from "./firebase";

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
            console.log('FCM Token retrieved:', currentToken);
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
        console.log('FCM Token deleted.');
    } catch (err) {
        console.error('Error deleting FCM token:', err);
    }
};

export const onMessageListener = () =>
    new Promise((resolve) => {
        onMessage(messaging, (payload) => {
            console.log("payload", payload);
            resolve(payload);
        });
    });
