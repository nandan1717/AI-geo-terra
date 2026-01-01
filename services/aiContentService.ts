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
                name: `explorer*${Math.floor(Math.random() * 1000)}*${locData.location.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                description: caption.replace(/"/g, ''),
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
            const prompt = `
                Generate ${count} unique, engaging social media posts about "${topic}" or general life/travel.
                Mix these styles:
                - Quotes (philosophy/travel)
                - Fascinating Facts
                - Humorous Observations
                - "Explorer" updates (simulated travel logs)
                
                CRITICAL VISUAL INSTRUCTION:
                You MUST extract the main SUBJECT of the text for the "visualQuery".
                - If text matches "Great Wall", visualQuery: "Great Wall of China cinematic".
                - If text matches "Coffee", visualQuery: "Barista making coffee close up".
                - If text matches "Colosseum", visualQuery: "Colosseum Rome hyperlapse".
                
                Do NOT just use the city name. Use the specific landmark or object mentioned.
                
                Return JSON array:
                [
                  {
                    "text": "Main content...",
                    "author": "Author or 'Unknown'", 
                    "type": "Quote" | "Fact" | "Humor" | "Explorer",
                    "visualQuery": "Specific Subject + Aesthetic (e.g. 'cinematic')",
                    "location": "City, Country" (for Explorer/Fact),
                    "isExplorer": boolean
                  }
                ]
            `;

            const rawContent = await queryDeepSeek([
                { role: 'system', content: 'You are a creative social media AI. Output JSON array.' },
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

            // 2. Fetch Videos in Parallel
            const postPromises = items.map(async (item) => {
                const videos = await pexelsService.searchVideos(item.visualQuery || 'abstract', 1);
                const video = videos[0];
                if (!video) return null;

                // Enforce Video (HD MP4)
                const videoFile = video.video_files.find(f => f.quality === 'hd' && f.file_type === 'video/mp4') || video.video_files[0];
                if (!videoFile) return null;

                const lat = (Math.random() * 160) - 80;
                const lng = (Math.random() * 360) - 180;

                // Description Logic - CLEANER NOW
                let description = "";
                let title = item.text;

                if (item.isExplorer) {
                    const saneLoc = item.location ? item.location.toLowerCase().replace(/[^a-z0-9]/g, '') : "daily";
                    title = `explorer*${saneLoc}`;
                    description = item.text; // Caption is description
                } else {
                    // Quote/Fact/Humor
                    if (item.type === 'Quote' && item.author && item.author !== 'Unknown') {
                        description = `— ${item.author}`;
                    } else {
                        // For Facts, Humor, Questions: NO SUBHEADING.
                        // The title contains the content. Description is empty to be clean.
                        description = "";
                    }
                }

                const post: LocationMarker = {
                    id: `ai-batch-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    name: title,
                    description: description,
                    latitude: lat,
                    longitude: lng,
                    type: 'Post',
                    postImageUrl: video.image,
                    postVideoUrl: videoFile.link,
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

            const results = await Promise.all(postPromises);
            return results.filter(p => p !== null) as LocationMarker[];

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

            // 2. For each persona, find a video matching their vibe
            await Promise.all(personas.map(async (p) => {
                // Pick a random topic
                const topic = p.topics[Math.floor(Math.random() * p.topics.length)];

                // Search for VERTICAL video
                const videos = await pexelsService.searchVideos(`${topic} vertical aesthetic`, 1);
                const video = videos[0];

                if (video) {
                    // Try to find a portrait/vertical file, or fallback to high res
                    // Pexels API doesn't always guarantee orientation in 'video_files', but we requested it in search.
                    // We look for height > width typically, or just the best quality.
                    const videoFile = video.video_files.find(f => f.height > f.width && f.file_type === 'video/mp4')
                        || video.video_files.find(f => f.quality === 'hd')
                        || video.video_files[0];

                    if (videoFile) {
                        // Generate AI Caption
                        const captionPrompt = `
                            Write a very short, aesthetic Instagram story caption (max 10 words) for a video about "${topic}".
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

            // Re-sort to ensure priority is first (Promise.all might mix order)
            if (priorityPersonaName && stories.length > 0) {
                const pIndex = stories.findIndex(s => s.user.name === priorityPersonaName);
                if (pIndex > 0) {
                    const [pStory] = stories.splice(pIndex, 1);
                    stories.unshift(pStory);
                }
            }

            return stories;

        } catch (e) {
            console.error("Story Batch Gen Failed", e);
            return [];
        }
    }
};
