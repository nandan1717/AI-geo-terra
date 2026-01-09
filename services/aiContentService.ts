import { LocationMarker, Story, StoryItem } from '../types';
import { queryDeepSeek } from './deepseekService';
import { pexelsService } from './pexelsService';
import { personaService } from './personaService';

export const aiContentService = {
    /**
     * Generates a "Hook" post - typically a quote or an interesting fact overlaying a beautiful image.
     */
    /**
     * Generates a "Hook" post - typically a quote or an interesting fact overlaying a beautiful image.
     * @deprecated Removed by user request 2025-01-09. Returns null.
     */
    generateHookPost: async (topic: string = 'travel'): Promise<LocationMarker | null> => {
        return null;
    },

    /**
     * Generates a "New Explorer" persona post.
     * @deprecated Removed by user request 2025-01-09. Returns null.
     */
    generateExplorerPost: async (): Promise<LocationMarker | null> => {
        return null;
    },

    /**
     * Efficiently generates multiple AI posts in parallel.
     * @deprecated Removed by user request 2025-01-09. Returns empty array.
     */
    batchGeneratePosts: async (count: number = 5, topic: string = 'travel'): Promise<LocationMarker[]> => {
        return [];
    },

    /**
     * Generates a batch of "Persona Stories" for the Story Bar.
     * Uses the Persona Database (Supabase) + Pexels Videos.
     */
    generateStoryBatch: async (count: number = 5, priorityPersonaName?: string): Promise<Story[]> => {
        try {
            // 1. Get Personas
            await personaService.initialize(); // Ensure seeded

            let personas: any[] = [];
            let needed = count;

            // 1a. Fetch Priority Persona if requested
            if (priorityPersonaName) {
                const priorityPersona = await personaService.getPersonaByName(priorityPersonaName);
                if (priorityPersona) {
                    personas.push(priorityPersona);
                    needed--;
                }
            }

            // 1b. Fetch Random Personas for the rest
            if (needed > 0) {
                const randomPersonas = await personaService.getRandomPersonas(needed);
                // Filter out the priority persona if fetched again by random chance
                const filteredRandom = randomPersonas.filter(p => p.name !== priorityPersonaName);
                personas = [...personas, ...filteredRandom];
            }

            const stories: Story[] = [];

            // 2. For each persona, find a video matching their vibe (Concurrency Limited)
            const chunkSize = 5;
            for (let i = 0; i < personas.length; i += chunkSize) {
                const chunk = personas.slice(i, i + chunkSize);

                await Promise.all(chunk.map(async (p) => {
                    // Pick a random topic (These are now Smart Topics, e.g. "Coffee at Blue Bottle SF")
                    const topic = p.topics[Math.floor(Math.random() * p.topics.length)];

                    // Search for VIDEO
                    // We try to keep the query clean for best matches.
                    // "topic + vertical" helps Pexels find 9:16 content often.
                    // Augment with gender to ensure visual consistency (e.g. "Coffee woman" vs "Coffee man")
                    // Note: 'gender' is now on the p object from personaService
                    const genderTerm = p.gender === 'Female' ? 'woman' : (p.gender === 'Male' ? 'man' : 'person');
                    const videoQuery = `${topic} ${genderTerm}`;

                    const videos = await pexelsService.searchVideos(videoQuery, 1);
                    const video = videos[0];

                    if (video) {
                        // Try to find a portrait/vertical file, or fallback to high res
                        // Pexels API doesn't always guarantee orientation in 'video_files', but we requested it in search.
                        // We look for height > width typically, or just the best quality.
                        const videoFile = video.video_files.find(f => f.height > f.width && f.file_type === 'video/mp4')
                            || video.video_files.find(f => f.quality === 'hd')
                            || video.video_files[0];

                        if (videoFile) {
                            // Generate AI Caption specific to the topic
                            const captionPrompt = `
                                Write a very short, aesthetic Instagram story caption (max 10 words) about: "${topic}".
                                Vibe: ${p.vibe}.
                                Author: ${p.name}.
                                Use 1-2 emojis. No hashtags.
                            `;
                            const caption = await queryDeepSeek([
                                { role: 'system', content: 'You are a trendy social media user. Output text only.' },
                                { role: 'user', content: captionPrompt }
                            ], false);

                            const story: Story = {
                                id: `story-${p.id}-${Date.now()}`,
                                user: {
                                    handle: p.handle.toLowerCase(),
                                    name: p.name,
                                    avatarUrl: p.avatar_url,
                                    isAi: true
                                },
                                items: [
                                    {
                                        id: `item-${video.id}`,
                                        type: 'video',
                                        url: videoFile.link,
                                        duration: video.duration,
                                        takenAt: new Date().toISOString(),
                                        caption: caption.replace(/"/g, '').trim()
                                    }
                                ],
                                viewed: false,
                                expiresAt: Date.now() + (12 * 60 * 60 * 1000) // 12 hours from now
                            };

                            // Add priority persona to the FRONT
                            if (priorityPersonaName && p.name === priorityPersonaName) {
                                stories.unshift(story);
                            } else {
                                stories.push(story);
                            }
                        }
                    }
                }));
            }

            // Re-sort to ensure priority is first (Promise.all might mix order)
            if (priorityPersonaName && stories.length > 0) {
                const pIndex = stories.findIndex(s => s.user.name === priorityPersonaName);
                if (pIndex > 0) {
                    const [pStory] = stories.splice(pIndex, 1);
                    stories.unshift(pStory);
                }
            }

            // Notification Trigger (Fire & Forget)
            if (stories.length > 0) {
                import('./notificationService').then(({ createNotification }) => {
                    const userId = localStorage.getItem('user_id_v2'); // Helper to get current user if possible, or we need to pass it
                    // Since aiContentService is often called by the client for the current user, we try to grab ID.
                    // If not readily available, we might skip or rely on caller.
                    // Assuming for now the caller handles it or we use a global store.
                    // Actually, let's just use the Supabase session if available.
                    import('./supabaseClient').then(async ({ supabase }) => {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                            const names = stories.slice(0, 2).map(s => s.user.name).join(', ');
                            const extra = stories.length > 2 ? ` and ${stories.length - 2} others` : '';
                            createNotification(user.id, 'STORY_UPDATE', {
                                message: `New stories from ${names}${extra}.`,
                                uniqueId: `story_batch_${new Date().setMinutes(0, 0, 0)}` // Unique per hour
                            });
                        }
                    });
                });
            }

            return stories;

        } catch (e) {
            console.error("Story Batch Gen Failed", e);
            return [];
        }
    }
};
