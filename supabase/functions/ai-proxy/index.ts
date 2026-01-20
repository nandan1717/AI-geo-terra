import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Environment variables (server-side only - never exposed to client)
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') || '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
};

interface AIRequest {
    service: 'deepseek' | 'gemini';
    messages: Array<{ role: string; content: string }>;
    jsonMode?: boolean;
    temperature?: number;
}

Deno.serve(async (req) => {
    // Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body: AIRequest = await req.json();
        const { service, messages, jsonMode = false, temperature = 1.0 } = body;

        if (!service || !messages || messages.length === 0) {
            return new Response(JSON.stringify({ error: 'Missing required fields: service, messages' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        let response: Response;

        if (service === 'deepseek') {
            if (!DEEPSEEK_API_KEY) {
                throw new Error('DeepSeek API key not configured on server');
            }

            response = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages,
                    temperature,
                    response_format: jsonMode ? { type: 'json_object' } : { type: 'text' },
                    stream: false,
                }),
            });

        } else if (service === 'gemini') {
            if (!GEMINI_API_KEY) {
                throw new Error('Gemini API key not configured on server');
            }

            // Convert messages to Gemini format
            const geminiMessages = messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : m.role,
                parts: [{ text: m.content }],
            }));

            response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: geminiMessages,
                        generationConfig: {
                            temperature,
                            responseMimeType: jsonMode ? 'application/json' : 'text/plain',
                        },
                    }),
                }
            );

        } else {
            return new Response(JSON.stringify({ error: 'Invalid service. Use "deepseek" or "gemini".' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`${service} API error:`, errorText);
            return new Response(JSON.stringify({ error: `${service} API error`, details: errorText }), {
                status: response.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const data = await response.json();

        // Normalize response format
        let content: string;
        if (service === 'deepseek') {
            content = data.choices?.[0]?.message?.content || '';
        } else {
            content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        return new Response(JSON.stringify({ content, raw: data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('AI Proxy Error:', error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
