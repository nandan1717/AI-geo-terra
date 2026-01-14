/**
 * AI Proxy Client Service
 * Routes AI requests through the secure Edge Function instead of exposing API keys client-side
 */

import { supabase } from './supabaseClient';

interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface AIProxyResponse {
    content: string;
    raw?: unknown;
    error?: string;
}

/**
 * Send a request to the AI proxy Edge Function
 */
export const queryAI = async (
    service: 'deepseek' | 'gemini',
    messages: AIMessage[],
    options: { jsonMode?: boolean; temperature?: number } = {}
): Promise<string> => {
    const { jsonMode = false, temperature = 1.0 } = options;

    try {
        const { data, error } = await supabase.functions.invoke('ai-proxy', {
            body: {
                service,
                messages,
                jsonMode,
                temperature,
            },
        });

        if (error) {
            throw new Error(`AI Proxy Error: ${error.message}`);
        }

        if (data?.error) {
            throw new Error(`AI Service Error: ${data.error}`);
        }

        return data?.content || '';
    } catch (error) {
        console.error('AI Query Failed:', error);
        throw error;
    }
};

/**
 * Query DeepSeek through the proxy
 */
export const queryDeepSeekSecure = async (
    messages: AIMessage[],
    jsonMode: boolean = false,
    temperature: number = 1.3
): Promise<string> => {
    return queryAI('deepseek', messages, { jsonMode, temperature });
};

/**
 * Query Gemini through the proxy
 */
export const queryGeminiSecure = async (
    messages: AIMessage[],
    jsonMode: boolean = false,
    temperature: number = 1.0
): Promise<string> => {
    return queryAI('gemini', messages, { jsonMode, temperature });
};
