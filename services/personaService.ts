
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
                console.log('Seeding Personas...');
                // Seed data uses the mock data
                const seedData = PERSONA_DATABASE.map(p => ({
                    handle: p.handle,
                    name: p.name,
                    avatar_url: p.avatarUrl,
                    bio: p.bio,
                    vibe: p.vibe,
                    topics: p.topics
                }));

                const { error: insertError } = await supabase
                    .from('personas')
                    .insert(seedData);

                if (insertError) {
                    console.error('Persona seeding failed:', insertError.message);
                } else {
                    console.log('Personas seeded successfully.');
                }
            }
        } catch (e) {
            console.error('Persona initialization error', e);
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

            if (error || !data) {
                // Fallback to local data if DB fails or is empty (and seeding failed)
                console.warn('Fetching personas failed, using fallback.', error);
                return PERSONA_DATABASE.slice(0, limit).map(p => ({
                    ...p,
                    avatar_url: p.avatarUrl
                })) as Persona[];
            }

            // Shuffle array
            const shuffled = data.sort(() => 0.5 - Math.random());
            return shuffled.slice(0, limit);

        } catch (e) {
            return [];
        }
    }
};
