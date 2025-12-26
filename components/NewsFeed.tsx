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
        if (event.description !== description && !hasEnhancedDetails) {
            setDescription(event.description);
        }
    }, [event.description]);

    const handleReadMore = async () => {
        if (isExpanded) {
            setIsExpanded(false);
            return;
        }

        setIsExpanded(true);

        // Lazily fetch GDELT context if we haven't yet and the current desc is short/same as title
        // or just always try to fetch better context if we haven't done it locally.
        if (!hasEnhancedDetails && !isLoadingDetails) {
            setIsLoadingDetails(true);
            try {
                // Import dynamically to avoid circular deps if needed, 
                // but standard import is fine usually. 
                // Note: We need to import fetchEventDetails.
                // Assuming it's available in props or imported.
                // We will rely on the import added at top of file.

                // Fetch better snippet
                import('../services/gdeltService').then(async ({ fetchEventDetails }) => {
                    const details = await fetchEventDetails(event.name);
                    if (details && details.newDesc && details.newDesc.length > (description?.length || 0)) {
                        setDescription(details.newDesc);
                        setHasEnhancedDetails(true);
                    }
                    setIsLoadingDetails(false);
                });
            } catch (e) {
                setIsLoadingDetails(false);
            }
        }
    };

    return (
        <div
            ref={cardRef}
            data-index={index}
            className="news-card w-full h-full snap-start snap-always relative flex flex-col bg-gray-900 border-b border-white/5 overflow-hidden group"
        >
            {/* Background Image - Slight movement when active */}
            <div className="absolute inset-0 z-0">
                {event.postImageUrl ? (
                    <img
                        src={event.postImageUrl}
                        alt={event.name}
                        className={`w-full h-full object-cover transition-transform duration-[10s] ease-linear ${isActive ? 'scale-110' : 'scale-100'
                            }`}
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
                    <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-2 drop-shadow-lg font-display tracking-tight">
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
                            onClick={handleReadMore}
                            className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-2 flex items-center gap-1 hover:text-white transition-colors"
                        >
                            {isExpanded ? 'Show Less' : 'Scanning For Details...'} <ChevronDown size={10} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {/* Metadata (Hidden when minimized for cleanliness?) --> Just minimal source */}
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
                            • {timeAgo(event.publishedAt)}
                        </span>
                    </div>

                    {/* GDELT Citation */}
                    <div className="text-[8px] text-white/30 font-mono uppercase tracking-widest hover:text-white/60 transition-colors mb-2">
                        Intel via <a href="https://www.gdeltproject.org/" target="_blank" rel="noreferrer" className="hover:text-blue-400">GDELT Project</a>
                    </div>
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
    const cleanDate = dateStr.replace('T', ' ').replace('Z', ''); // GDELT format fix if needed
    // Simple helper or just return date
    return new Date(dateStr).toLocaleDateString();
}


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
                    if (index >= newsEvents.length - 3) loadMore();
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
