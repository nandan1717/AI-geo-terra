import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, UserPlus, Check } from 'lucide-react';
import { socialService } from '../services/socialService';

interface RealUser {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
    occupation?: string;
    location?: string;
    bio?: string;
}

interface RealUsersListProps {
    onClose: () => void;
    onUserSelect: (userId: string) => void;
    onChatSelect?: (persona: any) => void;
    onGenSearch?: (query: string) => void;
    isGenSearching?: boolean;
}

const RealUsersList: React.FC<RealUsersListProps> = ({ onClose, onUserSelect, onChatSelect, onGenSearch, isGenSearching }) => {
    const [activeTab, setActiveTab] = useState<'real' | 'ai'>('real');

    // Real User State
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState<RealUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [addedUsers, setAddedUsers] = useState<string[]>([]);

    // AI State
    const [aiPersonas, setAiPersonas] = useState<any[]>([]); // Using any for LocalPersona to avoid import cycles if not available
    const [loadingAI, setLoadingAI] = useState(false);
    const [genQuery, setGenQuery] = useState('');

    // Fetch AI Personas on Mount (or when tab switches)
    useEffect(() => {
        if (activeTab === 'ai' && aiPersonas.length === 0) {
            setLoadingAI(true);
            import('../services/geminiService').then(({ getAllCachedPersonas }) => {
                getAllCachedPersonas(30).then(data => {
                    setAiPersonas(data);
                    setLoadingAI(false);
                });
            });
        }
    }, [activeTab]);

    // Real User Search & Recent Users
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (activeTab === 'real') {
                setLoading(true);
                try {
                    if (query.length >= 2) {
                        // Perform Search
                        const results = await socialService.searchUsers(query);
                        setUsers(results);
                    } else if (query.length === 0) {
                        // Fetch Recent Users when query is empty
                        const recent = await socialService.getRecentUsers(20);
                        setUsers(recent);
                    } else {
                        // Query is 1 char, do nothing or retain recent? 
                        // Let's just keep recent/empty if 1 char for now or maybe clear?
                        // If we cleared it here: setUsers([]); 
                        // But users might prefer seeing the list until they type enough.
                        // For consistency with search behavior (min 2 chars), let's show recent if empty, 
                        // and maybe clear if 1 char? Or just show recent. 
                        // Let's stick to: "If empty -> Recent. If >= 2 -> Search."
                        // What about 1 char? maybe just show recent?
                        // The previous code cleared it. Let's explicitly fetch recent only on empty or mount.
                    }
                } catch (error) {
                    console.error("User fetch failed", error);
                } finally {
                    setLoading(false);
                }
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [query, activeTab]);

    const handleAdd = (userId: string) => {
        setAddedUsers([...addedUsers, userId]);
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a]">
            {/* Header */}
            <div className="flex items-center gap-2 p-4 border-b border-white/10 shrink-0">
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
                    <ChevronLeft size={24} />
                </button>
                <h2 className="text-lg font-bold text-white">Find Connections</h2>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10">
                <button
                    onClick={() => setActiveTab('real')}
                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'real' ? 'text-blue-400' : 'text-gray-500 hover:text-white'
                        }`}
                >
                    Real Mortals
                    {activeTab === 'real' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400" />}
                </button>
                <button
                    onClick={() => setActiveTab('ai')}
                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'ai' ? 'text-blue-400' : 'text-gray-500 hover:text-white'
                        }`}
                >
                    AI Mortals
                    {activeTab === 'ai' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400" />}
                </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-white/5">
                {activeTab === 'real' ? (
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by name or username..."
                            className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all font-mono text-sm"
                            autoFocus
                        />
                    </div>
                ) : (
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            value={genQuery}
                            onChange={(e) => setGenQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && genQuery.trim() && onGenSearch) {
                                    onGenSearch(genQuery);
                                    setGenQuery('');
                                }
                            }}
                            placeholder="Search an AI Mortal"
                            className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-12 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all font-mono text-sm"
                        />
                        <button
                            onClick={() => {
                                if (genQuery.trim() && onGenSearch) {
                                    onGenSearch(genQuery);
                                    setGenQuery('');
                                }
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-400 hover:text-white"
                        >
                            {isGenSearching ? <span className="animate-spin text-xs">⌛</span> : <span className="text-xs font-bold">GO</span>}
                        </button>
                    </div>
                )}
            </div>

            {/* --- LIST CONTENT --- */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">

                {/* REAL USERS LIST - GRID LAYOUT */}
                {activeTab === 'real' && (
                    <div className="grid grid-cols-2 gap-3 relative min-h-[200px]">
                        {loading && (
                            <div className="col-span-2 text-center text-gray-500 py-4 font-mono text-xs animate-pulse">Scanning frequency...</div>
                        )}

                        {!loading && users.length === 0 && query.length >= 2 && (
                            <div className="col-span-2 text-center text-gray-500 py-8 font-mono text-xs">No signals found.</div>
                        )}

                        <div className={`col-span-2 grid grid-cols-2 gap-3 transition-opacity duration-300 ${loading ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    onClick={() => onUserSelect(user.id)}
                                    className="flex flex-col items-center p-3 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 hover:bg-white/10 hover:border-blue-500/30 transition-all hover:scale-[1.02] shadow-sm cursor-pointer group relative overflow-hidden"
                                >
                                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                                    <div className="w-14 h-14 rounded-full overflow-hidden border border-white/20 mb-2 relative z-10 shadow-lg">
                                        <img
                                            src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                                            alt={user.username}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="text-center w-full relative z-10">
                                        <h3 className="font-bold text-white text-xs truncate group-hover:text-blue-400 transition-colors w-full">{user.full_name || user.username}</h3>
                                        <p className="text-[10px] text-blue-300/80 font-medium truncate mb-1">{user.occupation || user.location || 'Explorer'}</p>
                                        <p className="text-[9px] text-gray-400 line-clamp-2 h-6 leading-3 italic opacity-60">
                                            "{user.bio || 'New to the world.'}"
                                        </p>
                                    </div>

                                    {/* Quick Add Button - Absolute Positioned */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleAdd(user.id); }}
                                        disabled={addedUsers.includes(user.id)}
                                        className={`absolute top-2 right-2 p-1.5 rounded-full transition-all z-20 ${addedUsers.includes(user.id)
                                            ? 'bg-green-500/20 text-green-400 cursor-default'
                                            : 'bg-white/5 text-gray-400 hover:bg-blue-600 hover:text-white'
                                            }`}
                                        title={addedUsers.includes(user.id) ? "Connected" : "Connect"}
                                    >
                                        {addedUsers.includes(user.id) ? <Check size={12} /> : <UserPlus size={12} />}
                                    </button>
                                </div>
                            ))}
                        </div>

                        {!loading && users.length === 0 && query.length < 2 && (
                            // This case should rarely happen now that we fetch recent users, 
                            // unless there are NO users in the system.
                            <div className="col-span-2 text-center text-gray-500/50 py-12 flex flex-col items-center gap-2">
                                <UserPlus size={32} strokeWidth={1} />
                                <p className="font-mono text-sm">No mortals found yet.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* AI PERSONAS LIST */}
                {activeTab === 'ai' && (
                    <div className="grid grid-cols-2 gap-3 relative min-h-[200px]">

                        {/* Dynamic Loading Overlay */}
                        {isGenSearching && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0a0a0a]/90 backdrop-blur-sm border border-blue-500/30 rounded-xl p-4 text-center animate-in fade-in">
                                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                                <h3 className="text-blue-400 font-bold text-sm tracking-wider animate-pulse">ESTABLISHING LINK</h3>
                                <p className="text-xs text-gray-500 mt-2 font-mono">Triangulating persona signal...</p>
                                <div className="mt-4 w-3/4 h-1 bg-gray-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 animate-[shimmer_2s_infinite] w-full origin-left-right"></div>
                                </div>
                            </div>
                        )}

                        {loadingAI && !isGenSearching && (
                            <div className="col-span-2 text-center text-gray-500 py-4 font-mono text-xs animate-pulse">Scanning local frequencies...</div>
                        )}

                        {!loadingAI && !isGenSearching && aiPersonas.length === 0 && (
                            <div className="col-span-2 text-center text-gray-500 py-8 font-mono text-xs">
                                No AI locals detected.<br />Try searching for a specific name/role.
                            </div>
                        )}

                        {/* List - Blur if generating */}
                        <div className={`col-span-2 grid grid-cols-2 gap-3 transition-opacity duration-300 ${isGenSearching ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                            {(!loadingAI || (loadingAI && aiPersonas.length > 0)) && aiPersonas.map((persona, idx) => (
                                <div
                                    key={`${persona.name}-${idx}`}
                                    onClick={() => onChatSelect && onChatSelect(persona)}
                                    className="flex flex-col items-center p-3 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 hover:bg-white/10 hover:border-blue-500/30 transition-all hover:scale-[1.02] shadow-sm cursor-pointer group relative overflow-hidden"
                                >
                                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                                    <div className="w-14 h-14 rounded-full overflow-hidden border border-white/20 mb-2 relative z-10 shadow-lg">
                                        <img
                                            src={persona.imageUrl}
                                            alt={persona.name}
                                            onError={(e) => {
                                                e.currentTarget.onerror = null;
                                                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(persona.name)}&background=0D8ABC&color=fff`;
                                            }}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="text-center w-full relative z-10">
                                        <h3 className="font-bold text-white text-xs truncate group-hover:text-blue-400 transition-colors w-full">{persona.name}</h3>
                                        <p className="text-[10px] text-blue-300/80 font-medium truncate mb-1">{persona.occupation || 'Local'}</p>
                                        <p className="text-[9px] text-gray-400 line-clamp-2 h-6 leading-3 italic opacity-60">
                                            "{persona.bio || persona.mindset || 'Just chilling.'}"
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {!loadingAI && !isGenSearching && aiPersonas.length > 0 && (
                            <div className="col-span-2 text-[10px] text-gray-600 text-center pt-4 font-mono">
                                {isGenSearching ? 'Simulating...' : 'Recent AI detections'}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};

export default RealUsersList;
