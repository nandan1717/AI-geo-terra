
import React, { useEffect, useState, useRef } from 'react';
import { Story, StoryItem, ChatMessage } from '../types';
import { aiContentService } from '../services/aiContentService';
import { chatService } from '../services/chatService';
import { X, Heart, Send } from 'lucide-react';

const STORAGE_KEY = 'geo-terra-stories';

export const StoryBar: React.FC = () => {
    const [stories, setStories] = useState<Story[]>([]);
    const [activeStoryIdx, setActiveStoryIdx] = useState<number | null>(null);
    const [progress, setProgress] = useState(0);
    const [isReplying, setIsReplying] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Force Pause Logic
    useEffect(() => {
        if ((isReplying || isGenerating) && videoRef.current) {
            videoRef.current.pause();
        } else if (!isReplying && !isGenerating && videoRef.current && activeStoryIdx !== null) {
            // Resume video when not replying/generating
            videoRef.current.play();
        }
    }, [isReplying, isGenerating, activeStoryIdx]);

    // Load / Init Stories
    useEffect(() => {
        const initStories = async () => {
            try {
                // 1. Fetch Real Stories (Last 6 Hours only)
                const { socialService } = await import('../services/socialService');
                const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
                const realPosts = await socialService.fetchPosts(undefined, 'story', sixHoursAgo);
                let realStories: Story[] = [];

                if (realPosts && realPosts.length > 0) {
                    const storyMap = new Map<string, Story>();
                    realPosts.forEach(post => {
                        const userId = post.user_id;
                        if (!storyMap.has(userId)) {
                            storyMap.set(userId, {
                                id: userId,
                                user: {
                                    name: post.user.full_name,
                                    handle: post.user.username,
                                    avatarUrl: post.user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user.username}`,
                                    isAi: false
                                },
                                items: [],
                                viewed: false,
                                expiresAt: new Date(post.created_at).getTime() + 6 * 60 * 60 * 1000 // Expire 6h after creation
                            });
                        }
                        const story = storyMap.get(userId)!;
                        story.items.push({
                            id: post.id.toString(),
                            type: 'image',
                            url: post.image_url || 'https://via.placeholder.com/400x800',
                            duration: 5000,
                            caption: post.caption,
                            takenAt: post.created_at
                        });
                    });
                    realStories = Array.from(storyMap.values());
                }

                // 2. Fetch/Generate AI Stories (Always fetch to keep bar populated)
                let aiStories: Story[] = [];
                const storedAi = localStorage.getItem(STORAGE_KEY + '_ai');
                if (storedAi) {
                    const parsed = JSON.parse(storedAi);
                    if (parsed.length > 0 && parsed[0].expiresAt > Date.now()) {
                        aiStories = parsed;
                    }
                }

                if (aiStories.length === 0) {
                    // Get latest persona for context
                    let latestPersonaName: string | undefined;
                    try {
                        const recentSessions = await chatService.getRecentSessions();
                        if (recentSessions.length > 0) latestPersonaName = recentSessions[0].persona_name;
                    } catch (e) { }


                    aiStories = await aiContentService.generateStoryBatch(8, latestPersonaName);
                    localStorage.setItem(STORAGE_KEY + '_ai', JSON.stringify(aiStories));
                }

                // 3. Merge: Real Stories First, then AI Stories
                const combinedStories = [...realStories, ...aiStories];


                // Deduplicate by user ID just in case
                const uniqueStories = Array.from(new Map(combinedStories.map(s => [s.user.handle, s])).values());

                setStories(uniqueStories);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueStories));

            } catch (e) {
                console.error("Story load failed", e);
            }
        };

        // Initial Load
        initStories();

        // Listen for new stories
        const handleNewStory = () => {

            initStories();
        };
        window.addEventListener('geo-terra:story-created', handleNewStory);

        return () => {
            window.removeEventListener('geo-terra:story-created', handleNewStory);
        };
    }, []);

    // Story Playback Timer & Auto-Advance
    useEffect(() => {
        if (activeStoryIdx === null) return;
        const story = stories[activeStoryIdx];
        if (!story) return;

        // Pause timer if replying or generating
        if (isReplying || isGenerating) return;


        setProgress(0);

        const currentItem = story.items[0];
        let timer: NodeJS.Timeout;

        // If it's an image, we need to manually drive progress and advance
        if (currentItem.type === 'image') {
            const duration = currentItem.duration || 5000;
            const startTime = Date.now();

            timer = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const newProgress = Math.min(100, (elapsed / duration) * 100);
                setProgress(newProgress);

                if (elapsed >= duration) {
                    clearInterval(timer);
                    handleNext();
                }
            }, 50);
        }

        return () => {
            if (timer) clearInterval(timer);
        };

    }, [activeStoryIdx, stories, isReplying, isGenerating]); // Removed recursive dependency on stories causing loops, using index mainly
    const handleReply = async (text: string) => {
        if (!activeStoryIdx || !stories[activeStoryIdx]) return;

        setIsGenerating(true);

        const story = stories[activeStoryIdx];
        const user = story.user;



        // 1. Close Story (Removed default close, moved to end)
        // handleClose();

        // 2. Identify/Create Persona
        // If it's an AI story (isAi=true) or we treat all stories as potential connections
        // ideally we fetch from personaService or use story user data
        const { personaService } = await import('../services/personaService');
        const { chatService } = await import('../services/chatService');
        const { createNotification } = await import('../services/notificationService');
        const { chatWithPersona } = await import('../services/geminiService');

        // 2a. Infer Location Context
        // Try to get a real location from the caption so we don't pin (0,0) on the globe
        const { inferLocationFromCaption } = await import('../services/geminiService');
        const inferred = await inferLocationFromCaption(story.items[0].caption || '');

        const mockLocation: any = {
            id: inferred ? `loc_${Date.now()}` : 'story-loc', // Unique ID if real
            name: inferred?.name || 'Unknown Location',
            latitude: inferred?.lat || 0,
            longitude: inferred?.lng || 0,
            description: story.items[0].caption || 'Story',
            // If we have 0,0, we might want to flag it so the map doesn't render a marker?
            // For now, let's hope inference works or user ignores "Unknown" if it doesn't fly.
            isUnknown: !inferred,
            isStory: true // Flag to suppress map marker
        };

        // 2. Fetch/Generate Persona Data
        let localPersona: any = null;

        if (user.isAi) {
            const existing = await personaService.getPersonaByName(user.name);
            if (existing) {
                localPersona = {
                    ...existing,
                    imageUrl: user.avatarUrl // Ensure consistency
                };
            }
        }

        // If still null (New AI or fallback), GENERATE rich profile
        if (!localPersona) {
            const { generatePersonaFromStory } = await import('../services/geminiService');
            localPersona = await generatePersonaFromStory(
                user.name,
                user.avatarUrl,
                story.items[0].caption || 'Checking in',
                story.items[0].type
            );
        }

        // Force origin to story for map suppression
        localPersona.origin = 'story';

        try {
            // 3. Create/Get Session
            // We use createSession which handles DB insertion
            const session = await chatService.createSession(localPersona, mockLocation);

            // 4. Save User Message
            await chatService.saveMessage(session.id, { role: 'user', text });

            // 5. Trigger AI Response (Async)
            // Pass Story Context explicitly to the MCP, NOT as a fake history message.
            const storyContext = `User is replying to a ${story.items[0].type} story. Caption: "${story.items[0].caption || 'Checking in...'}"`;

            // Clean history (just previous messages if any, here we just have user's new message)
            const conversationHistory: ChatMessage[] = [{ role: 'user', text }];

            chatWithPersona(localPersona, 'Story Context', conversationHistory, text, storyContext).then(async (response) => {
                const aiText = response.text;

                // 6. Save AI Message
                await chatService.saveMessage(session.id, { role: 'model', text: aiText });

                // 7. Trigger Notification Popup
                await createNotification(localStorage.getItem('user_id_v2')!, 'NEW_MESSAGE', {
                    senderName: localPersona.name,
                    message: aiText,
                    senderAvatar: localPersona.avatarUrl,
                    sessionId: session.id, // Payload to open chat later
                    uniqueId: `reply_${Date.now()}` // Ensure it pops
                });

            }).catch(err => console.error("Reply AI Gen failed", err));

            // Success - Close Story
            setIsGenerating(false);
            handleClose();

        } catch (e) {
            console.error("Handle Reply Failed", e);
            setIsGenerating(false);
        }
    };

    const handleOpenStory = (index: number) => {
        setActiveStoryIdx(index);
        // Mark as viewed
        const newStories = [...stories];
        newStories[index].viewed = true;
        setStories(newStories);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newStories));
    };

    const handleClose = () => {
        setActiveStoryIdx(null);
        setProgress(0);
        setIsReplying(false);
        setIsGenerating(false);
    };

    const handleNext = () => {
        if (activeStoryIdx !== null && activeStoryIdx < stories.length - 1) {
            handleOpenStory(activeStoryIdx + 1);
        } else {
            handleClose();
        }
    };

    const handlePrev = () => {
        if (activeStoryIdx !== null && activeStoryIdx > 0) {
            handleOpenStory(activeStoryIdx - 1);
        }
    };

    // Helper for time ago
    const getTimeAgo = (isoDate: string) => {
        const diff = Date.now() - new Date(isoDate).getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor(diff / (1000 * 60));
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    };

    if (stories.length === 0) return null;

    const activeStory = activeStoryIdx !== null ? stories[activeStoryIdx] : null;

    return (
        <>
            {/* Bottom Story Tray - Glassmorphism Dock */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40">
                <div className="flex gap-4 p-3 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-x-auto max-w-[90vw] scrollbar-hide">
                    {stories.map((story, i) => (
                        <button
                            key={story.id}
                            onClick={() => handleOpenStory(i)}
                            className="flex flex-col items-center gap-2 group relative"
                        >
                            {/* Avatar Container with Single Tone Amber Glow */}
                            <div className={`relative p-[3px] rounded-full transition-all duration-300 ${story.viewed
                                ? 'bg-white/10'
                                : 'bg-transparent border-2 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-pulse-slow'
                                } group-hover:scale-105`}>
                                <div className="bg-black rounded-full overflow-hidden w-16 h-16 relative z-10 border-2 border-black">
                                    <img
                                        src={story.user.avatarUrl}
                                        alt={story.user.handle}
                                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                    />
                                </div>

                                {/* Live Indicator Dot for unseen */}
                                {!story.viewed && (
                                    <div className="absolute 0 right-1 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-black z-20 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                                )}
                            </div>

                            <span className={`text-[10px] font-bold tracking-wider truncate w-16 text-center shadow-black drop-shadow-md ${story.viewed ? 'text-gray-500' : 'text-amber-100'}`}>
                                {story.user.name.split(' ')[0]}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Full Screen Overlay - Immersive Mode */}
            {activeStory && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">

                    {/* Main Container */}
                    <div className="relative w-full h-full md:w-[480px] md:h-[92vh] md:rounded-[2rem] bg-gray-900 border border-white/10 overflow-hidden shadow-2xl flex flex-col">

                        {/* Progress Bar */}
                        <div className="absolute top-0 left-0 w-full z-30 flex gap-1 p-3 pt-4">
                            <div className="h-1 bg-white/20 rounded-full flex-1 overflow-hidden backdrop-blur-sm">
                                <div
                                    className="h-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] transition-all duration-100 ease-linear"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>

                        {/* Header Info */}
                        <div className="absolute top-6 left-0 w-full z-30 px-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-[2px] border border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] rounded-full">
                                    <img src={activeStory.user.avatarUrl} className="w-9 h-9 rounded-full border-2 border-black" />
                                </div>
                                <div className="flex flex-col drop-shadow-md">
                                    <span className="text-white text-sm font-black tracking-wide font-display">{activeStory.user.handle.toLowerCase()}</span>
                                    <span className="text-amber-200/80 text-[10px] font-mono tracking-wider flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                                        {getTimeAgo(activeStory.items[0].takenAt)}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all border border-white/5"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Media Layer (Image or Video) */}
                        <div className="flex-1 relative bg-black group" onClick={(e) => {
                            const width = e.currentTarget.offsetWidth;
                            const x = e.nativeEvent.offsetX;
                            if (x < width / 3) handlePrev();
                            else if (x > width * 2 / 3) handleNext();
                        }}>
                            {activeStory.items[0].type === 'video' ? (
                                <video
                                    ref={videoRef}
                                    src={activeStory.items[0].url}
                                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                    autoPlay
                                    playsInline
                                    muted={false}
                                    onTimeUpdate={(e) => {
                                        const v = e.currentTarget;
                                        if (v.duration) {
                                            setProgress((v.currentTime / v.duration) * 100);
                                        }
                                    }}
                                    onEnded={handleNext}
                                />
                            ) : (
                                <>
                                    <img
                                        src={activeStory.items[0].url}
                                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                        alt={`Story by ${activeStory.user.handle}`}
                                        onError={(e) => {
                                            console.error("Image failed to load:", activeStory.items[0].url);
                                            e.currentTarget.src = "https://via.placeholder.com/400x800?text=Image+Load+Error";
                                        }}
                                        onLoad={() => {

                                        }}
                                    />
                                    {/* Debug overlay to see if URL is present - remove in production checks if desired, but helpful now */}
                                    {/* <div className="absolute top-20 left-4 bg-black/50 text-white text-xs p-2 max-w-[80%] break-all z-50 pointer-events-none">
                                        DEBUG: {activeStory.items[0].url}
                                    </div> */}
                                </>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none" />

                            {/* AI Content Caption - Restored to Bottom (Safe Area) */}
                            {activeStory.items[0].caption && (
                                <div className="absolute bottom-32 left-0 w-full px-8 z-30 pointer-events-none">
                                    <p className="text-white/90 text-lg font-medium text-center drop-shadow-md font-display animate-in slide-in-from-bottom-2 duration-700">
                                        "{activeStory.items[0].caption}"
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Bottom Interactions */}
                        <div className="absolute bottom-0 left-0 w-full p-6 z-30 flex items-center gap-4">
                            <form
                                className="flex-1 flex gap-2"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const input = e.currentTarget.querySelector('input') as HTMLInputElement;
                                    if (input.value.trim()) {
                                        handleReply(input.value.trim());
                                        input.value = '';
                                    }
                                }}
                            >
                                <input
                                    type="text"
                                    placeholder={`Reply to ${activeStory.user.name.split(' ')[0]}...`}
                                    className="flex-1 h-12 bg-white/5 backdrop-blur-xl rounded-full border border-white/10 px-5 text-white text-sm placeholder:text-white/50 focus:bg-white/10 focus:border-white/30 outline-none transition-all"
                                    onKeyDown={(e) => e.stopPropagation()}
                                    onFocus={() => setIsReplying(true)}
                                    onBlur={() => setIsReplying(false)}
                                    disabled={isGenerating}
                                />
                                <button type="submit" disabled={isGenerating} className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/50 transition-all group shrink-0 disabled:opacity-50">
                                    {isGenerating ? <div className="w-4 h-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin" /> : <Send size={22} className="group-hover:scale-110 transition-transform -ml-0.5 mt-0.5" />}
                                </button>
                            </form>
                            <button className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-cyan-500/20 hover:text-cyan-400 hover:border-cyan-500/50 transition-all group">
                                <Heart size={24} className="group-hover:scale-110 transition-transform" />
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </>
    );
};
