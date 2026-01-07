import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, X, Loader2, Radio, Info, Users, Send, Navigation, Globe, ChevronLeft, Sparkles, Activity, AlertCircle as AlertIcon, LogOut, HelpCircle, User as UserIcon, Clock, Minus, Settings as SettingsPanelIcon } from 'lucide-react';
import { LocationMarker, SearchState, LocalPersona, ChatMessage, CrowdMember, Notification } from '../types';

import WeatherTimeDisplay from './WeatherTimeDisplay';
import Sidebar from './Sidebar';
import NotificationPanel from './NotificationPanel';
import SettingsPanel from './SettingsPanel';
import NotificationPermissionCard from './NotificationPermissionCard';
const ProfileModal = React.lazy(() => import('./ProfileModal'));
import AILocalsList from './AILocalsList';
import RealUsersList from './RealUsersList';
import { supabase } from '../services/supabaseClient';
import NewsFeed from './NewsFeed';
import { useNews } from '../context/NewsContext';



interface UIOverlayProps {
    onSearch: (query: string) => void;
    onClearResults: () => void;
    searchState: SearchState;

    markers: LocationMarker[];
    selectedMarker: LocationMarker | null;
    onSelectMarker: (marker: LocationMarker) => void;
    onCloseMarker: () => void;



    // Crowd & Chat
    crowd: LocalPersona[];
    isLoadingCrowd: boolean;
    onCustomCrowdSearch: (query: string) => void;
    onSelectMember: (member: CrowdMember) => void;

    persona: LocalPersona | null;
    isSummoning: boolean;
    onClosePersona: () => void;



    chatHistory: ChatMessage[];
    onSendMessage: (text: string) => void;
    isChatLoading: boolean;
    suggestions?: string[];
    timezone?: string;


    onChatToggle?: (isOpen: boolean) => void;

    // Auth & Tutorial
    userEmail?: string;
    userImage?: string;
    userId?: string;
    onSignOut: () => void;
    onRestartTutorial: () => void;
    onResumeSession: (sessionId: string, persona: LocalPersona, location: LocationMarker) => void;

    // Notifications
    notifications?: Notification[];
    unreadNotifications?: number;
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
    onDeleteNotification: (id: string) => void;
    showPermissionCard?: boolean;
    onPermissionGranted: (token: string) => void;
    onPermissionDismiss: () => void;
    onPostClick?: () => void;
    lockdownMode?: boolean;

}



const UIOverlay: React.FC<UIOverlayProps> = ({
    onSearch,
    onClearResults,
    searchState,
    markers,
    selectedMarker,
    onSelectMarker,
    onCloseMarker,


    crowd,
    isLoadingCrowd,
    onCustomCrowdSearch,
    onSelectMember,

    persona,
    isSummoning,
    onClosePersona,



    chatHistory,
    onSendMessage,
    isChatLoading,
    suggestions = [],

    timezone,



    userEmail,
    userImage,
    userId,
    onSignOut,
    onRestartTutorial,
    onResumeSession,

    notifications = [],
    unreadNotifications = 0,
    onMarkAsRead,
    onMarkAllAsRead,
    onDeleteNotification,
    showPermissionCard,
    onPermissionGranted,
    onPermissionDismiss,
    lockdownMode = false,
    onChatToggle,
    onPostClick,
}) => {
    const { isNewsFeedOpen, toggleNewsFeed, newsEvents } = useNews();
    const [inputValue, setInputValue] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [isMobile, setIsMobile] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
    const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
    const [isAddFriendsOpen, setIsAddFriendsOpen] = useState(false); // Used for AI Chats
    const [isRealFriendsOpen, setIsRealFriendsOpen] = useState(false); // New: Real Users Search
    const [viewingProfileId, setViewingProfileId] = useState<string | null>(null); // New: ID for viewing others
    const [aiLocals, setAiLocals] = useState<any[]>([]); // AI Locals State

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

        // Listen for Profile View Events (Global Feed)
        const handleViewProfile = (e: CustomEvent<{ userId: string }>) => {
            if (e.detail?.userId) {
                setViewingProfileId(e.detail.userId);
                setIsProfileOpen(true);
            }
        };
        window.addEventListener('geo-terra:view-profile', handleViewProfile as EventListener);

        return () => {
            window.removeEventListener('resize', checkMobile);
            window.removeEventListener('geo-terra:view-profile', handleViewProfile as EventListener);
        }
    }, []);

    // Lockdown Mode Effect
    useEffect(() => {
        if (lockdownMode && userId) {
            setIsProfileOpen(true);
        }
    }, [lockdownMode, userId]);

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

    const showCrowdSelection = crowd.length > 0 && !persona;
    const showChat = !!persona;

    useEffect(() => {
        if (onChatToggle) {
            onChatToggle(showChat || showCrowdSelection);
        }
    }, [showChat, showCrowdSelection, onChatToggle]);

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
    // Only show results list if there is an active search query.
    // This prevents the "My World" user data from opening the side panel automatically.
    const showResultsList = !persona && markers.length > 0 && !selectedMarker && searchState.query;

    // Hide default sheet for News/AI items (handled by NewsFeed)
    const isGlobalFeedItem = selectedMarker && (selectedMarker.type === 'Event' || (selectedMarker.type === 'Post' && !selectedMarker.isUserPost));
    const showMarkerSheet = selectedMarker && !persona && crowd.length === 0 && !isGlobalFeedItem;

    return (
        <div className="absolute inset-0 pointer-events-none font-sans text-white flex flex-col">



            {/* --- SIDEBAR --- */}
            {/* Hide Sidebar if any panel is open to prevent overlap */}
            {!(isProfileOpen || isNotificationPanelOpen || isSettingsPanelOpen || isAddFriendsOpen || isRealFriendsOpen || isNewsFeedOpen) && (
                <>
                    <Sidebar
                        onProfileClick={() => {
                            setViewingProfileId(null);
                            setIsProfileOpen(true);
                        }}
                        onChatsClick={() => { // Old "Add Friends" is now Chats
                            setIsAddFriendsOpen(true);
                            setIsNotificationPanelOpen(false);
                            setIsSettingsPanelOpen(false);
                            setIsRealFriendsOpen(false);
                            setViewingProfileId(null);
                            // Fetch AI Locals
                            if (userId) {
                                import('../services/chatService').then(({ chatService }) => {
                                    chatService.getRecentSessions('').then(sessions => {
                                        // Filter unique personas from sessions
                                        const uniqueLocalsMap = new Map();
                                        sessions.forEach(s => {
                                            if (!uniqueLocalsMap.has(s.persona_name)) {
                                                uniqueLocalsMap.set(s.persona_name, {
                                                    persona_name: s.persona_name,
                                                    persona_occupation: s.persona_data.occupation,
                                                    persona_image_url: s.persona_image_url,
                                                    location_name: s.location_name,
                                                    // Extra data for resuming chat
                                                    id: s.id,
                                                    persona_data: s.persona_data,
                                                    location_lat: s.location_lat,
                                                    location_lng: s.location_lng
                                                });
                                            }
                                        });
                                        setAiLocals(Array.from(uniqueLocalsMap.values()));
                                    });
                                });
                            }
                        }}
                        onRealFriendsClick={() => { // New Real Friends
                            setIsRealFriendsOpen(true);
                            setIsAddFriendsOpen(false);
                            setIsNotificationPanelOpen(false);
                            setIsSettingsPanelOpen(false);
                            setIsProfileOpen(false);
                        }}
                        onNotificationsClick={() => {
                            setIsNotificationPanelOpen(!isNotificationPanelOpen);
                            setIsSettingsPanelOpen(false);
                            setIsAddFriendsOpen(false);
                            setIsRealFriendsOpen(false);
                        }}
                        unreadNotifications={notifications.filter(n => !n.read).length}
                        profileId="step-3-profile"
                        chatsId="step-4-add-friends" // Keeping ID for tutorial
                        addFriendsId="real-friends-btn"
                        notificationsId="notification-btn"
                        userImage={userImage}

                        // Injecting News Toggle into Sidebar
                        onNewsClick={toggleNewsFeed}
                        onPostClick={onPostClick}
                    />

                </>
            )}

            {/* PROFILE MODAL */}
            <React.Suspense fallback={null}>
                {isProfileOpen && (
                    <ProfileModal
                        isOpen={isProfileOpen}
                        onClose={() => {
                            if (!lockdownMode) {
                                setIsProfileOpen(false);
                                setViewingProfileId(null);
                            }
                        }}
                        targetUserId={viewingProfileId || undefined}
                        userEmail={userEmail}
                        lockdownMode={lockdownMode}
                    />
                )}
            </React.Suspense>

            {/* REAL FRIENDS SEARCH PANEL - Renders search results for real users */}
            {
                isRealFriendsOpen && (
                    <div className="absolute top-0 right-0 w-full h-full md:w-[24rem] z-50 pointer-events-auto animate-in slide-in-from-right duration-300 bg-[#0a0a0a] border-l border-white/10 shadow-2xl">
                        <RealUsersList
                            onClose={() => setIsRealFriendsOpen(false)}
                            onUserSelect={(userId) => {
                                setViewingProfileId(userId);
                                setIsProfileOpen(true);
                                setIsRealFriendsOpen(false);
                            }}
                        />
                    </div>
                )
            }

            {/* NOTIFICATION PANEL */}
            {
                userId && (
                    <NotificationPanel
                        isOpen={isNotificationPanelOpen}
                        onClose={() => setIsNotificationPanelOpen(false)}
                        notifications={notifications}
                        userId={userId}
                        onMarkAsRead={onMarkAsRead}
                        onMarkAllAsRead={onMarkAllAsRead}
                        onDelete={onDeleteNotification}
                        onResumeSession={onResumeSession}
                        onChatToggle={onChatToggle || (() => { })}
                    />
                )
            }

            {/* NOTIFICATION PERMISSION CARD */}
            {
                showPermissionCard && (
                    <NotificationPermissionCard
                        onPermissionGranted={onPermissionGranted}
                        onDismiss={onPermissionDismiss}
                    />
                )
            }

            {/* SETTINGS PANEL */}
            <SettingsPanel
                isOpen={isSettingsPanelOpen}
                onClose={() => setIsSettingsPanelOpen(false)}
                onSignOut={onSignOut}
                onRestartTutorial={onRestartTutorial}
                userEmail={userEmail}
            />

            {/* ADD FRIENDS PANEL (AI LOCALS) */}
            {
                isAddFriendsOpen && (
                    <div className="absolute top-0 right-0 w-full h-full md:w-[24rem] z-50 pointer-events-auto animate-in slide-in-from-right duration-300 bg-[#0a0a0a] border-l border-white/10 shadow-2xl">
                        <AILocalsList
                            locals={aiLocals}
                            onClose={() => setIsAddFriendsOpen(false)}
                            onChat={(local) => {
                                setIsAddFriendsOpen(false);
                                // Resume session using the stored data
                                if (local.id && local.persona_data) {
                                    onResumeSession(local.id, local.persona_data, {
                                        id: `loc_${local.location_lat}_${local.location_lng}`,
                                        name: local.location_name,
                                        latitude: local.location_lat,
                                        longitude: local.location_lng,
                                        description: "Resumed Location",
                                        type: "Place"
                                    });
                                }
                            }}
                            onDelete={(local) => {
                                if (userId) {
                                    import('../services/chatService').then(({ chatService }) => {
                                        chatService.deleteConversation(userId, local.persona_name).then(() => {
                                            setAiLocals(prev => prev.filter(p => p.persona_name !== local.persona_name));
                                        });
                                    });
                                }
                            }}
                        />
                    </div>
                )
            }


            {/* --- SCANNING POPUP (Near Search Bar) --- */}
            {
                isLoadingCrowd && !isCustomSearching && !lockdownMode && !isNewsFeedOpen && (
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
                )
            }

            {/* --- 1. TOP NAVIGATION --- */}
            {
                !lockdownMode && !isNewsFeedOpen && (
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

                            {/* Settings Button (Moved Here) */}
                            <button
                                id="settings-btn"
                                onClick={() => {
                                    setIsSettingsPanelOpen(!isSettingsPanelOpen);
                                    setIsNotificationPanelOpen(false);
                                    setIsAddFriendsOpen(false);
                                    setIsRealFriendsOpen(false);
                                }}
                                className="w-12 h-12 md:w-12 md:h-12 bg-black/60 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all active:scale-95 shadow-2xl relative group flex"
                                title="Settings"
                            >
                                <SettingsPanelIcon size={20} />
                            </button>
                        </div>
                    </div>
                )
            }




            {/* --- 3. RESULTS --- */}
            {
                showResultsList && (
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
                )
            }

            {/* --- 4. MARKER DETAILS --- */}
            {/* --- 4. MARKER DETAILS / POST CARD --- */}
            {
                showMarkerSheet && !isLoadingCrowd && (
                    <div className={`z-20 pointer-events-auto animate-in duration-300 ease-out ${selectedMarker.type === 'Event'
                        ? 'fixed inset-0 z-[100] fade-in'
                        : 'absolute bottom-0 left-0 w-full md:bottom-8 md:right-8 md:left-auto md:w-[24rem] slide-in-from-bottom-full'
                        }`}>
                        <div className={`overflow-hidden h-full ${selectedMarker.type === 'Event'
                            ? 'bg-[#0a0a0a]'
                            : 'bg-[#0a0a0a] md:bg-black/80 backdrop-blur-2xl rounded-t-3xl md:rounded-3xl border-t md:border border-white/10 shadow-2xl h-auto'
                            }`}>

                            {/* NEWS EVENT CARD VIEW */}
                            {selectedMarker.type === 'Event' ? (
                                (() => {
                                    // Find index in newsEvents for navigation
                                    const currentIndex = newsEvents.findIndex(e => e.id === selectedMarker.id);
                                    const hasNext = currentIndex !== -1 && currentIndex < newsEvents.length - 1;
                                    const hasPrev = currentIndex !== -1 && currentIndex > 0;

                                    const handleNavigate = (direction: 'next' | 'prev') => {
                                        if (currentIndex === -1) return;
                                        const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
                                        if (newsEvents[newIndex]) {
                                            onSelectMarker(newsEvents[newIndex]);
                                        }
                                    };

                                    return (
                                        <div className="w-full h-full flex flex-col relative">
                                            {/* 1. IMAGE CAROUSEL (Revised: Fixed Height) */}
                                            <div className="relative w-full h-64 md:h-80 shrink-0 bg-black group-image">
                                                {selectedMarker.postImageUrl ? (
                                                    <img src={selectedMarker.postImageUrl} alt={selectedMarker.name} className="w-full h-full object-cover transition-transform hover:scale-105 duration-700" />
                                                ) : (
                                                    <div className={`w-full h-full bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] ${selectedMarker.category === 'Conflict' ? 'from-orange-900 via-red-900 to-black' :
                                                        selectedMarker.category === 'Environmental' ? 'from-emerald-900 via-green-900 to-black' :
                                                            'from-blue-900 via-slate-900 to-black'
                                                        } opacity-80`}></div>
                                                )}

                                                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-black/20 to-transparent"></div>

                                                {/* Category Badge */}
                                                <div className="absolute top-4 left-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border backdrop-blur-md shadow-lg ${selectedMarker.category === 'Conflict' ? 'bg-orange-500/20 text-orange-200 border-orange-500/30' :
                                                        selectedMarker.category === 'Environmental' ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30' :
                                                            'bg-blue-500/20 text-blue-200 border-blue-500/30'
                                                        }`}>
                                                        {selectedMarker.category}
                                                    </span>
                                                </div>

                                                <button
                                                    onClick={onCloseMarker}
                                                    className="absolute top-4 right-4 p-3 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors backdrop-blur-md z-20"
                                                >
                                                    <X size={24} />
                                                </button>

                                                {/* Swipe Indicators (Mock) */}
                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                                                    <div className="w-2 h-2 rounded-full bg-white shadow-sm"></div>
                                                    <div className="w-2 h-2 rounded-full bg-white/30 shadow-sm"></div>
                                                    <div className="w-2 h-2 rounded-full bg-white/30 shadow-sm"></div>
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 p-6 pt-2 flex flex-col relative overflow-hidden">
                                                {/* Headlines & Source */}
                                                <div className="shrink-0 mb-4">
                                                    <h2 className="text-xl md:text-2xl font-bold text-white leading-snug mb-2 line-clamp-3">
                                                        {selectedMarker.name}
                                                    </h2>

                                                    <div className="flex items-center flex-wrap gap-2 text-[10px] md:text-xs text-gray-400 font-mono uppercase tracking-wide border-b border-white/5 pb-3">
                                                        {selectedMarker.sourceUrl && (
                                                            <span className="text-blue-300 font-bold bg-blue-900/30 px-2 py-0.5 rounded border border-blue-500/20">
                                                                {new URL(selectedMarker.sourceUrl).hostname.replace('www.', '')}
                                                            </span>
                                                        )}
                                                        <span className="text-gray-600">•</span>
                                                        <span>
                                                            {(() => {
                                                                if (!selectedMarker.publishedAt) return 'LIVE';
                                                                try {
                                                                    const date = new Date(selectedMarker.publishedAt);
                                                                    const now = new Date();
                                                                    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

                                                                    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
                                                                    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
                                                                    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
                                                                    return `${Math.floor(diffInSeconds / 86400)}d ago`;
                                                                } catch (e) {
                                                                    return 'LIVE';
                                                                }
                                                            })()}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Description & Location */}
                                                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 pr-2 mb-4">
                                                    <p className="text-base md:text-lg text-gray-300 leading-relaxed font-light whitespace-pre-line">
                                                        {selectedMarker.description}
                                                    </p>

                                                    <div className="mt-6 flex items-center gap-2 text-sm text-gray-500 bg-white/5 p-3 rounded-lg w-fit">
                                                        <MapPin size={16} className="text-blue-500" />
                                                        <span>
                                                            {selectedMarker.region ? `${selectedMarker.region}, ` : ''}
                                                            {selectedMarker.country || 'International Context'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Footer Buttons */}
                                                <div className="shrink-0 pt-2 border-t border-white/10 space-y-3">
                                                    <a
                                                        href={selectedMarker.sourceUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block w-full text-center py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                                                    >
                                                        Read Full Article <Globe size={14} className="opacity-70" />
                                                    </a>

                                                    <div className="text-[10px] text-gray-500 text-center font-mono mt-2 opacity-60">
                                                        Data provided by the GDELT Project (<a href="https://www.gdeltproject.org/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">https://www.gdeltproject.org/</a>)
                                                    </div>
                                                </div>

                                                {/* Navigation / Swipe Controls */}
                                                {currentIndex !== -1 && (
                                                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between shrink-0">
                                                        <button
                                                            onClick={() => handleNavigate('prev')}
                                                            disabled={!hasPrev}
                                                            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-white flex items-center gap-2 text-xs font-medium"
                                                        >
                                                            <ChevronLeft size={16} /> Prev
                                                        </button>
                                                        <span className="text-[10px] text-gray-500 font-mono">
                                                            {currentIndex + 1} / {newsEvents.length}
                                                        </span>
                                                        <button
                                                            onClick={() => handleNavigate('next')}
                                                            disabled={!hasNext}
                                                            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-white flex items-center gap-2 text-xs font-medium"
                                                        >
                                                            Next <ChevronLeft size={16} className="rotate-180" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : selectedMarker.isUserPost ? (
                                <>
                                    <div className="relative h-48 bg-black">
                                        {selectedMarker.postImageUrl ? (
                                            <img
                                                src={selectedMarker.postImageUrl}
                                                alt={selectedMarker.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-500">
                                                No Image
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30"></div>

                                        <button
                                            onClick={onCloseMarker}
                                            className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors backdrop-blur-md"
                                        >
                                            <X size={20} />
                                        </button>

                                        <div className="absolute bottom-4 left-4 right-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="bg-cyan-500/20 text-cyan-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-cyan-500/30 backdrop-blur-md uppercase tracking-wide">
                                                    My Post
                                                </div>
                                                <div className="flex items-center gap-1 text-gray-300 text-[10px]">
                                                    <MapPin size={10} />
                                                    {selectedMarker.name}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 pt-4 space-y-4">
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-200 leading-relaxed font-medium">
                                                    {selectedMarker.postCaption || selectedMarker.description}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-white/5 flex gap-2">
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${selectedMarker.latitude},${selectedMarker.longitude}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium text-xs transition-colors flex items-center justify-center gap-2"
                                            >
                                                <MapPin size={14} className="text-gray-400" />
                                                View Location
                                            </a>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* STANDARD LOCATION VIEW */
                                <>
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
                                </>
                            )}
                        </div>
                    </div>
                )
            }

            {/* --- UNIFIED SIDE PANEL (CROWD & CHAT) --- */}
            {
                (showCrowdSelection || showChat) && (
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
                )
            }
            {/* NEWS FEED OVERLAY */}
            <NewsFeed
                onEventClick={(event) => {
                    onSelectMarker(event);
                    toggleNewsFeed(); // Close feed to show event on globe
                }}
            />
        </div>
    );
};

export default UIOverlay;
