
import { supabase } from './supabaseClient';
import { PERSONA_DATABASE } from '../data/personas';

export interface Persona {
    id: string;
    handle: string;
    name: string;
    avatar_url: string;
    bio: string;
    vibe: string;
    topics: string[];
    gender: 'Male' | 'Female' | 'Non-binary';
}

export const personaService = {

    /**
     * Initializes the persona database if empty.
     */
    initialize: async () => {
        try {
            // Check if we have data
            const { count, error } = await supabase
                .from('personas')
                .select('*', { count: 'exact', head: true });

            if (error) {
                console.warn('Persona check failed:', error.message);
                return;
            }

            if (count === 0) {

                // Seed data uses the mock data
                const seedData = PERSONA_DATABASE.map(p => ({
                    handle: p.handle,
                    name: p.name,
                    avatar_url: p.avatarUrl,
                    bio: p.bio,
                    vibe: p.vibe,
                    topics: p.topics,
                    gender: 'Female' // Default mock gender if missing in seed
                }));

                const { error: insertError } = await supabase
                    .from('personas')
                    .insert(seedData);

                if (insertError) {
                    console.error('Persona seeding failed:', insertError.message);
                } else {

                }
            }
        } catch (e) {
            console.error('Persona initialization error', e);
        }
    },

    /**
     * initializes with smart personas based on user context.
     * Wipes existing non-smart personas if needed.
     */
    ensureSmartPersonas: async (userName: string, location: string) => {
        const smartSeedingKey = 'mortals_smart_seeding_complete_v3'; // Bump version to force re-seed
        const hasSeeded = localStorage.getItem(smartSeedingKey);

        if (hasSeeded) {

            return;
        }



        try {
            // 1. Generate Smart Data
            const smartPersonas = await personaService.generatePersonasFromAI(userName, location);

            if (smartPersonas.length > 0) {
                // 2. Wipe Table (For this user's context context - actually global for now since single user app mostly)
                // Using a wipe here because the user requested "clear the database"
                await supabase.from('personas').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

                // 3. Insert New Data
                const { error } = await supabase.from('personas').insert(smartPersonas);

                if (error) {
                    console.error("Failed to insert smart personas:", error);
                } else {

                    localStorage.setItem(smartSeedingKey, 'true');
                    // Clear cached stories to force regeneration
                    localStorage.removeItem('geo-terra-stories');
                    localStorage.removeItem('geo-terra-stories_ai');

                    // Broadcast event to reload bar
                    window.dispatchEvent(new Event('geo-terra:story-created'));
                }
            }
        } catch (e) {
            console.error("Smart seeding failed", e);
        }
    },

    /**
     * Generates a list of personas relevant to the user via AI.
     */
    generatePersonasFromAI: async (userName: string, location: string): Promise<any[]> => {
        try {
            const { queryDeepSeek } = await import('./deepseekService');

            const prompt = `
                Generate 5 distinct, realistic 'Local Friend' personas for a user named "${userName}" who is currently in "${location}".
                
                The personas should match the "Vibe" of ${location} (e.g. if NYC -> Creative, Tech, Fashion; if Bali -> Digital Nomad, Surfer).
                They should sound like real people who would be friends with the user.
                
                Return a JSON Array of objects:
                [
                    {
                        "handle": "unique_username",
                        "name": "Full Name",
                        "bio": "Short 1 sentence bio",
                        "vibe": "Chill" | "High Energy" | "Inspiration" | "Intense",
                        "gender": "Male" | "Female", 
                        "topics": ["specific topic 1", "specific topic 2", "specific topic 3"] (e.g. "Coffee in Mission District", "Surfing Ocean Beach"),
                        "avatar_style": "seed_string" (just a random string for seed)
                    }
                ]
            `;

            const raw = await queryDeepSeek([
                { role: 'system', content: 'You are a creative director. Output valid JSON array only.' },
                { role: 'user', content: prompt }
            ], true);

            const data = JSON.parse(raw);
            const list = Array.isArray(data) ? data : (data.personas || []);

            return list.map((p: any) => ({
                handle: p.handle.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                name: p.name,
                bio: p.bio,
                vibe: p.vibe,
                gender: p.gender || 'Female', // Default if missing
                topics: p.topics,
                avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.avatar_style}`
            }));

        } catch (e) {
            console.error("AI Persona Gen Failed", e);
            return [];
        }
    },

    /**
     * Fetches random personas for stories.
     */
    getRandomPersonas: async (limit: number = 5): Promise<Persona[]> => {
        try {
            // Since we can't easily do random sort in generic way without a function,
            // we'll just fetch a batch and shuffle client side for this scale (>10 items).
            const { data, error } = await supabase
                .from('personas')
                .select('*')
                .limit(20);

            if (error || !data || data.length === 0) {
                // Return empty if DB is empty (waiting for seed)
                return [];
            }

            // Shuffle array
            const shuffled = data.sort(() => 0.5 - Math.random());
            return shuffled.slice(0, limit);

        } catch (e) {
            return [];
        }
    },

    /**
     * Fetches a specific persona by name.
     */
    getPersonaByName: async (name: string): Promise<Persona | null> => {
        if (!name) return null;
        try {
            const { data, error } = await supabase
                .from('personas')
                .select('*')
                .ilike('name', name) // Case insensitive match
                .maybeSingle();

            if (error) {
                return null;
            }

            if (data) return data;
            return null;
        } catch (e) {
            console.error("getPersonaByName failed", e);
            return null;
        }
    }
};
