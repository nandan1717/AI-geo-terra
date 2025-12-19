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
}

interface RealUsersListProps {
    onClose: () => void;
    onUserSelect: (userId: string) => void;
}

const RealUsersList: React.FC<RealUsersListProps> = ({ onClose, onUserSelect }) => {
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState<RealUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [addedUsers, setAddedUsers] = useState<string[]>([]); // Mock "added" state

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query.length >= 2) {
                setLoading(true);
                try {
                    const results = await socialService.searchUsers(query);
                    setUsers(results);
                } catch (error) {
                    console.error("Link search failed", error);
                } finally {
                    setLoading(false);
                }
            } else {
                setUsers([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const handleAdd = (userId: string) => {
        // Mock add functionality
        setAddedUsers([...addedUsers, userId]);
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a]">
            {/* Header */}
            <div className="flex items-center gap-2 p-4 border-b border-white/10 shrink-0">
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
                    <ChevronLeft size={24} />
                </button>
                <h2 className="text-lg font-bold text-white">Find Explorers</h2>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-white/5">
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
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loading && (
                    <div className="text-center text-gray-500 py-4 font-mono text-xs animate-pulse">Scanning frequency...</div>
                )}

                {!loading && users.length === 0 && query.length >= 2 && (
                    <div className="text-center text-gray-500 py-8 font-mono text-xs">No signals found.</div>
                )}

                {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors animate-in fade-in slide-in-from-bottom-2 group cursor-pointer">
                        <div className="flex items-center gap-3 flex-1" onClick={() => onUserSelect(user.id)}>
                            <img
                                src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                                alt={user.username}
                                className="w-10 h-10 rounded-full object-cover border border-white/10"
                            />
                            <div>
                                <h3 className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">{user.full_name || user.username}</h3>
                                <p className="text-xs text-gray-400">@{user.username}</p>
                                {user.location && <p className="text-[10px] text-blue-400/80 mt-0.5 font-mono">{user.location}</p>}
                            </div>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleAdd(user.id); }}
                            disabled={addedUsers.includes(user.id)}
                            className={`p-2 rounded-full transition-all shrink-0 ${addedUsers.includes(user.id)
                                ? 'bg-green-500/20 text-green-400 cursor-default'
                                : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white'
                                }`}
                        >
                            {addedUsers.includes(user.id) ? <Check size={18} /> : <UserPlus size={18} />}
                        </button>
                    </div>
                ))}

                {!loading && users.length === 0 && query.length < 2 && (
                    <div className="text-center text-gray-500/50 py-12 flex flex-col items-center gap-2">
                        <UserPlus size={32} strokeWidth={1} />
                        <p className="font-mono text-sm">Search to find other explorers</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RealUsersList;
