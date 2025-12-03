import { getMessaging, getToken, onMessage, deleteToken } from "firebase/messaging";
import { app, firebaseConfig } from "./firebaseConfig";

const messaging = getMessaging(app);

const VAPID_KEY = 'BCFdla5my9MxCHUTSgfZD7Az_ZzX1TS3hy7X2bHD5_--E8ETL9zAS77PsP_Dw8iM4zWMhMjEfFgWrJO8brsETM4';

export const requestForToken = async () => {
    try {
        // 1. Register Service Worker with dynamic config
        const swUrl = new URL('/firebase-messaging-sw.js', window.location.origin);

        // Append config as URL parameters
        Object.entries(firebaseConfig).forEach(([key, value]) => {
            swUrl.searchParams.append(key, value);
        });

        const registration = await navigator.serviceWorker.register(swUrl.toString());
        console.log('Service Worker registered with dynamic config');

        // 2. Get Token using the registration
        const currentToken = await getToken(messaging, {
            vapidKey: VAPID_KEY,
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
