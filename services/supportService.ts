import { supabase } from './supabaseClient';
import { queryDeepSeek } from './deepseekService';
import { createNotification } from './notificationService';

export interface SupportMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: Date;
}

export interface SupportSession {
    id: string;
    status: 'open' | 'closed';
    rating?: number;
    feedback?: string;
    createdAt: Date;
}

// Fallback in-memory storage if DB is missing
const mockSessions: Record<string, SupportSession> = {};
const mockMessages: Record<string, SupportMessage[]> = {};

export const supportService = {
    /**
     * Create a new support session
     */
    async createSession(userId: string): Promise<SupportSession> {
        try {
            const { data, error } = await supabase
                .from('support_sessions')
                .insert({ user_id: userId, status: 'open' })
                .select()
                .single();

            if (error) throw error;

            return {
                id: data.id,
                status: data.status,
                createdAt: new Date(data.created_at)
            };
        } catch (error) {
            console.warn('Using fallback support session', error);
            const id = `mock-${Date.now()}`;
            const session: SupportSession = {
                id,
                status: 'open',
                createdAt: new Date()
            };
            mockSessions[id] = session;
            mockMessages[id] = [];
            return session;
        }
    },

    /**
     * Send a message and get AI response
     */
    /**
     * Send a message and get AI response
     */
    async sendMessage(sessionId: string, userId: string, content: string): Promise<SupportMessage> {
        // 1. Save User Message
        await this.saveMessage(sessionId, 'user', content);

        // 2. Get Chat History
        const history = await this.getSessionMessages(sessionId);

        // 3. Generate AI Response
        const systemPrompt = `You are "Atlas", the elite support specialist for the Mortals application.
        
        YOUR PERSONA:
        - Professional, concise, and helpful.
        - You speak in a clean, tech-forward tone.
        - NEVER output long paragraphs. Use bullet points and bold text for readability.
        
        YOUR GOAL:
        - Assist users with app navigation, features, and troubleshooting.
        - If you don't know something, ask for clarification.
        
        FORMATTING RULES:
        - Use **bold** for key terms or buttons.
        - Use bullet points for lists or steps.
        - Keep responses under 3 sentences unless explaining a complex step.`;

        const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
            { role: 'system', content: systemPrompt },
            ...history.map(m => ({ role: m.role, content: m.content }))
        ];

        let aiResponseText = "";
        try {
            aiResponseText = await queryDeepSeek(messages, false, 0.7);
        } catch (error) {
            console.error("Atlas Brain Offline:", error);
            aiResponseText = "I apologize, but I'm having trouble accessing my knowledge base right now. Please try again in a moment, or submit your feedback directly.";
        }

        // 4. Save AI Response
        const aiMessage = await this.saveMessage(sessionId, 'assistant', aiResponseText);

        return aiMessage;
    },

    /**
     * Save a message to DB
     */
    async saveMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string): Promise<SupportMessage> {
        try {
            const { data, error } = await supabase
                .from('support_messages')
                .insert({ session_id: sessionId, role, content })
                .select()
                .single();

            if (error) throw error;

            return {
                id: data.id,
                role: data.role,
                content: data.content,
                createdAt: new Date(data.created_at)
            };
        } catch (error) {
            const msg: SupportMessage = {
                id: `msg-${Date.now()}`,
                role,
                content,
                createdAt: new Date()
            };
            if (mockMessages[sessionId]) {
                mockMessages[sessionId].push(msg);
            }
            return msg;
        }
    },

    /**
     * Get messages for a session
     */
    async getSessionMessages(sessionId: string): Promise<SupportMessage[]> {
        try {
            const { data, error } = await supabase
                .from('support_messages')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            return data.map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                createdAt: new Date(m.created_at)
            }));
        } catch (error) {
            return mockMessages[sessionId] || [];
        }
    },

    /**
     * Submit feedback and close session
     */
    /**
     * Submit feedback and close session
     */
    async submitFeedback(sessionId: string, userId: string, rating: number, feedback: string): Promise<void> {
        try {
            // 1. Close the session
            const { error: sessionError } = await supabase
                .from('support_sessions')
                .update({ status: 'closed', rating, feedback, updated_at: new Date().toISOString() })
                .eq('id', sessionId);

            if (sessionError) throw sessionError;

            // 2. Save to dedicated feedback table
            const { error: feedbackError } = await supabase
                .from('app_feedback')
                .insert({
                    user_id: userId,
                    rating,
                    feedback,
                    session_id: sessionId,
                    source: 'support_chat'
                });

            if (feedbackError) console.error("Failed to save to app_feedback", feedbackError);

            // Trigger a "Thank You" notification
            await createNotification(userId, 'SYSTEM', {
                systemMessage: "Thanks for your feedback! We're constantly improving Mortals based on your input."
            });

        } catch (error) {
            if (mockSessions[sessionId]) {
                mockSessions[sessionId].status = 'closed';
                mockSessions[sessionId].rating = rating;
                mockSessions[sessionId].feedback = feedback;
            }
        }
    },

    /**
     * Check for inactive sessions and trigger re-engagement
     */
    async checkAndReengage(userId: string) {
        // Check if user has any recent sessions
        const { data } = await supabase
            .from('support_sessions')
            .select('created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1);

        const lastSession = data?.[0];
        const now = new Date();

        // If no session ever, or last session was > 3 days ago (simulated as > 1 minute for demo)
        const lastSessionDate = lastSession ? new Date(lastSession.created_at) : new Date(0);
        const diffMs = now.getTime() - lastSessionDate.getTime();

        // For demo purposes, check last nudge time to prevent spam
        const lastNudge = localStorage.getItem('last_atlas_nudge');
        const lastNudgeTime = lastNudge ? new Date(lastNudge).getTime() : 0;

        // Only nudge if it's been > 24 hours since last nudge AND > 1 min since last session
        if (diffMs > 60 * 1000 && (now.getTime() - lastNudgeTime > 24 * 60 * 60 * 1000)) {
            await createNotification(userId, 'SYSTEM', {
                systemMessage: "Atlas here. I noticed you haven't checked in for a while. How is your exploration going? I'm here if you need assistance."
            });
            localStorage.setItem('last_atlas_nudge', now.toISOString());
        }
    }
};
