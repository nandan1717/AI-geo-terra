import { LocationMarker, Story, StoryItem } from '../types';
import { queryDeepSeek } from './deepseekService';
import { pexelsService } from './pexelsService';
import { personaService } from './personaService';

export const aiContentService = {
    /**
     * Generates a "Hook" post - typically a quote or an interesting fact overlaying a beautiful image.
     */
    generateHookPost: async (topic: string = 'travel'): Promise<LocationMarker | null> => {
        try {
            // 1. Generate Content (Quote/Fact/Question) via DeepSeek
            // Expanded prompt for variety:
            const prompt = `
                Generate a single, engaging social media post content piece about "${topic}".
                Choose ONE random style from this list:
                1. A profound philosophical quote (cite author).
                2. A humorous or witty observation about life/travel.
                3. A motivational or inspiring thought.
                4. A fascinating, little-known fact.
                5. An adventurous question to the audience.
                
                Keep text under 280 characters.
                Provide a 2-3 word "visual query" to find a matching HIGH QUALITY video on Pexels.
                
                Return JSON format:
                {
                    "text": "The main content...",
                    "author": "Author Name" (OR null if general fact/question),
                    "type": "Quote" | "Fact" | "Humor" | "Question",
                    "visualQuery": "search term",
                    "location": "City, Country" (optional)
                }
            `;

            const rawContent = await queryDeepSeek([
                { role: 'system', content: 'You are a creative social media AI. Output JSON only.' },
                { role: 'user', content: prompt }
            ], true);

            let content;
            try {
                content = JSON.parse(rawContent);
            } catch (e) {
                console.warn("Failed to parse DeepSeek content", e);
                return null;
            }

            // 2. Fetch VIDEO via Pexels
            const videos = await pexelsService.searchVideos(content.visualQuery || topic, 1);
            const video = videos[0];

            if (!video) return null;

            // Find best video file
            const videoFile = video.video_files.find(f => f.quality === 'hd' && f.file_type === 'video/mp4') || video.video_files[0];

            // 3. Construct the Marker/Post
            const lat = (Math.random() * 160) - 80;
            const lng = (Math.random() * 360) - 180;

            // Refined Description Logic
            let description = "Thinking...";
            if (content.type === 'Quote' && content.author && content.author !== 'Unknown') {
                description = `— ${content.author}`; // Em dash for style
            } else if (content.type === 'Fact') {
                description = "💡 Did You Know?";
            } else {
                description = content.type; // "Humor", "Question", etc. or just empty
            }

            const post: LocationMarker = {
                id: `ai-post-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                name: content.text,
                description: description,
                latitude: lat,
                longitude: lng,
                type: 'Post',
                postImageUrl: video.image, // Fallback / thumbnail
                postVideoUrl: videoFile.link, // The video background
                sourceUrl: video.user.url, // Credit photographer
                country: 'Global',
                isUserPost: false,
                publishedAt: new Date().toISOString(),
                category: content.type === 'Quote' ? 'Inspiration' : 'Education',
                vibe: 'Inspiration',
                markerColor: [0.8, 0.4, 1.0]
            };

            return post;

        } catch (error) {
            console.error("AI Content Generation Failed:", error);
            return null;
        }
    },

    /**
     * Generates a "New Explorer" persona post.
     * Simulates a user posting from a cool location.
     */
    generateExplorerPost: async (): Promise<LocationMarker | null> => {
        try {
            // 1. Pick a random cool location via AI
            // We can ask DeepSeek for a "trending hidden gem"
            const locationPrompt = `Suggest one specific, visually stunning travel location (City, Country) that is trending or a hidden gem. Return JSON: { "location": "Name", "country": "Country", "visualQuery": "search terms" }`;

            const rawLoc = await queryDeepSeek([
                { role: 'system', content: 'You are a travel trend expert. JSON only.' },
                { role: 'user', content: locationPrompt }
            ], true);

            const locData = JSON.parse(rawLoc);

            // 2. Fetch Video
            const videos = await pexelsService.searchVideos(locData.visualQuery, 1);
            if (!videos[0]) return null;
            const video = videos[0];
            const videoFile = video.video_files.find(f => f.quality === 'hd' && f.file_type === 'video/mp4') || video.video_files[0];

            // 3. Generate Caption
            const captionPrompt = `Write a short Instagram-style caption for a video taken at ${locData.location}, ${locData.country}. Use emojis. Sound like a travel influencer.`;
            const caption = await queryDeepSeek([
                { role: 'system', content: 'You are a social media influencer.' },
                { role: 'user', content: captionPrompt }
            ], false); // Text mode

            // 4. Construct Marker
            const lat = (Math.random() * 160) - 80;
            const lng = (Math.random() * 360) - 180;

            return {
                id: `ai-explorer-${Date.now()}`,
                name: caption.replace(/"/g, ''),
                description: `Explorer • ${locData.location}, ${locData.country}`,
                latitude: lat,
                longitude: lng,
                type: 'Post',
                postImageUrl: video.image,
                postVideoUrl: videoFile.link,
                sourceUrl: video.url,
                country: locData.country,
                isUserPost: false,
                publishedAt: new Date().toISOString(),
                category: 'Travel',
                vibe: 'High Energy',
                markerColor: [0.2, 1.0, 0.5]
            };

        } catch (e) {
            console.error("Explorer Post Gen Failed", e);
            return null;
        }
    },

    /**
     * Efficiently generates multiple AI posts in parallel.
     * Uses a single LLM call to get a batch of content ideas, then fetches videos in parallel.
     */
    batchGeneratePosts: async (count: number = 5, topic: string = 'travel'): Promise<LocationMarker[]> => {
        try {
            // 1. Generate Batch Content via DeepSeek
            // Enhanced prompt for variety and video-friendliness
            const prompt = `
                Generate ${count} unique, engaging social media posts about "${topic}" or general life/travel/culture.
                
                CRITICAL INSTRUCTIONS:
                1. AVOID generic "cyberpunk" or "neon" cities unless specifically requested.
                2. MIX STYLES: 
                   - 60% "Explorer" (simulated realistic travel moments).
                   - 20% "Fascinating Fact" (nature/science/history).
                   - 20% "Thought Provoking" (philosophy/questions).
                3. VISUALS must be real-world and specific (e.g., "Man hiking Swiss Alps", "Chef cooking street food Bangkok", "Lion walking savanna").
                
                Return JSON array ONLY:
                [
                  {
                    "text": "The main caption/content...",
                    "author": "Author Name" (or null), 
                    "type": "Quote" | "Fact" | "Explorer",
                    "visualQuery": "Specific Subject + Aesthetic (e.g. 'Street food sizzling 4k' or 'Mountain drone shot')",
                    "location": "City, Country" (Required for Explorer),
                    "isExplorer": boolean
                  }
                ]
            `;

            const rawContent = await queryDeepSeek([
                { role: 'system', content: 'You are a world-class content creator. Output JSON array only.' },
                { role: 'user', content: prompt }
            ], true);

            let items: any[] = [];
            try {
                const parsed = JSON.parse(rawContent);
                items = Array.isArray(parsed) ? parsed : (parsed.items || []);
            } catch (e) {
                console.warn("Failed to parse batch content", e);
                return [];
            }

            // 2. Fetch Videos in Parallel (with Concurrency Limit of 5)
            const results: LocationMarker[] = [];
            const chunkSize = 5;

            for (let i = 0; i < items.length; i += chunkSize) {
                const chunk = items.slice(i, i + chunkSize);

                const chunkPromises = chunk.map(async (item) => {
                    // Determine best query for Pexels Video
                    // We append "video" or "hd" to hint, although we call searchVideos endpoint
                    const videoQuery = item.visualQuery || 'nature 4k';

                    const videos = await pexelsService.searchVideos(videoQuery, 1);
                    const video = videos[0];
                    if (!video) return null;

                    // Enforce Video (Prefer HD MP4, then any MP4)
                    // Filter for a valid MP4 link
                    const videoFile = video.video_files.find(f => f.quality === 'hd' && f.file_type === 'video/mp4')
                        || video.video_files.find(f => f.file_type === 'video/mp4')
                        || video.video_files[0];

                    if (!videoFile) return null;

                    const lat = (Math.random() * 160) - 80;
                    const lng = (Math.random() * 360) - 180;

                    // Description Logic
                    let description = "";
                    let title = item.text;

                    if (item.isExplorer) {
                        title = item.text.replace(/"/g, '');
                        const locStr = item.location || "Global";
                        description = `Explorer • ${locStr}`;
                    } else {
                        if (item.type === 'Quote' && item.author && item.author !== 'Unknown') {
                            description = `— ${item.author}`;
                        } else if (item.type === 'Fact') {
                            description = "Did you know?";
                            title = item.text; // Text is the fact
                        } else {
                            description = "";
                        }
                    }

                    // Final Marker Construction
                    const post: LocationMarker = {
                        id: `ai-batch-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        name: title,
                        description: description,
                        latitude: lat,
                        longitude: lng,
                        type: 'Post',
                        postImageUrl: video.image, // Thumbnail
                        postVideoUrl: videoFile.link, // Actual Video
                        sourceUrl: video.user.url,
                        country: item.location || 'Global',
                        isUserPost: false,
                        publishedAt: new Date().toISOString(),
                        category: item.type === 'Quote' ? 'Inspiration' : 'Travel',
                        vibe: 'Inspiration',
                        markerColor: [0.8, 0.4, 1.0]
                    };

                    return post;
                });

                const chunkResults = await Promise.all(chunkPromises);
                results.push(...(chunkResults.filter(p => p !== null) as LocationMarker[]));

                // Optional: Small delay between chunks to be nice to API
                if (i + chunkSize < items.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            return results;


        } catch (e) {
            console.error("Batch Gen Failed", e);
            return [];
        }
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
