import React, { useEffect, useRef } from 'react';
import { useNews } from '../context/NewsContext';
import { LocationMarker } from '../types';
import { X, Globe, Radio, ExternalLink, MapPin, Heart, MessageCircle, Share2, Eye } from 'lucide-react';

interface NewsFeedProps {
    onEventClick: (event: LocationMarker) => void;
}

const NewsFeed: React.FC<NewsFeedProps> = ({ onEventClick }) => {
    const { newsEvents, isLoading, isNewsFeedOpen, toggleNewsFeed, loadMore } = useNews();
    const scrollRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Infinite Scroll Trigger
    useEffect(() => {
        const options = {
            root: scrollRef.current,
            rootMargin: '0px',
            threshold: 0.5
        };

        const handleIntersect = (entries: IntersectionObserverEntry[]) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const index = Number(entry.target.getAttribute('data-index'));
                    // Load more when we're 3 cards from the end
                    if (index >= newsEvents.length - 3) {
                        loadMore();
                    }
                }
            });
        };

        observerRef.current = new IntersectionObserver(handleIntersect, options);

        // We need to re-observe when list changes
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
                <div className="absolute top-0 left-0 w-full p-6 z-20 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center gap-3 pointer-events-none">
                    <div className="p-2 bg-blue-600 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                        <Globe size={18} className="text-white animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-base tracking-widest font-display shadow-black drop-shadow-md">GLOBAL INTEL</h2>
                        <p className="text-[10px] text-blue-200 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
                            Live Satellite Feed • {newsEvents.length} Signals
                        </p>
                    </div>
                </div>

                {/* Feed Container (Snap Scroll) */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto snap-y snap-mandatory scrollbar-hide bg-[#050505]"
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
                        <div
                            key={`${event.id}-${idx}`}
                            data-index={idx}
                            className="news-card w-full h-full snap-center snap-always relative flex flex-col bg-gray-900 border-b border-white/5 overflow-hidden group"
                        >
                            {/* Background Image */}
                            <div className="absolute inset-0 z-0">
                                {event.postImageUrl ? (
                                    <img
                                        src={event.postImageUrl}
                                        alt={event.name}
                                        className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-[20s] ease-linear"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] opacity-80" />
                                )}
                                {/* Vignette & Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
                                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
                            </div>

                            {/* Content Layer */}
                            {/* Content Layer (Reels Layout) */}
                            <div className="relative z-10 flex-1 flex flex-row items-end p-6 pb-24 md:pb-12 w-full h-full gap-4">

                                {/* Left Content Area */}
                                <div className="flex-1 flex flex-col justify-end">
                                    <div className="mb-2 flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-700 delay-100">
                                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border backdrop-blur-md ${event.category === 'Environmental' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                                            event.category === 'Conflict' ? 'bg-orange-600/20 text-orange-300 border-orange-500/30' :
                                                'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                            }`}>
                                            {event.category || 'NEWS'}
                                        </span>
                                        <span className="text-[10px] text-gray-300 flex items-center gap-1 bg-black/40 px-2 py-1 rounded-md backdrop-blur-sm border border-white/10">
                                            <MapPin size={10} className="text-blue-400" /> {event.country}
                                        </span>
                                    </div>

                                    <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-3 drop-shadow-2xl font-display animate-in slide-in-from-bottom-4 duration-700 delay-200">
                                        {event.name}
                                    </h2>

                                    <div className="bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10 mb-4 animate-in slide-in-from-bottom-4 duration-700 delay-300">
                                        <p className="text-sm text-gray-200 line-clamp-4 leading-relaxed whitespace-pre-line">
                                            {event.description}
                                        </p>

                                        {/* Event Metadata */}
                                        <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-1">
                                            <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono tracking-wide">
                                                {event.sourceUrl && (
                                                    <span className="text-blue-300 font-bold uppercase truncate max-w-[60%]">
                                                        {(() => {
                                                            try {
                                                                return new URL(event.sourceUrl).hostname.replace('www.', '');
                                                            } catch (e) {
                                                                return 'Unknown Source';
                                                            }
                                                        })()}
                                                    </span>
                                                )}
                                                <span>
                                                    {(() => {
                                                        if (!event.publishedAt) return 'LIVE';
                                                        try {
                                                            const date = new Date(event.publishedAt);
                                                            return date.toLocaleDateString(undefined, {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                year: 'numeric'
                                                            });
                                                        } catch (e) {
                                                            return 'LIVE';
                                                        }
                                                    })()}
                                                </span>
                                            </div>
                                            <div className="text-[9px] text-gray-600 font-sans opacity-60">
                                                Data provided by the GDELT Project (<a href="https://www.gdeltproject.org/" target="_blank" rel="noreferrer" className="hover:text-blue-400 transition-colors">https://www.gdeltproject.org/</a>)
                                            </div>
                                        </div>
                                    </div>

                                    {/* Main CTA Button */}
                                    <button
                                        onClick={() => {
                                            if (event.sourceUrl) window.open(event.sourceUrl, '_blank');
                                        }}
                                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] font-bold tracking-wide animate-in slide-in-from-bottom-4 duration-700 delay-500"
                                    >
                                        <Eye size={18} />
                                        <span>See Whole Scenario</span>
                                    </button>
                                </div>

                                {/* Right Vertical Action Stack */}
                                <div className="flex flex-col gap-4 items-center animate-in slide-in-from-right-4 duration-700 delay-500 pb-2 shrink-0">
                                    <button className="flex flex-col items-center gap-1 group">
                                        <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white group-hover:bg-white/20 transition-all active:scale-90 shadow-lg">
                                            <Heart size={24} className="group-hover:text-red-500 transition-colors" />
                                        </div>
                                        <span className="text-[10px] font-bold text-white shadow-black drop-shadow-md">Like</span>
                                    </button>

                                    <button className="flex flex-col items-center gap-1 group">
                                        <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white group-hover:bg-white/20 transition-all active:scale-90 shadow-lg">
                                            <MessageCircle size={24} />
                                        </div>
                                        <span className="text-[10px] font-bold text-white shadow-black drop-shadow-md">Comment</span>
                                    </button>

                                    <button className="flex flex-col items-center gap-1 group">
                                        <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white group-hover:bg-white/20 transition-all active:scale-90 shadow-lg">
                                            <Share2 size={24} />
                                        </div>
                                        <span className="text-[10px] font-bold text-white shadow-black drop-shadow-md">Share</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Loading Indicator at Bottom */}
                    {isLoading && newsEvents.length > 0 && (
                        <div className="snap-center h-48 flex flex-col items-center justify-center w-full bg-black/80">
                            <Radio className="animate-pulse text-blue-500 mb-2" size={32} />
                            <span className="text-xs font-mono text-blue-500/70 tracking-widest">FETCHING DATA STREAMS...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NewsFeed;
