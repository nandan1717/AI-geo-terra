importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
// Parse config from URL parameters
const params = new URL(location.href).searchParams;
const config = {
    apiKey: params.get('apiKey'),
    authDomain: params.get('authDomain'),
    projectId: params.get('projectId'),
    storageBucket: params.get('storageBucket'),
    messagingSenderId: params.get('messagingSenderId'),
    appId: params.get('appId'),
    measurementId: params.get('measurementId')
};
// Ensure we have a valid config before initializing
if (!config.apiKey || !config.messagingSenderId) {
    console.error('Missing Firebase config in Service Worker URL');
}

// Initialize the Firebase app in the service worker
firebase.initializeApp(config);

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;

    // User suggested options + robust handling
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.webpush?.notification?.icon || payload.notification.image || '/pwa-icon.svg',
        image: payload.notification.image || payload.data.image, // Support Rich Media Image
        tag: payload.data.eventId || 'general', // Grouping
        renotify: true,
        data: payload.data // Pass data for click handling
    };

    // Add Actions if present
    if (payload.data && payload.data.actions) {
        try {
            const actions = JSON.parse(payload.data.actions);
            if (Array.isArray(actions)) {
                notificationOptions.actions = actions;
            }
        } catch (e) {
            console.error("Failed to parse actions:", e);
        }
    }

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification click received.');
    event.notification.close();

    // Open the app when notification is clicked
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if there is already a window/tab open with the target URL
            const urlToOpen = event.notification.data?.url || '/'; // Use deep link if avail

            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.indexOf('/') !== -1 && 'focus' in client) {
                    return client.focus().then((windowClient) => {
                        // Optional: Send message to window to navigate?
                        // For now just focus is good, the App.tsx foreground listener might handle it if we send a message
                        // But for now simple focus is standard.
                        // If we want to navigate to specific URL, we might need client.navigate(urlToOpen)
                        if (urlToOpen !== '/' && client.navigate) {
                            return client.navigate(urlToOpen);
                        }
                        return windowClient;
                    });
                }
            }
            // If not, open a new window/tab
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
