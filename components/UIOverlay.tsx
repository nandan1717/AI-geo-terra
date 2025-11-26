import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, X, Loader2, Radio, Info, Users, Send, Minus, Plus, Navigation, Globe, ChevronLeft, Sparkles, Activity, History, MessageSquare, AlertCircle as AlertIcon, Crosshair, LogOut, HelpCircle, User as UserIcon, Clock } from 'lucide-react';
import { LocationMarker, SearchState, LocalPersona, ChatMessage, CrowdMember } from '../types';

import WeatherTimeDisplay from './WeatherTimeDisplay';
import Sidebar from './Sidebar';



interface UIOverlayProps {
    onSearch: (query: string) => void;
    onClearResults: () => void;
    searchState: SearchState;

    markers: LocationMarker[];
    selectedMarker: LocationMarker | null;
    onSelectMarker: (marker: LocationMarker) => void;
    onCloseMarker: () => void;

    onUseCurrentLocation: () => void;

    // Crowd & Chat
    crowd: LocalPersona[];
    isLoadingCrowd: boolean;
    onCustomCrowdSearch: (query: string) => void;
    onSelectMember: (member: CrowdMember) => void;

    persona: LocalPersona | null;
    isSummoning: boolean;
    onClosePersona: () => void;

    lastPersona: LocalPersona | null;
    onResumeChat: () => void;

    chatHistory: ChatMessage[];
    onSendMessage: (text: string) => void;
    isChatLoading: boolean;
    suggestions?: string[];

    timezone?: string;

    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetView: () => void;

    // Auth & Tutorial
    userEmail?: string;
    onSignOut: () => void;
    onRestartTutorial: () => void;
    onResumeSession: (sessionId: string, persona: LocalPersona, location: LocationMarker) => void;
}

const HistoryList: React.FC<{ onResume: (id: string, p: LocalPersona, l: LocationMarker) => void, onClose: () => void }> = ({ onResume, onClose }) => {
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchSessions = useCallback(() => {
        setLoading(true);
        import('../services/chatService').then(({ chatService }) => {
            chatService.getRecentSessions(searchQuery).then(setSessions).finally(() => setLoading(false));
        });
    }, [searchQuery]);

    useEffect(() => {
        const timer = setTimeout(fetchSessions, 300);
        return () => clearTimeout(timer);
    }, [fetchSessions]);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this chat?")) {
            const { chatService } = await import('../services/chatService');
            await chatService.deleteSession(id);
            fetchSessions();
        }
    };

    const handleToggleFavorite = async (e: React.MouseEvent, id: string, currentStatus: boolean) => {
        e.stopPropagation();
        const { chatService } = await import('../services/chatService');
        await chatService.toggleFavorite(id, !currentStatus);
        fetchSessions();
    };

    return (
        <div className="flex flex-col h-full">
            <div className="px-2 mb-2">
                <input
                    type="text"
                    placeholder="Search history..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                />
            </div>

            {loading ? (
                <div className="p-4 text-center text-xs text-gray-500">Loading history...</div>
            ) : sessions.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">No chats found.</div>
            ) : (
                <div className="space-y-1">
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => {
                                onResume(session.id, session.persona_data, {
                                    id: `loc_${session.location_lat}_${session.location_lng}`,
                                    name: session.location_name,
                                    latitude: session.location_lat,
                                    longitude: session.location_lng,
                                    description: "Resumed Location",
                                    type: "Place"
                                });
                                onClose();
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 flex items-center gap-3 transition-colors group cursor-pointer relative"
                        >
                            <img src={session.persona_image_url} alt={session.persona_name} className="w-8 h-8 rounded-full object-cover border border-white/10" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                    <p className="text-xs font-bold text-white truncate">{session.persona_name}</p>
                                    {session.is_favorite && <Sparkles size={10} className="text-yellow-400 fill-yellow-400" />}
                                </div>
                                <p className="text-[10px] text-gray-400 truncate">{session.location_name}</p>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => handleToggleFavorite(e, session.id, session.is_favorite)}
                                    className={`p-1.5 rounded-full hover:bg-white/20 ${session.is_favorite ? 'text-yellow-400' : 'text-gray-400'}`}
                                    title="Favorite"
                                >
                                    <Sparkles size={12} className={session.is_favorite ? "fill-yellow-400" : ""} />
                                </button>
                                <button
                                    onClick={(e) => handleDelete(e, session.id)}
                                    className="p-1.5 rounded-full hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                                    title="Delete"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const UIOverlay: React.FC<UIOverlayProps> = ({
    onSearch,
    onClearResults,
    searchState,
    markers,
    selectedMarker,
    onSelectMarker,
    onCloseMarker,
    onUseCurrentLocation,

    crowd,
    isLoadingCrowd,
    onCustomCrowdSearch,
    onSelectMember,

    persona,
    isSummoning,
    onClosePersona,

    lastPersona,
    onResumeChat,

    chatHistory,
    onSendMessage,
    isChatLoading,
    suggestions = [],

    timezone,

    onZoomIn,
    onZoomOut,
    onResetView,

    userEmail,
    onSignOut,
    onRestartTutorial,
    onResumeSession
}) => {
    const [inputValue, setInputValue] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [isMobile, setIsMobile] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false); // Profile Menu State

    const inputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const [isMinimized, setIsMinimized] = useState(false);
    const [isCustomSearching, setIsCustomSearching] = useState(false); // Custom Search State
    const [chatPosition, setChatPosition] = useState({ x: 20, y: 80 }); // Default desktop position
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Reset custom searching state when loading finishes
    useEffect(() => {
        if (!isLoadingCrowd) {
            setIsCustomSearching(false);
        }
    }, [isLoadingCrowd]);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, persona, suggestions, isMinimized]);

    // Drag Handlers
    const handleDragStart = (e: React.MouseEvent) => {
        if (isMobile) return;
        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - chatPosition.x,
            y: e.clientY - chatPosition.y
        };
    };

    useEffect(() => {
        const handleDragMove = (e: MouseEvent) => {
            if (!isDragging) return;
            setChatPosition({
                x: e.clientX - dragOffset.current.x,
                y: e.clientY - dragOffset.current.y
            });
        };

        const handleDragEnd = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd);
        }

        return () => {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
        };
    }, [isDragging]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            onSearch(inputValue);
            if (isMobile) inputRef.current?.blur();
        }
    };

    const handleClearSearch = () => {
        setInputValue('');
        onClearResults();
    }

    const handleChatSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (chatInput.trim() && !isChatLoading) {
            onSendMessage(chatInput);
            setChatInput('');
        }
    }

    const handleSuggestionClick = (suggestion: string) => {
        if (!isChatLoading) {
            onSendMessage(suggestion);
        }
    };

    const suggestionsList = [
        "Tokyo", "Paris", "New York", "Cairo", "Rio de Janeiro", "Sydney"
    ];

    const showSearch = !persona;
    const showResultsList = !persona && markers.length > 0 && !selectedMarker;
    const showMarkerSheet = selectedMarker && !persona && crowd.length === 0;
    const showCrowdSelection = crowd.length > 0 && !persona;
    const showChat = !!persona;

    return (
        <div className="absolute inset-0 pointer-events-none font-sans text-white flex flex-col">

            {/* --- 0. WEATHER & TIME --- */}
            <div id="weather-display" className="absolute top-2 right-2 md:top-6 md:right-24 z-40 pointer-events-auto scale-90 md:scale-100 origin-top-right flex items-start gap-4">
                <WeatherTimeDisplay timezone={timezone} />
            </div>

            {/* --- SIDEBAR --- */}
            <Sidebar
                onProfileClick={() => setIsProfileOpen(!isProfileOpen)}
                onAddFriendsClick={() => console.log("Add Friends clicked")}
                onNotificationsClick={() => console.log("Notifications clicked")}
                onSettingsClick={() => console.log("Settings clicked")}
            />

            {/* PROFILE MENU POPUP (Anchored to Sidebar) */}
            {isProfileOpen && (
                <div className="absolute top-1/2 right-20 -translate-y-1/2 z-50 w-80 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-right max-h-[80vh] flex flex-col pointer-events-auto">
                    <div className="p-4 border-b border-white/5 bg-white/5 shrink-0">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Signed in as</p>
                        <p className="text-sm font-bold text-white truncate" title={userEmail}>{userEmail || 'Explorer'}</p>
                    </div>

                    {/* History Section */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        <p className="px-2 py-1 text-[10px] text-gray-500 uppercase tracking-wider font-bold">Recent Chats</p>
                        <HistoryList onResume={onResumeSession} onClose={() => setIsProfileOpen(false)} />
                    </div>

                    <div className="p-1 border-t border-white/5 bg-black/20 shrink-0">
                        <button
                            onClick={() => {
                                onRestartTutorial();
                                setIsProfileOpen(false);
                            }}
                            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/10 flex items-center gap-3 transition-colors"
                        >
                            <HelpCircle size={16} className="text-blue-400" />
                            Restart Tutorial
                        </button>
                        <button
                            onClick={() => {
                                onSignOut();
                                setIsProfileOpen(false);
                            }}
                            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                        >
                            <LogOut size={16} />
                            Sign Out
                        </button>
                    </div>
                </div>
            )}

            {/* --- SCANNING POPUP (Near Search Bar) --- */}
            {isLoadingCrowd && !isCustomSearching && (
                <div className="absolute top-36 left-4 right-4 md:top-24 md:left-8 md:right-auto md:w-auto z-50 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300 flex justify-center md:justify-start">
                    <div className="bg-black/80 backdrop-blur-xl border border-blue-500/30 rounded-2xl py-3 px-5 shadow-[0_0_20px_rgba(59,130,246,0.2)] flex items-center gap-4 max-w-sm">
                        <div className="relative flex-shrink-0">
                            <div className="absolute inset-0 bg-blue-500 blur-md rounded-full animate-pulse"></div>
                            <Loader2 className="relative z-10 text-blue-400 animate-spin" size={20} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-white text-sm font-bold tracking-wide">
                                {isCustomSearching ? "SEARCHING..." : "SCANNING SECTOR"}
                            </span>
                            <span className="text-blue-200/70 text-xs font-mono">
                                {isCustomSearching
                                    ? "Finding locals according to your preference..."
                                    : "Searching for locals to talk with... Please wait."}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* --- 1. TOP NAVIGATION --- */}
            <div className="absolute top-0 left-0 w-full z-30 p-4 pt-16 md:pt-6 flex flex-col gap-3 transition-all duration-300 pointer-events-none">
                <div className="flex items-start gap-3 w-full max-w-5xl mx-auto md:mx-0 pointer-events-auto">
                    <div id="search-bar" className="flex-1 max-w-[85%] md:max-w-[28rem] shadow-2xl relative mx-auto md:mx-0">
                        <form onSubmit={handleSubmit} className="relative group">
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl rounded-full border border-white/20 transition-all group-focus-within:bg-black/80 group-focus-within:border-blue-500/50 shadow-lg group-focus-within:shadow-blue-500/20"></div>
                            <div className="relative flex items-center px-4 py-3 gap-3">
                                <Search size={18} className="text-gray-400 group-focus-within:text-blue-400 shrink-0 transition-colors" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Search planet..."
                                    className="flex-1 bg-transparent border-none outline-none text-sm md:text-base text-white placeholder-gray-500 w-full font-medium"
                                    style={{ fontSize: '16px' }}
                                />
                                {searchState.isLoading ? (
                                    <Loader2 size={18} className="animate-spin text-blue-400 shrink-0" />
                                ) : (
                                    inputValue && (
                                        <button
                                            type="button"
                                            onClick={handleClearSearch}
                                            className="text-gray-500 hover:text-white p-1"
                                        >
                                            <X size={16} />
                                        </button>
                                    )
                                )}
                            </div>
                        </form>

                        {/* Error Toast */}
                        {searchState.error && (
                            <div className="absolute top-full left-0 mt-2 w-full bg-red-500/90 backdrop-blur-md border border-red-400/50 text-white text-xs px-4 py-3 rounded-xl animate-in fade-in slide-in-from-top-2 shadow-lg z-20">
                                <div className="flex items-center gap-2">
                                    <AlertIcon className="w-4 h-4 shrink-0" />
                                    <span>{searchState.error}</span>
                                </div>
                            </div>
                        )}

                        {!selectedMarker && markers.length === 0 && !searchState.error && (
                            <div className="absolute top-full left-0 mt-3 w-full overflow-x-auto scrollbar-hide pointer-events-auto">
                                <div className="flex gap-2 pb-2">
                                    {suggestionsList.map(s => (
                                        <button
                                            key={s}
                                            onClick={() => { setInputValue(s); onSearch(s); }}
                                            className="flex-shrink-0 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-xs font-medium text-gray-300 hover:bg-white/20 hover:text-white hover:border-white/40 transition-all whitespace-nowrap"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- 2. GPS & ZOOM FAB (Bottom Right Horizontal - Consolidated) --- */}
            {!showCrowdSelection && (
                <div className={`absolute right-24 z-20 pointer-events-auto flex flex-col gap-3 transition-all duration-300 bottom-8`}>

                    {/* Unified Navigation Bar */}
                    <div className="flex items-center gap-1 bg-black/60 backdrop-blur-xl border border-white/20 rounded-full overflow-hidden shadow-lg p-1">

                        {/* Zoom Group */}
                        <button
                            onClick={onZoomOut}
                            className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 transition-colors rounded-full active:bg-white/20"
                            title="Zoom Out"
                        >
                            <Minus size={20} />
                        </button>
                        <button
                            onClick={onZoomIn}
                            className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 transition-colors rounded-full active:bg-white/20"
                            title="Zoom In"
                        >
                            <Plus size={20} />
                        </button>

                        {/* Separator */}
                        <div className="w-[1px] h-6 bg-white/10 mx-1"></div>

                        {/* Locate */}
                        <button
                            id="locate-btn"
                            onClick={onUseCurrentLocation}
                            className="w-10 h-10 flex items-center justify-center text-white hover:bg-blue-600/20 hover:text-blue-400 transition-colors rounded-full active:bg-white/20"
                            title="Locate Me"
                        >
                            <Crosshair size={20} />
                        </button>

                        {/* Separator */}
                        <div className="w-[1px] h-6 bg-white/10 mx-1"></div>

                        {/* Reset */}
                        <button
                            onClick={onResetView}
                            className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 transition-colors rounded-full active:bg-white/20"
                            title="Reset View"
                        >
                            <Navigation size={20} className="rotate-45" />
                        </button>
                    </div>
                </div>
            )}

            {/* --- 3. RESULTS --- */}
            {showResultsList && (
                <div id="results-list" className="absolute bottom-0 left-0 w-full md:top-28 md:bottom-auto md:left-4 md:w-[26rem] z-20 pointer-events-auto animate-in slide-in-from-bottom-10 md:slide-in-from-left-10 duration-500">
                    <div className="md:hidden absolute -top-20 inset-x-0 h-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                    <div className="bg-[#0f0f0f] md:bg-black/60 backdrop-blur-xl border-t md:border border-white/10 rounded-t-2xl md:rounded-2xl overflow-hidden shadow-2xl max-h-[60vh] md:max-h-[70vh] flex flex-col">
                        <div className="md:hidden w-full flex justify-center pt-3 pb-1">
                            <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
                        </div>
                        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
                            <h3 className="text-xs font-mono uppercase tracking-widest text-blue-400 flex items-center gap-2">
                                <Navigation size={12} />
                                {markers.length > 1 ? 'Detected Sectors' : 'Target Acquired'}
                            </h3>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500">{markers.length} Found</span>
                                <button onClick={onClearResults} className="text-gray-500 hover:text-white transition-colors">
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="overflow-y-auto scrollbar-hide p-2 space-y-1 pb-8 md:pb-2">
                            {markers.map((marker, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => onSelectMarker(marker)}
                                    className="w-full text-left p-4 rounded-xl hover:bg-white/10 transition-all active:scale-[0.98] border border-transparent hover:border-white/5 group"
                                >
                                    <div className="flex items-start justify-between mb-1">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-white text-sm">{marker.name}</span>
                                            {(marker.region || marker.country) && (
                                                <span className="text-xs text-blue-300 mt-0.5">
                                                    {marker.region}{marker.region && marker.country ? ', ' : ''}{marker.country}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-mono text-gray-600 group-hover:text-gray-400 transition-colors">
                                            {marker.latitude.toFixed(2)},{marker.longitude.toFixed(2)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mt-1">{marker.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* --- 4. MARKER DETAILS --- */}
            {showMarkerSheet && !isLoadingCrowd && (
                <div className="absolute bottom-0 left-0 w-full md:bottom-8 md:right-8 md:left-auto md:w-[24rem] z-20 pointer-events-auto animate-in slide-in-from-bottom-full duration-500 ease-out">
                    <div className="bg-[#0a0a0a] md:bg-black/80 backdrop-blur-2xl rounded-t-3xl md:rounded-3xl border-t md:border border-white/10 shadow-2xl overflow-hidden">
                        <div className="relative h-32 md:h-40 bg-gradient-to-br from-slate-900 via-blue-950 to-black p-6 flex flex-col justify-end">
                            <button
                                onClick={onCloseMarker}
                                className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-white/10 rounded-full text-white/70 transition-colors backdrop-blur-md"
                            >
                                <X size={20} />
                            </button>
                            <div className="flex items-center gap-2 text-blue-300 text-[10px] font-mono uppercase tracking-wider mb-1">
                                <MapPin size={12} />
                                <span>
                                    {selectedMarker.region ? `${selectedMarker.region}, ` : ''}
                                    {selectedMarker.country || 'Sector Locked'}
                                </span>
                            </div>
                            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight shadow-black drop-shadow-md pr-8">
                                {selectedMarker.name}
                            </h2>
                        </div>
                        <div className="p-6 pt-4 space-y-6 pb-10 md:pb-6">
                            <p className="text-sm text-gray-300 leading-relaxed">
                                {selectedMarker.description}
                            </p>
                            <div className="flex gap-3">
                                <a
                                    href={selectedMarker.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedMarker.name} ${selectedMarker.region || ''} ${selectedMarker.country || ''}`)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold text-sm transition-colors border border-white/10 flex items-center justify-center gap-2"
                                >
                                    <MapPin size={16} className="text-gray-400" />
                                    Maps
                                </a>
                                <button
                                    onClick={() => onSelectMarker(selectedMarker)}
                                    disabled={isLoadingCrowd}
                                    className="flex-[2] py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
                                >
                                    {isLoadingCrowd ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            <span>Scanning...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Users size={18} />
                                            <span>Scan For Locals</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- UNIFIED SIDE PANEL (CROWD & CHAT) --- */}
            {(showCrowdSelection || showChat) && (
                <>
                    {/* Minimized Floating Button */}
                    {isMinimized && (
                        <div className="absolute bottom-24 left-4 md:bottom-8 md:left-8 z-50 flex flex-col items-center gap-2 pointer-events-auto animate-in zoom-in duration-300">
                            {/* Close Button for Bubble */}
                            <button
                                onClick={() => {
                                    if (showChat) onClosePersona();
                                    onCloseMarker();
                                }}
                                className="w-6 h-6 rounded-full bg-red-500/80 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors mb-1"
                            >
                                <X size={14} />
                            </button>

                            <button
                                onClick={() => setIsMinimized(false)}
                                className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl flex items-center justify-center border-2 border-white/20 hover:scale-110 transition-transform"
                            >
                                <div className="relative">
                                    {showChat ? (
                                        <img src={persona!.imageUrl} alt={persona!.name} className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <Users size={24} />
                                    )}
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black"></div>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Main Side Window */}
                    {!isMinimized && (
                        <div
                            className={`absolute z-50 flex flex-col shadow-2xl overflow-hidden pointer-events-auto
                                ${isMobile
                                    ? 'inset-0 bg-black/95'
                                    : 'w-[24rem] h-[32rem] max-h-[80vh] rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10'
                                }
                            `}
                            style={!isMobile ? {
                                left: chatPosition.x,
                                top: chatPosition.y,
                                cursor: isDragging ? 'grabbing' : 'auto'
                            } : {}}
                        >
                            {/* Header */}
                            <div
                                onMouseDown={!isMobile ? handleDragStart : undefined}
                                className={`p-4 border-b border-white/10 flex items-center justify-between bg-white/5 shrink-0 z-10 ${!isMobile ? 'cursor-grab active:cursor-grabbing' : ''}`}
                            >
                                <div className="flex items-center gap-3 pointer-events-none select-none">
                                    {showChat && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onClosePersona(); }}
                                            className="p-1.5 -ml-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors pointer-events-auto"
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                    )}

                                    {showChat ? (
                                        <>
                                            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-blue-500/50 relative bg-gray-800">
                                                <img src={persona!.imageUrl} alt={persona!.name} className="w-full h-full object-cover" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                                                    {persona!.name}
                                                    <span className="flex h-1.5 w-1.5 rounded-full bg-green-500"></span>
                                                </h3>
                                                <p className="text-[10px] text-blue-300 uppercase tracking-wider">{persona!.occupation}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30">
                                                <Radio className="animate-pulse" size={20} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-sm">Lifeforms Detected</h3>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Select to Intercept</p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center gap-1 pointer-events-auto">
                                    {/* Resume Chat Button (Only in Crowd List and if lastPersona exists) */}
                                    {!showChat && lastPersona && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onResumeChat(); }}
                                            className="p-2 hover:bg-white/10 rounded-full text-blue-400 hover:text-blue-300 transition-colors mr-1"
                                            title={`Resume chat with ${lastPersona.name}`}
                                        >
                                            <MessageSquare size={18} />
                                        </button>
                                    )}

                                    <button
                                        onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
                                        className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                                    >
                                        <Minus size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (showChat) onClosePersona();
                                            onCloseMarker();
                                        }}
                                        className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 overflow-y-auto bg-black/20 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent relative">
                                {showChat ? (
                                    /* CHAT CONTENT */
                                    <div className="p-4 space-y-4 min-h-full">
                                        {chatHistory.map((msg, idx) => {
                                            const isUser = msg.role === 'user';
                                            return (
                                                <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${isUser
                                                        ? 'bg-blue-600 text-white rounded-tr-none'
                                                        : 'bg-[#1a1a1a] border border-white/10 text-gray-200 rounded-tl-none'
                                                        }`}>
                                                        {msg.text}
                                                        {!isUser && msg.sources && msg.sources.length > 0 && (
                                                            <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                                                                {msg.sources.map((source, i) => (
                                                                    <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-blue-400 truncate hover:underline flex items-center gap-1">
                                                                        <Sparkles size={8} /> {source.title || source.uri}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {isChatLoading && (
                                            <div className="flex justify-start">
                                                <div className="bg-[#1a1a1a] border border-white/10 px-4 py-2 rounded-2xl rounded-tl-none">
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce delay-75"></div>
                                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce delay-150"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>
                                ) : (
                                    /* CROWD LIST CONTENT */
                                    <div className="p-2 space-y-2">
                                        {/* Custom Search Input */}
                                        <div className="mb-4 px-2">
                                            <form
                                                onSubmit={(e) => {
                                                    e.preventDefault();
                                                    const form = e.target as HTMLFormElement;
                                                    const input = form.elements.namedItem('query') as HTMLInputElement;
                                                    if (input.value.trim()) {
                                                        setIsCustomSearching(true);
                                                        onCustomCrowdSearch(input.value.trim());
                                                        input.value = '';
                                                    }
                                                }}
                                                className="relative group"
                                            >
                                                <input
                                                    type="text"
                                                    name="query"
                                                    placeholder="Find specific locals (e.g. 'Doctor', 'Alice', '25yo')..."
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
                                                />
                                                <button
                                                    type="submit"
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition-colors"
                                                >
                                                    <Search size={14} />
                                                </button>
                                            </form>
                                        </div>

                                        {/* Custom Search Loading State */}
                                        {isLoadingCrowd && isCustomSearching ? (
                                            <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-in fade-in duration-300">
                                                <div className="relative">
                                                    <div className="absolute inset-0 bg-blue-500 blur-xl rounded-full animate-pulse opacity-50"></div>
                                                    <Loader2 className="relative z-10 text-blue-400 animate-spin" size={32} />
                                                </div>
                                                <div className="text-center">
                                                    <h3 className="text-white font-bold text-sm mb-1">SEARCHING...</h3>
                                                    <p className="text-blue-200/60 text-xs font-mono max-w-[200px] mx-auto">
                                                        Finding locals according to your preference...
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Results List */
                                            crowd.map((member, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => !isSummoning && onSelectMember(member)}
                                                    className="group relative bg-white/5 border border-white/5 hover:border-blue-500/50 hover:bg-white/10 rounded-xl p-4 cursor-pointer transition-all active:scale-[0.98]"
                                                >
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div>
                                                            <h3 className="font-bold text-white text-sm">{member.name}</h3>
                                                            <p className="text-blue-300 text-[10px] font-mono uppercase tracking-wider">
                                                                {member.age} • {member.occupation}
                                                            </p>
                                                        </div>
                                                        {isSummoning ? <Loader2 className="animate-spin text-blue-400" size={14} /> : <Radio size={14} className="text-gray-500 group-hover:text-blue-400" />}
                                                    </div>
                                                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed group-hover:text-gray-300 transition-colors">
                                                        {member.bio}
                                                    </p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer (Chat Only) */}
                            {showChat && (
                                <div className="p-3 border-t border-white/10 bg-black/40 shrink-0">
                                    {suggestions && suggestions.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1">
                                            {suggestions.map((s, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleSuggestionClick(s)}
                                                    disabled={isChatLoading}
                                                    className="whitespace-nowrap px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-blue-300 transition-colors disabled:opacity-50 shrink-0"
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <form onSubmit={handleChatSubmit} className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            placeholder={isChatLoading ? "Waiting for response..." : "Type a message..."}
                                            className="flex-1 bg-[#111] border border-white/10 rounded-full px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={isChatLoading}
                                        />
                                        <button
                                            type="submit"
                                            disabled={!chatInput.trim() || isChatLoading}
                                            className="w-10 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center disabled:opacity-50 transition-all shrink-0"
                                        >
                                            <Send size={16} />
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default UIOverlay;
