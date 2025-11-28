import { supabase } from './supabaseClient';
import { LocalPersona, ChatMessage, LocationMarker } from '../types';

export interface ChatSession {
    id: string;
    persona_name: string;
    persona_occupation: string;
    persona_image_url: string;
    persona_data: LocalPersona;
    location_name: string;
    location_lat: number;
    location_lng: number;
    last_message_at: string;
}

export const chatService = {
    /**
     * Creates a new chat session or returns an existing one if we want to dedup (optional).
     * For now, we'll create a new session for each interaction unless we explicitly resume.
     */
    async createSession(persona: LocalPersona, location: LocationMarker) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const { data, error } = await supabase
            .from('chat_sessions')
            .insert({
                user_id: user.id,
                persona_name: persona.name,
                persona_occupation: persona.occupation,
                persona_image_url: persona.imageUrl,
                persona_data: persona,
                location_name: location.name,
                location_lat: location.latitude,
                location_lng: location.longitude
            })
            .select()
            .single();

        if (error) throw error;
        return data as ChatSession;
    },

    /**
     * Fetches the user's recent chat sessions, optionally filtered by query.
     */
    async getRecentSessions(query?: string) {
        let dbQuery = supabase
            .from('chat_sessions')
            .select('*')
            .order('is_favorite', { ascending: false }) // Favorites first
            .order('last_message_at', { ascending: false })
            .limit(50);

        if (query) {
            dbQuery = dbQuery.or(`persona_name.ilike.%${query}%,location_name.ilike.%${query}%`);
        }

        const { data, error } = await dbQuery;

        if (error) throw error;
        return data as (ChatSession & { is_favorite: boolean })[];
    },

    /**
     * Loads messages for a specific session.
     */
    async getSessionMessages(sessionId: string) {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Map DB format to ChatMessage type
        return (data || []).map(msg => ({
            role: msg.role as 'user' | 'model',
            text: msg.content,
            sources: msg.sources
        })) as ChatMessage[];
    },

    /**
     * Saves a message to the database and updates the session's last_message_at.
     */
    async saveMessage(sessionId: string, message: ChatMessage) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Insert Message
        const { error } = await supabase
            .from('chat_messages')
            .insert({
                session_id: sessionId,
                user_id: user.id,
                role: message.role,
                content: message.text,
                sources: message.sources
            });

        if (error) console.error("Failed to save message:", error);

        // 2. Update Session Timestamp
        await supabase
            .from('chat_sessions')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', sessionId);
    },

    /**
     * Deletes a chat session.
     */
    async deleteSession(sessionId: string) {
        const { error } = await supabase
            .from('chat_sessions')
            .delete()
            .eq('id', sessionId);

        if (error) throw error;
    },

    /**
     * Toggles the favorite status of a session.
     */
    async toggleFavorite(sessionId: string, isFavorite: boolean) {
        const { error } = await supabase
            .from('chat_sessions')
            .update({ is_favorite: isFavorite })
            .eq('id', sessionId);

        if (error) throw error;
    },

    /**
     * Saves a search query to history.
     */
    async saveSearch(query: string, location?: LocationMarker) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase
            .from('search_history')
            .insert({
                user_id: user.id,
                query: query,
                location_name: location?.name,
                location_data: location
            });
    },

    /**
     * Fetches user's search history.
     */
    async getSearchHistory() {
        const { data, error } = await supabase
            .from('search_history')
            .select('*')
            .order('searched_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        return data;
    },
    /**
     * Fetches unique AI locals the user has chatted with.
     */
    async getUniqueLocals() {
        const { data, error } = await supabase
            .from('chat_sessions')
            .select('persona_name, persona_occupation, persona_image_url, location_name, last_message_at')
            .order('last_message_at', { ascending: false });

        if (error) throw error;

        // Dedup by persona_name
        const uniqueLocals = new Map();
        data?.forEach(session => {
            if (!uniqueLocals.has(session.persona_name)) {
                uniqueLocals.set(session.persona_name, session);
            }
        });

        return Array.from(uniqueLocals.values());
    }
};
