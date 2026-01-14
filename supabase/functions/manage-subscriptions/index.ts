// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// GDELT/FCM Helpers
const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY');

// In a real production setup with Firebase Admin SDK, we'd use `admin.messaging().subscribeToTopic()`.
// Since we are in Deno Edge Functions without the full Node Admin SDK (often harder to config with certs),
// we can use the raw Google IID API or FCM API for topic subscription.
// Note: Google is deprecating legacy IID APIs, but for now they are often the easiest HTTP method. 
// However, detailed HTTP v1 API usually requires OAuth2. 
// For this MVP, we will try the Legacy HTTP API which supports topic subscription via:
// POST https://iid.googleapis.com/iid/v1/{token}/rel/topics/{topicName}
// Authorization: key=YOUR_SERVER_KEY

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (!FCM_SERVER_KEY) {
            throw new Error("Missing FCM_SERVER_KEY");
        }

        const { token, topic, subscribe } = await req.json();

        if (!token || !topic) {
            throw new Error("Missing token or topic");
        }

        const topicName = topic.replace(/[^a-zA-Z0-9-_.~%]/g, ''); // Sanitize

        let url = '';
        let method = 'POST';

        if (subscribe) {
            // Subscribe
            url = `https://iid.googleapis.com/iid/v1/${token}/rel/topics/${topicName}`;
        } else {
            // Unsubscribe: 
            // DELETE https://iid.googleapis.com/iid/v1:batchRemove
            // This is slightly different for batch.
            // For simple single unsubscribe, sending a batchRemove with one token is standard.
            url = `https://iid.googleapis.com/iid/v1:batchRemove`;
        }

        let result;
        if (subscribe) {
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `key=${FCM_SERVER_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            if (resp.ok) {
                result = { success: true, message: `Subscribed to ${topicName}` };
            } else {
                throw new Error(`FCM Error: ${await resp.text()}`);
            }
        } else {
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `key=${FCM_SERVER_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: `/topics/${topicName}`,
                    registration_tokens: [token]
                })
            });
            if (resp.ok) {
                result = { success: true, message: `Unsubscribed from ${topicName}` };
            } else {
                throw new Error(`FCM Error: ${await resp.text()}`);
            }
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (err) {
        console.error("Subscription Error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
