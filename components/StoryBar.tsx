
import React, { useEffect, useState, useRef } from 'react';
import { Story, StoryItem } from '../types';
import { aiContentService } from '../services/aiContentService';
import { chatService } from '../services/chatService';
import { X, Heart, Send } from 'lucide-react';

const STORAGE_KEY = 'geo-terra-stories';

export const StoryBar: React.FC = () => {
    const [stories, setStories] = useState<Story[]>([]);
    const [activeStoryIdx, setActiveStoryIdx] = useState<number | null>(null);
    const [progress, setProgress] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Load / Init Stories
    useEffect(() => {
        const initStories = async () => {
            try {
                // 1. Get latest chat persona
                // We wrap this in try-catch to avoid breaking if chatService fails (e.g. auth)
                let latestPersonaName: string | undefined;
                try {
                    const recentSessions = await chatService.getRecentSessions();
                    if (recentSessions.length > 0) {
                        latestPersonaName = recentSessions[0].persona_name;
                    }
                } catch (err) {
                    console.warn("Could not fetch recent sessions for story bar", err);
                }

                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    const parsed: Story[] = JSON.parse(stored);
                    const now = Date.now();

                    // Check if valid and not expired (using first story's expiry as batch proxy)
                    const isValid = parsed.length > 0 && parsed[0].expiresAt > now;

                    // Check if priority persona is present (if we have one)
                    const hasLatestPersona = !latestPersonaName || parsed.some(s => s.user.name === latestPersonaName);

                    if (isValid && hasLatestPersona) {
                        // Re-sort local cache to put latest persona first
                        if (latestPersonaName) {
                            const pIndex = parsed.findIndex(s => s.user.name === latestPersonaName);
                            if (pIndex > 0) {
                                const [pStory] = parsed.splice(pIndex, 1);
                                parsed.unshift(pStory);
                            }
                        }
                        setStories(parsed);
                        return;
                    }
                }

                // Gen new batch
                console.log("Generating new Story Batch...", latestPersonaName);
                const newStories = await aiContentService.generateStoryBatch(8, latestPersonaName);
                setStories(newStories);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newStories));

            } catch (e) {
                console.error("Story load failed", e);
            }
        };

        initStories();
    }, []);

    // Story Playback Timer
    useEffect(() => {
        if (activeStoryIdx === null) return;
        const story = stories[activeStoryIdx];
        if (!story) return;

        setProgress(0);

        // Auto-advance logic handled by video 'onEnded' usually, 
        // but let's add a fallback timer for safety or if images used later.

    }, [activeStoryIdx]);

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

                        {/* Video Layer */}
                        <div className="flex-1 relative bg-black group" onClick={(e) => {
                            const width = e.currentTarget.offsetWidth;
                            const x = e.nativeEvent.offsetX;
                            if (x < width / 3) handlePrev();
                            else if (x > width * 2 / 3) handleNext();
                        }}>
                            <video
                                ref={videoRef}
                                src={activeStory.items[0].url}
                                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                autoPlay
                                playsInline
                                muted={false} // Enable Sound
                                onTimeUpdate={(e) => {
                                    const v = e.currentTarget;
                                    if (v.duration) {
                                        setProgress((v.currentTime / v.duration) * 100);
                                    }
                                }}
                                onEnded={handleNext}
                            />
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
                            <div className="flex-1 h-12 bg-white/5 backdrop-blur-xl rounded-full border border-white/10 px-5 flex items-center text-white/50 text-sm hover:bg-white/10 transition-colors cursor-text">
                                Reply to {activeStory.user.name.split(' ')[0]}...
                            </div>
                            <button className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-cyan-500/20 hover:text-cyan-400 hover:border-cyan-500/50 transition-all group">
                                <Heart size={24} className="group-hover:scale-110 transition-transform" />
                            </button>
                            <button className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/50 transition-all group">
                                <Send size={22} className="group-hover:scale-110 transition-transform -ml-0.5 mt-0.5" />
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </>
    );
};
