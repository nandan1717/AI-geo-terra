import React, { useEffect, useRef, useState } from 'react';
import { useNews } from '../context/NewsContext';
import { LocationMarker } from '../types';
import { X, Globe, Radio, MapPin, Heart, MessageCircle, Share2, Eye, ChevronDown } from 'lucide-react';

interface NewsFeedProps {
    onEventClick: (event: LocationMarker) => void;
}

import { TavilyService } from '../services/tavilyService';
import { Sparkles } from 'lucide-react';

const NewsCard: React.FC<{ event: LocationMarker; index: number }> = ({ event, index }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isActive, setIsActive] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // We keep local description state so we can update it on demand without refetching parent list
    const [description, setDescription] = useState(event.description);
    const [displayDate, setDisplayDate] = useState(event.publishedAt);
    const [displayImage, setDisplayImage] = useState(event.postImageUrl);
    const [displayVideo, setDisplayVideo] = useState(event.postVideoUrl);
    const [hasEnhancedDetails, setHasEnhancedDetails] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsActive(entry.isIntersecting);
            },
            { threshold: 0.6 } // High threshold for "snap" feeling
        );

        if (cardRef.current) observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, []);

    // Also sync if parent prop updates (e.g. initial load finishes later)
    useEffect(() => {
        if (event.description !== description && !hasEnhancedDetails) setDescription(event.description);
        if (event.publishedAt !== displayDate && !hasEnhancedDetails) setDisplayDate(event.publishedAt);
        if (event.postImageUrl !== displayImage && !hasEnhancedDetails) setDisplayImage(event.postImageUrl);
        if (event.postVideoUrl !== displayVideo && !hasEnhancedDetails) setDisplayVideo(event.postVideoUrl);
    }, [event.description, event.publishedAt, event.postImageUrl, event.postVideoUrl]);

    // Auto-fetch details when card is active (visible) to correct the date/image
    useEffect(() => {
        if (isActive && !hasEnhancedDetails && !isLoadingDetails) {
            handleReadMore(true); // Re-use the fetch logic, but maybe don't expand?
            // Actually, handleReadMore toggles expansion. We just want the fetch.
            // Let's extract the fetch logic.
            fetchDetails();
        }
    }, [isActive]);

    const fetchDetails = async () => {
        if (hasEnhancedDetails || isLoadingDetails) return;
        setIsLoadingDetails(true);
        try {
            const { fetchEventDetails } = await import('../services/gdeltService');
            const details = await fetchEventDetails(event.name);
            if (details) {
                if (details.newDesc && details.newDesc.length > (description?.length || 0)) {
                    setDescription(details.newDesc);
                }
                if (details.newDate) setDisplayDate(details.newDate);
                if (details.newImage) setDisplayImage(details.newImage);
            }
            // For now, let's just assume the hook below (which doesn't exist yet) or just update local state if we add it.
            // Wait, the currently implemented NewsCard uses `event.publishedAt` directly in the render.
            // We need reference to local `publishedAt` state.
            setIsLoadingDetails(false);
            setHasEnhancedDetails(true);
        } catch (e) {
            setIsLoadingDetails(false);
        }
    };

    const handleReadMore = async (onlyFetch = false) => {
        if (typeof onlyFetch !== 'boolean') onlyFetch = false; // Event handler guard

        if (!onlyFetch) {
            if (isExpanded) {
                setIsExpanded(false);
                return;
            }
            setIsExpanded(true);
        }

        // Fetch if needed
        fetchDetails();
    };

    return (
        <div
            ref={cardRef}
            data-index={index}
            className="news-card w-full h-full snap-start snap-always relative flex flex-col bg-gray-900 border-b border-white/5 overflow-hidden group"
        >
            {/* Background Media - Video or Image */}
            <div className="absolute inset-0 z-0">
                {displayVideo ? (
                    <video
                        src={displayVideo}
                        poster={displayImage}
                        autoPlay={isActive}
                        muted
                        loop
                        playsInline
                        className={`w-full h-full object-cover transition-transform duration-[10s] ease-linear ${isActive ? 'scale-110' : 'scale-100'}`}
                    />
                ) : displayImage ? (
                    <img
                        src={displayImage}
                        alt={event.name}
                        className={`w-full h-full object-cover transition-transform duration-[10s] ease-linear ${isActive ? 'scale-110' : 'scale-100'}`}
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
            </div>

            {/* Content Layer */}
            <div className="relative z-10 flex-1 flex flex-row items-end p-6 pb-24 md:pb-12 w-full h-full gap-4">

                {/* Text Content - Animates In */}
                <div className={`flex-1 flex flex-col justify-end transition-all duration-700 transform ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                    }`}>
                    {/* Tags */}
                    <div className="mb-3 flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full backdrop-blur-md border ${event.category === 'Environmental' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                            event.category === 'Conflict' ? 'bg-orange-600/20 text-orange-300 border-orange-500/30' :
                                'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            }`}>
                            {event.category || 'NEWS'}
                        </span>
                        <span className="text-[10px] text-gray-300 flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded-full border border-white/10">
                            <MapPin size={10} className="text-white" /> {event.country}
                        </span>
                    </div>

                    {/* Title */}
                    <h2 className={`font-black text-white leading-tight mb-2 drop-shadow-lg tracking-tight ${event.postVideoUrl ? 'text-3xl md:text-4xl font-serif italic' : 'text-2xl md:text-3xl font-display'}`}>
                        {event.name}
                    </h2>

                    {/* Collapsible Description - Less Clutter */}
                    <div className="mb-4">
                        <div
                            className={`space-y-3 transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide' : 'max-h-16'}`}
                        >
                            <p className="text-sm text-gray-200 leading-relaxed" onClick={handleReadMore}>
                                {isLoadingDetails ? (
                                    <span className="animate-pulse text-gray-400">Updating intel...</span>
                                ) : (
                                    description
                                )}
                            </p>
                        </div>
                        <button
                            onClick={() => handleReadMore()}
                            className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-2 flex items-center gap-1 hover:text-white transition-colors"
                        >
                            {isLoadingDetails ? 'Scanning...' : (isExpanded ? 'Show Less' : 'Read More')} <ChevronDown size={10} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {/* Metadata (Hidden for AI Posts) */}
                    {!event.postVideoUrl && (
                        <div className="flex items-center gap-2 mb-4">
                            {event.sourceUrl && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => window.open(event.sourceUrl, '_blank')}>
                                    <Globe size={10} className="text-gray-400" />
                                    <span className="text-[10px] font-mono text-gray-300 uppercase">
                                        {tryParseUrl(event.sourceUrl)}
                                    </span>
                                </div>
                            )}
                            <span className="text-[10px] text-gray-500 font-mono">
                                • {timeAgo(displayDate)}
                            </span>
                        </div>
                    )}

                    {/* AI Post Special Styling or GDELT Citation */}
                    {!event.postVideoUrl && !event.sourceUrl?.includes('pexels') ? (
                        <div className="text-[8px] text-white/30 font-mono uppercase tracking-widest hover:text-white/60 transition-colors mb-2">
                            Intel via <a href="https://www.gdeltproject.org/" target="_blank" rel="noreferrer" className="hover:text-blue-400">GDELT Project</a>
                        </div>
                    ) : (
                        // AI Post Footer (Minimal)
                        <div className="mb-2"></div>
                    )}
                </div>

                {/* Right Actions - Staggered Animation */}
                <div className={`flex flex-col gap-5 items-center pb-4 shrink-0 transition-all duration-1000 delay-300 transform ${isActive ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0'
                    }`}>
                    <ActionButton icon={<Heart size={26} />} label="Like" />
                    <ActionButton icon={<MessageCircle size={26} />} label="Discuss" />
                    <ActionButton icon={<Share2 size={26} />} label="Share" />
                    <button
                        onClick={() => event.sourceUrl && window.open(event.sourceUrl, '_blank')}
                        className="flex flex-col items-center gap-1 group mt-2"
                    >
                        <div className="w-10 h-10 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.6)] animate-pulse hover:scale-110 transition-transform">
                            <Eye size={20} />
                        </div>
                        <span className="text-[9px] font-bold text-white drop-shadow-md">View</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const ActionButton = ({ icon, label }: { icon: React.ReactNode, label: string }) => (
    <button className="flex flex-col items-center gap-1.5 group">
        <div className="p-2 rounded-full text-white transition-all group-hover:scale-110 group-active:scale-90 drop-shadow-xl">
            {icon}
        </div>
        <span className="text-[10px] font-bold text-white shadow-black drop-shadow-md opacity-90">{label}</span>
    </button>
);

// Helpers
const tryParseUrl = (url: string) => {
    try { return new URL(url).hostname.replace('www.', ''); } catch (e) { return 'Source'; }
};
const timeAgo = (dateStr?: string) => {
    if (!dateStr) return 'LIVE';

    // Safety check for invalid dates
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'UNKNOWN';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    // Handle Future Dates (Clock skew or GDELT ingest time slightly ahead)
    if (diffSec < 0) return 'JUST NOW';

    if (diffSec < 60) return 'JUST NOW';
    if (diffMin < 60) return `${diffMin}M AGO`;
    if (diffHour < 24) return `${diffHour}H AGO`;
    if (diffDay === 1) return 'YESTERDAY';
    if (diffDay < 7) return `${diffDay}D AGO`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};


const NewsFeed: React.FC<NewsFeedProps> = ({ onEventClick }) => {
    const { newsEvents, isLoading, isNewsFeedOpen, toggleNewsFeed, loadMore, selectedVibe, setVibe } = useNews();
    const scrollRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Infinite Scroll Trigger (Parent Observer)
    useEffect(() => {
        const options = {
            root: scrollRef.current,
            rootMargin: '0px',
            threshold: 0.1
        };

        const handleIntersect = (entries: IntersectionObserverEntry[]) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const index = Number(entry.target.getAttribute('data-index'));
                    // Trigger loadMore when user sees the 7th item from end (seamless)
                    if (index >= newsEvents.length - 7) loadMore();
                }
            });
        };

        observerRef.current = new IntersectionObserver(handleIntersect, options);

        // We need to re-observe when list changes. 
        // Note: The Card itself handles its own "Active" state, 
        // but this observer is just for loading more.
        const cards = document.querySelectorAll('.news-card');
        cards.forEach(card => observerRef.current?.observe(card));

        return () => {
            if (observerRef.current) observerRef.current.disconnect();
        };
    }, [newsEvents, loadMore]);


    if (!isNewsFeedOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm md:backdrop-blur-none pointer-events-auto">
            {/* Close Button */}
            <button
                onClick={toggleNewsFeed}
                className="absolute top-4 right-4 z-[60] w-10 h-10 bg-black/50 border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all hover:scale-110 active:scale-95"
            >
                <X size={20} />
            </button>

            <div className="w-full h-full md:w-[450px] md:h-[90vh] md:rounded-3xl relative bg-black border-x border-white/10 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300">

                {/* Header Overlay */}
                <div className="absolute top-0 left-0 w-full p-6 z-20 bg-gradient-to-b from-black/80 via-black/60 to-transparent flex flex-col gap-4 pointer-events-none">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                                <Globe size={18} className="text-white animate-pulse" />
                            </div>
                            <div>
                                <h2 className="text-white font-bold text-base tracking-widest font-display shadow-black drop-shadow-md">GLOBAL INTEL</h2>
                                <p className="text-[10px] text-blue-200 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
                                    Live Satellite Feed
                                </p>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Feed Container (Snap Scroll) */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto snap-y snap-mandatory scrollbar-hide bg-[#050505]" // Removed padding causing bleed
                >
                    {newsEvents.length === 0 && isLoading && (
                        <div className="w-full h-screen flex flex-col items-center justify-center text-gray-500">
                            <div className="relative mb-6">
                                <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 animate-pulse"></div>
                                <Globe size={64} className="animate-spin-slow opacity-80 text-blue-400 relative z-10" />
                            </div>
                            <p className="text-xs tracking-[0.3em] font-mono text-blue-400/80 animate-pulse">ESTABLISHING SECURE UPLINK...</p>
                        </div>
                    )}

                    {newsEvents.map((event, idx) => (
                        <NewsCard key={`${event.id}-${idx}`} event={event} index={idx} />
                    ))}

                    {/* Loading Indicator at Bottom */}
                    {isLoading && newsEvents.length > 0 && (
                        <div className="snap-center h-48 flex flex-col items-center justify-center w-full bg-black/80">
                            <Radio className="animate-pulse text-blue-500 mb-2" size={32} />
                            <span className="text-xs font-mono text-blue-500/70 tracking-widest">FETCHING DATA STREAMS...</span>
                        </div>
                    )}
                </div>

                {/* Vibe Selector (Floating Dock) */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-auto max-w-[95%]">
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide p-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                        {[
                            { id: 'Trending', label: 'Trending', icon: '🔥' },
                            { id: 'High Energy', label: 'Hype', icon: '⚡' },
                            { id: 'Chill', label: 'Chill', icon: '✨' },
                            { id: 'Inspiration', label: 'Inspire', icon: '💡' },
                            { id: 'Intense', label: 'Intense', icon: '🚨' },
                        ].map((vibe) => (
                            <button
                                key={vibe.id}
                                onClick={() => setVibe(vibe.id as any)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] md:text-xs font-bold whitespace-nowrap transition-all duration-300 ${selectedVibe === vibe.id
                                    ? 'bg-white text-black shadow-lg scale-105'
                                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                <span>{vibe.icon}</span>
                                {vibe.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewsFeed;
