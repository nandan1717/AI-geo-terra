import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Camera, Heart, MessageCircle, Send, MoreHorizontal, Edit2, Image as ImageIcon, Loader2, Globe, ChevronLeft, Trash2, Eye, EyeOff, Sparkles } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { socialService, Post, Comment } from '../services/socialService';
import { chatService } from '../services/chatService';
import { getPlaceFromCoordinates } from '../services/geminiService';
import { analyzeLocationRarity } from '../services/deepseekService';
import { UserProfile } from '../types';
import LocationInput from './LocationInput';
import { PostDetailModal } from './PostDetailModal';






interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail?: string;
    targetUserId?: string; // New: ID of the user whose profile we are viewing
    lockdownMode?: boolean;
}



// --- Sub-Components ---


// --- Sub-Components ---

import { recommendationService } from '../services/recommendationService';

// ... (existing imports)

interface ProfileHeaderProps {
    profile: UserProfile;
    aiLocalsCount: number;
    isOwnProfile: boolean;
    onEdit: () => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ profile, aiLocalsCount, isOwnProfile, onEdit }) => {
    // List View State
    const [activeList, setActiveList] = useState<null | 'Countries' | 'Continents' | 'Following'>(null);

    // Gamification Calculations
    const level = profile.level || 1;
    const cwXp = profile.xp || 0;
    const nextLevelXp = level * 1000;
    const prevLevelXp = (level - 1) * 1000;
    const progress = Math.min(100, Math.max(0, ((cwXp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100));

    // Get Data
    const profileData = recommendationService.getProfile();
    const [followingTopics, setFollowingTopics] = useState<string[]>(profileData.followedTopics || []);
    const followingCount = followingTopics.length;
    // Force re-render periodically for timers? For now just on mount/update is fine.

    // Helper to get list data
    const getListData = () => {
        if (activeList === 'Countries') return profile.visited_countries || [];
        if (activeList === 'Continents') return profile.visited_continents || [];
        if (activeList === 'Following') return followingTopics;
        return [];
    };

    const handleUnfollow = async (topic: string) => {
        await recommendationService.unfollow(topic);
        setFollowingTopics(recommendationService.getProfile().followedTopics || []);
    };

    // Helper: Calculate Progress & Time Left
    const getTopicStatus = (topic: string) => {
        const normalized = topic.toLowerCase();
        const exp = profileData.topicExpirations?.[normalized];
        // console.log('Topic Status Check:', { topic, normalized, exp, allExps: profileData.topicExpirations });

        if (!exp) return { progress: 100, label: 'Forever', isForever: true };

        const now = Date.now();
        const timeLeft = exp - now;

        if (timeLeft <= 0) return { progress: 0, label: 'Expired', isForever: false };

        // Estimate Total Duration to calculate percentage handled
        // We don't store "start time", so we have to guess or just show "time left" as a full circle?
        // Ah, request says "how much time i am following for and how much time has passed".
        // Without start time, we can't show "passed". We only know "ends at".
        // Let's assume standard durations (12h, 1w, 30d) to guess the denominator? 
        // Or just show a countdown? 
        // Let's try to reverse engineer the duration bucket for the denominator.

        let duration = 0;
        const h12 = 12 * 3600 * 1000;
        const d7 = 7 * 24 * 3600 * 1000;
        const d30 = 30 * 24 * 3600 * 1000;

        // Simple heuristic: if timeLeft is close to X, assume X was total. 
        // But if 6 hours passed on a 12h timer, timeLeft is 6h. 
        // Maybe we just store `topicExpirations` as { expiresAt, duration } in future?
        // For now, let's just show a visual indicator of "Time Remaining" assuming a generic "full" circle is 100% capacity/health?
        // Wait, "how much time has passed". 
        // I'll make a simplifying assumption: The ring represents "Time Left". 
        // Since I don't have start time, I'll calculate percentage based on the *closest standard duration* ceiling.

        if (timeLeft <= h12) duration = h12;
        else if (timeLeft <= d7) duration = d7;
        else duration = d30;

        const progress = Math.min(100, Math.max(0, (timeLeft / duration) * 100));

        // Format Label
        let label = '';
        if (timeLeft < 3600 * 1000) label = `${Math.ceil(timeLeft / 60000)}m left`;
        else if (timeLeft < 86400 * 1000) label = `${Math.ceil(timeLeft / 3600000)}h left`;
        else label = `${Math.ceil(timeLeft / 86400000)}d left`;

        return { progress, label, isForever: false };
    };

    // Radius for SVG
    const radius = 8;
    const circumference = 2 * Math.PI * radius;

    // Sort Regions by XP
    const regions = Object.entries(profile.region_stats || {})
        .sort(([, a], [, b]) => (b as any).visitCount - (a as any).visitCount)
        .slice(0, 3); // Top 3

    return (
        <div className="p-6 pb-0 relative">
            {/* List Overlay */}
            {activeList && (
                <div className="absolute inset-0 z-20 bg-[#0a0a0a] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                            {activeList} List
                        </h3>
                        <button
                            onClick={() => setActiveList(null)}
                            className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10">
                        {getListData().length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs italic">
                                <Sparkles size={20} className="mb-2 opacity-30" />
                                No items found.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 p-2">
                                {getListData().map((item, idx) => {
                                    // Calculate Status for Following List
                                    let status = { progress: 100, label: '', isForever: true };
                                    if (activeList === 'Following') {
                                        status = getTopicStatus(item as string);
                                    }

                                    return (
                                        <div key={idx} className="px-3 py-2 bg-white/5 rounded-lg text-sm text-gray-200 border border-white/5 flex items-center gap-2 group/item">

                                            {/* Icon / Ring */}
                                            {activeList === 'Following' ? (
                                                <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                                    {status.isForever ? (
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
                                                    ) : (
                                                        <>
                                                            {/* SVG Ring */}
                                                            <svg className="w-full h-full -rotate-90">
                                                                <circle
                                                                    cx="10" cy="10" r={radius}
                                                                    fill="none"
                                                                    stroke="rgba(255,255,255,0.1)"
                                                                    strokeWidth="2"
                                                                />
                                                                <circle
                                                                    cx="10" cy="10" r={radius}
                                                                    fill="none"
                                                                    stroke={status.progress < 20 ? '#EF4444' : '#3B82F6'}
                                                                    strokeWidth="2"
                                                                    strokeDasharray={circumference}
                                                                    strokeDashoffset={circumference - (status.progress / 100) * circumference}
                                                                    strokeLinecap="round"
                                                                    className="transition-all duration-500 ease-out"
                                                                />
                                                            </svg>
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></div>
                                            )}

                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="truncate capitalize leading-tight">{item}</span>
                                                {activeList === 'Following' && !status.isForever && (
                                                    <span className={`text-[9px] font-mono leading-none mt-0.5 ${status.progress < 20 ? 'text-red-400' : 'text-blue-300/70'}`}>
                                                        {status.label}
                                                    </span>
                                                )}
                                            </div>

                                            {activeList === 'Following' && isOwnProfile && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUnfollow(item as string);
                                                    }}
                                                    className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
                                                    title="Unfollow"
                                                >
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/20">
                            <img src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`} alt={profile.full_name} className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full border border-[#0a0a0a]">
                            LVL {level}
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">{profile.full_name || 'Explorer'}</h2>
                        <p className="text-gray-400 text-sm">@{profile.username || profile.id.slice(0, 8)}</p>
                        {profile.location && (
                            <div className="flex items-center gap-1 text-xs text-blue-400 mt-1">
                                <MapPin size={12} />
                                <span>{profile.location}</span>
                            </div>
                        )}
                    </div>
                </div>
                {isOwnProfile && (
                    <button onClick={onEdit} className="px-3 py-1.5 rounded-lg border border-white/20 text-xs font-medium text-white hover:bg-white/10 transition-colors">
                        Edit
                    </button>
                )}
            </div>

            <div className="mt-4">
                <p className="text-sm text-gray-300">{profile.bio || "No bio yet."}</p>
                <div className="mt-3">
                    <div className="flex justify-between text-[10px] uppercase text-gray-500 font-bold mb-1">
                        <span>Explorer Progress</span>
                        <span>{cwXp} / {nextLevelXp} XP</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-6 py-4 border-t border-b border-white/10">
                <div className="col-span-1 border-r border-white/10 pr-2">
                    <div className="text-[10px] uppercase text-gray-500 font-bold mb-2">Top Regions</div>
                    <div className="space-y-2">
                        {regions.length > 0 ? regions.map(([region, xp]) => (
                            <div key={region}>
                                <div className="flex justify-between text-xs text-white mb-0.5">
                                    <span className="truncate max-w-[80px]">{region}</span>
                                    <span className="text-gray-500">{Math.floor(xp as number)}</span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full">
                                    <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, ((xp as number) / 1000) * 100)}%` }} />
                                </div>
                            </div>
                        )) : <div className="text-xs text-gray-600 italic">No regions explored yet.</div>}
                    </div>
                </div>

                <div className="col-span-2 grid grid-cols-3 gap-2">
                    <div
                        onClick={() => setActiveList('Countries')}
                        className="text-center p-2 bg-white/5 rounded-lg flex flex-col justify-center hover:bg-white/10 transition-colors cursor-pointer group"
                    >
                        <div className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors flex items-baseline justify-center gap-1">
                            {(profile.visited_countries || []).length}
                            <span className="text-[10px] text-gray-500 font-medium">/ 195</span>
                        </div>
                        <div className="text-[10px] text-gray-500 uppercase">Countries</div>
                    </div>
                    <div
                        onClick={() => setActiveList('Continents')}
                        className="text-center p-2 bg-white/5 rounded-lg flex flex-col justify-center hover:bg-white/10 transition-colors cursor-pointer group"
                    >
                        <div className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors flex items-baseline justify-center gap-1">
                            {(profile.visited_continents || []).length}
                            <span className="text-[10px] text-gray-500 font-medium">/ 7</span>
                        </div>
                        <div className="text-[10px] text-gray-500 uppercase">Continents</div>
                    </div>
                    {/* Following Tab */}
                    <div
                        onClick={() => setActiveList('Following')}
                        className="text-center p-2 bg-white/5 rounded-lg border border-white/10 flex flex-col justify-center hover:bg-white/10 transition-colors cursor-pointer group"
                        title="View Followed Topics"
                    >
                        <div className="text-lg font-bold text-blue-400 group-hover:text-blue-300 transition-colors">{followingCount}</div>
                        <div className="text-[10px] text-gray-500 uppercase">Following</div>
                    </div>
                </div>
            </div>


        </div >
    );
};

const CreatePost: React.FC<{ onPostCreated: () => void, onClose: () => void }> = ({ onPostCreated, onClose }) => {

    const [caption, setCaption] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState<{ name: string, lat: number, lng: number, country?: string, region?: string, continent?: string } | null>(null);

    // Rarity State
    const [analyzingRarity, setAnalyzingRarity] = useState(false);
    const [rarity, setRarity] = useState<{ score: number, isExtraordinary: boolean, reason?: string, continent?: string } | null>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImage(file);
            setPreview(URL.createObjectURL(file));
            setRarity(null); // Reset rarity when image changes
        }
    };

    // Auto-analyze when both image and location are present
    useEffect(() => {
        const analyze = async () => {
            if (image && location && !rarity && !analyzingRarity) { // Only analyze rarity if IMAGE is present
                setAnalyzingRarity(true);
                // Use DeepSeek for fact-based analysis of the location context
                const result = await analyzeLocationRarity(location.name, location.lat, location.lng, location.country);
                setRarity(result);
                setAnalyzingRarity(false);
            }
        };
        analyze();
    }, [location, image]);

    const handleSubmit = async () => {
        if (!caption && !image) return; // Must have at least one

        // Validation: If Image is present, Location is REQUIRED (for XP/Globe).
        // If Text Only, Location is OPTIONAL (No XP).
        if (image && !location) {
            alert("Please tag a location for your photo to earn XP.");
            return;
        }

        setLoading(true);
        try {
            await socialService.createPost(
                image,
                caption,
                location,
                rarity ? { score: rarity.score, isExtraordinary: rarity.isExtraordinary, continent: rarity.continent } : undefined
            );
            onPostCreated();
            onClose();
        } catch (error) {
            console.error("Failed to post:", error);
            alert("Failed to create post. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 border-b border-white/10 bg-white/5">
            <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0 border border-white/10" />
                <div className="flex-1 w-full min-w-0"> {/* Ensure flex child doesn't overflow */}
                    <textarea
                        placeholder="What's happening?"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-white placeholder-gray-500 resize-none min-h-[80px] text-base"
                    />

                    {/* Rarity Badge */}
                    {(analyzingRarity || rarity) && (
                        <div className={`mt-2 mb-2 p-2 rounded-lg text-xs flex items-center gap-2 ${rarity?.isExtraordinary ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/5 text-gray-300'}`}>
                            {analyzingRarity ? (
                                <>
                                    <Loader2 size={14} className="animate-spin text-blue-400" />
                                    <span>Verifying location uniqueness...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} className={rarity?.isExtraordinary ? 'text-amber-400' : 'text-gray-400'} />
                                    <span className="font-bold">Rarity Score: {rarity?.score}/10</span>
                                    {rarity?.isExtraordinary && <span className="font-bold ml-1 uppercase tracking-wider text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded-full">Legendary</span>}
                                </>
                            )}
                        </div>
                    )}

                    {preview && (
                        <div className="relative mt-2 rounded-xl overflow-hidden bg-black/40 border border-white/10">
                            <img src={preview} alt="Preview" className="w-full h-auto max-h-[60vh] object-contain" />
                            <button onClick={() => { setImage(null); setPreview(null); setRarity(null); }} className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70 backdrop-blur-md border border-white/10 transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {/* Controls Bar */}
                    <div className="flex flex-col gap-3 mt-3">
                        <div className="flex items-center gap-2 w-full">
                            <label className={`p-3 rounded-xl cursor-pointer transition-colors flex-shrink-0 border flex items-center justify-center ${image ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-black/40 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'}`}>
                                <ImageIcon size={20} />
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            </label>
                            <div className="flex-1 min-w-0">
                                <LocationInput
                                    value={location ? location.name : ''}
                                    onLocationSelect={setLocation}
                                    placeholder={image ? "Location..." : "Location (Optional)..."}
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={(!image && !caption.trim()) || loading || analyzingRarity}
                            className="w-full py-2 bg-blue-600 text-white rounded-full text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Post'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PostItem: React.FC<{ post: Post, onUpdate: () => void, onDelete?: () => void }> = ({ post, onUpdate, onDelete }) => {
    const [liked, setLiked] = useState(post.has_liked);
    const [likesCount, setLikesCount] = useState(post.likes_count);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loadingComments, setLoadingComments] = useState(false);

    // Menu & Edit State
    const [showMenu, setShowMenu] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editCaption, setEditCaption] = useState(post.caption);
    const [editLocation, setEditLocation] = useState(post.location_name);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentUser, setCurrentUser] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user?.id || null));
    }, []);

    const isOwner = currentUser === post.user_id;

    const handleLike = async () => {
        const originalLiked = liked;
        const originalCount = likesCount;

        setLiked(!liked);
        setLikesCount(liked ? likesCount - 1 : likesCount + 1);

        try {
            await socialService.toggleLike(post.id, liked);
        } catch (error) {
            setLiked(originalLiked);
            setLikesCount(originalCount);
            console.error("Like failed:", error);
        }
    };

    const loadComments = async () => {
        if (showComments) {
            setShowComments(false);
            return;
        }
        setLoadingComments(true);
        setShowComments(true);
        try {
            const data = await socialService.getComments(post.id);
            setComments(data);
        } catch (error) {
            console.error("Failed to load comments:", error);
        } finally {
            setLoadingComments(false);
        }
    };

    const handleComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            const comment = await socialService.addComment(post.id, newComment);
            setComments([...comments, comment]);
            setNewComment('');
        } catch (error) {
            console.error("Failed to comment:", error);
        }
    };

    const handleSaveEdit = async () => {
        console.log("Saving edit...");
        setIsSaving(true);
        try {
            await socialService.updatePost(post.id, { caption: editCaption, location_name: editLocation });
            setIsEditing(false);
            onUpdate();
        } catch (error) {
            console.error("Failed to update post:", error);
            alert("Failed to update post.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleHide = async () => {
        console.log("Toggling hide...");
        try {
            await socialService.toggleHidePost(post.id, !post.is_hidden);
            onUpdate();
            setShowMenu(false);
        } catch (error) {
            console.error("Failed to toggle hide:", error);
            alert("Failed to hide/unhide post. Check console for details.");
        }
    };

    const handleDelete = async () => {
        console.log("Deleting post...");
        if (!confirm("Are you sure you want to delete this post? This cannot be undone.")) return;
        setIsDeleting(true);
        try {
            await socialService.deletePost(post.id);
            if (onDelete) onDelete();
            onUpdate();
        } catch (error) {
            console.error("Failed to delete post:", error);
            alert("Failed to delete post.");
            setIsDeleting(false);
        }
    };

    const handleGetLocation = async () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                try {
                    const place = await getPlaceFromCoordinates(pos.coords.latitude, pos.coords.longitude);
                    setEditLocation(place.name);
                } catch (e) {
                    console.error("Loc error", e);
                }
            });
        }
    }

    if (isDeleting) return null; // Optimistic remove

    return (
        <div className={`border-b border-white/10 p-4 hover:bg-white/5 transition-colors relative ${post.is_hidden ? 'opacity-75 bg-red-900/10' : ''}`}>
            {post.is_hidden && (
                <div className="absolute top-2 right-12 px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded-full font-bold uppercase tracking-wider border border-red-500/20">
                    Hidden
                </div>
            )}

            <div className="flex gap-3">
                <img src={post.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user_id}`} alt={post.user?.full_name} className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{post.user?.full_name || 'Unknown User'}</span>
                            <span className="text-gray-500 text-xs">@{post.user?.username}</span>
                            <span className="text-gray-600 text-xs">· {new Date(post.created_at).toLocaleDateString()}</span>
                        </div>

                        {isOwner && (
                            <div className="relative">
                                <button onClick={() => { console.log("Menu clicked"); setShowMenu(!showMenu); }} className="text-gray-500 hover:text-white p-1 rounded-full hover:bg-white/10">
                                    <MoreHorizontal size={16} />
                                </button>
                                {showMenu && (
                                    <div className="absolute right-0 top-full mt-1 w-32 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl z-10 overflow-hidden">
                                        <button onClick={() => { console.log("Edit clicked"); setIsEditing(true); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 flex items-center gap-2">
                                            <Edit2 size={12} /> Edit
                                        </button>
                                        <button onClick={handleToggleHide} className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 flex items-center gap-2">
                                            {post.is_hidden ? <Eye size={12} /> : <EyeOff size={12} />} {post.is_hidden ? 'Unhide' : 'Hide'}
                                        </button>
                                        <button onClick={handleDelete} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                                            <Trash2 size={12} /> Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {isEditing ? (
                        <div className="mt-2 space-y-2 bg-white/5 p-3 rounded-lg border border-white/10">
                            <textarea
                                value={editCaption}
                                onChange={(e) => setEditCaption(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded p-2 text-sm text-white outline-none focus:border-blue-500"
                                rows={2}
                            />
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={editLocation}
                                    onChange={(e) => setEditLocation(e.target.value)}
                                    className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                                    placeholder="Location"
                                />
                                <button onClick={handleGetLocation} className="p-1.5 bg-white/10 rounded text-blue-400 hover:bg-white/20"><MapPin size={14} /></button>
                            </div>
                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
                                <button onClick={handleSaveEdit} disabled={isSaving} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 disabled:opacity-50">
                                    {isSaving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {post.location_name && (
                                <div className="flex items-center gap-1 text-xs text-blue-400 mt-0.5 mb-2">
                                    <MapPin size={12} />
                                    <span>{post.location_name}</span>
                                </div>
                            )}
                            <p className="text-gray-200 text-sm mb-3 whitespace-pre-wrap">{post.caption}</p>
                        </>
                    )}

                    {post.image_url && (
                        <div className="rounded-xl overflow-hidden border border-white/10 mb-3 relative group">
                            <img src={post.image_url} alt="Post content" className="w-full h-auto max-h-96 object-cover" />
                            {/* Rarity Overlay Badge */}
                            {post.rarity_score > 0 && (
                                <div className={`absolute top-2 right-2 px-2 py-1 rounded-lg backdrop-blur-md border shadow-lg flex items-center gap-1.5 
                                    ${post.is_extraordinary
                                        ? 'bg-amber-500/80 border-amber-300 text-black'
                                        : 'bg-black/60 border-white/20 text-white'}`}>
                                    <Sparkles size={12} className={post.is_extraordinary ? 'fill-current' : 'text-blue-400'} />
                                    <div className="flex flex-col leading-none">
                                        <span className="text-[8px] uppercase tracking-wider font-bold opacity-80">Rarity</span>
                                        <span className="text-xs font-bold">{post.rarity_score}/10</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-6 text-gray-500 text-sm">
                        <button onClick={handleLike} className={`flex items-center gap-2 hover:text-pink-500 transition-colors ${liked ? 'text-pink-500' : ''}`}>
                            <Heart size={18} className={liked ? 'fill-current' : ''} />
                            <span>{likesCount}</span>
                        </button>
                        <button onClick={loadComments} className="flex items-center gap-2 hover:text-blue-400 transition-colors">
                            <MessageCircle size={18} />
                            <span>{post.comments_count + comments.length}</span>
                        </button>
                        {post.xp_earned > 0 && (
                            <div className="flex items-center gap-1.5 text-emerald-400 font-medium ml-auto">
                                <span className="text-xs">+{post.xp_earned} XP</span>
                            </div>
                        )}
                    </div>

                    {showComments && (
                        <div className="mt-4 space-y-3">
                            {loadingComments ? (
                                <div className="text-center py-2"><Loader2 className="animate-spin mx-auto text-gray-500" size={16} /></div>
                            ) : (
                                comments.map(comment => (
                                    <div key={comment.id} className="flex gap-2">
                                        <img src={comment.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.user_id}`} className="w-6 h-6 rounded-full" />
                                        <div className="bg-white/5 rounded-lg px-3 py-2 flex-1">
                                            <p className="text-xs font-bold text-white">{comment.user?.full_name}</p>
                                            <p className="text-xs text-gray-300">{comment.content}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <form onSubmit={handleComment} className="flex gap-2 mt-2">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Write a comment..."
                                    className="flex-1 bg-transparent border border-white/20 rounded-full px-3 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                                />
                                <button type="submit" disabled={!newComment.trim()} className="text-blue-400 disabled:opacity-50"><Send size={16} /></button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const EditProfile: React.FC<{ profile: UserProfile, onSave: () => void, onCancel: () => void }> = ({ profile, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        occupation: profile.occupation || '',
        location: profile.location || ''
    });
    const [avatar, setAvatar] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [gettingLocation, setGettingLocation] = useState(false);

    const handleGetCurrentLocation = () => {
        if (navigator.geolocation) {
            setGettingLocation(true);
            navigator.geolocation.getCurrentPosition(async (pos) => {
                try {
                    const place = await getPlaceFromCoordinates(pos.coords.latitude, pos.coords.longitude);
                    setFormData(prev => ({ ...prev, location: place.name }));
                } catch (error) {
                    console.error("Failed to get location name:", error);
                    alert("Failed to determine location name.");
                } finally {
                    setGettingLocation(false);
                }
            }, (error) => {
                console.error("Geolocation error:", error);
                setGettingLocation(false);
                alert("Could not get your location.");
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let avatarUrl = profile.avatar_url;
            if (avatar) {
                avatarUrl = await socialService.uploadAvatar(avatar);
            }
            await socialService.updateProfile({ ...formData, avatar_url: avatarUrl });
            onSave();
        } catch (error) {
            console.error("Failed to update profile:", error);
            alert("Failed to update profile.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Edit Profile</h2>

            <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/20 relative group cursor-pointer">
                    <img src={avatar ? URL.createObjectURL(avatar) : (profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`)} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera size={24} className="text-white" />
                    </div>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files && setAvatar(e.target.files[0])} />
                </div>
                <div>
                    <p className="text-sm font-medium text-white">Profile Photo</p>
                    <p className="text-xs text-gray-500">Click to upload new photo</p>
                </div>
            </div>

            <div className="space-y-3">
                <div>
                    <label className="text-xs text-gray-400 block mb-1">Full Name</label>
                    <input type="text" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
                </div>
                <div>
                    <label className="text-xs text-gray-400 block mb-1">Bio</label>
                    <textarea value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none h-20 resize-none" />
                </div>
                <div>
                    <label className="text-xs text-gray-400 block mb-1">Occupation</label>
                    <input type="text" value={formData.occupation} onChange={e => setFormData({ ...formData, occupation: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
                </div>
                <div>
                    <label className="text-xs text-gray-400 block mb-1">Location</label>
                    <LocationInput
                        value={formData.location}
                        onLocationSelect={(loc) => setFormData({ ...formData, location: loc.name })}
                        placeholder="Search location..."
                    />
                </div>
            </div>

            <div className="flex gap-3 pt-4">
                <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-lg border border-white/20 text-white hover:bg-white/10">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Save Changes'}
                </button>
            </div>
        </form>
    );
};



const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, targetUserId, lockdownMode = false }) => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [posts, setPosts] = useState<Post[]>([]);
    const [isCreatingPost, setIsCreatingPost] = useState(false);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [userEmail, setUserEmail] = useState<string | undefined>();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const isOwnProfile = !targetUserId || targetUserId === currentUserId;

    // AI Locals State (Removed - moved to UIOverlay)


    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
                setUserEmail(user.email);
            }

            const effectiveUserId = targetUserId || user?.id;
            if (effectiveUserId) {
                let { data, error } = await supabase.from('app_profiles_v2').select('*').eq('id', effectiveUserId).single();

                // Handle missing profile (only if it's the current user)
                if (error && !targetUserId && (error.code === 'PGRST116' || (error as any).status === 406)) {
                    console.log("Profile not found, creating default...");
                    const rawName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Explorer';

                    const newProfile = {
                        id: user!.id,
                        username: rawName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000),
                        full_name: rawName,
                        bio: 'Ready to explore the world.',
                        occupation: 'Explorer',
                        location: 'Unknown Sector',
                        avatar_url: user?.user_metadata?.avatar_url || '',
                        explored_percent: 0,
                        regions_count: 0,
                        places_count: 0,
                        ai_locals_count: 0,
                        xp: 0,
                        level: 1,
                        region_stats: {},
                        visited_countries: [],
                        visited_continents: [],
                        visited_regions: []
                    };

                    const { data: createdProfile, error: createError } = await supabase
                        .from('app_profiles_v2')
                        .insert(newProfile)
                        .select()
                        .single();

                    if (createError) {
                        console.error("Failed to create default profile:", createError);
                        data = newProfile;
                    } else {
                        data = createdProfile;
                    }
                } else if (error) {
                    throw error;
                }

                setProfile(data);
            }
        } catch (error) {
            console.error("Error fetching profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPosts = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const effectiveUserId = targetUserId || user?.id;
            if (effectiveUserId) {
                const data = await socialService.fetchPosts(effectiveUserId);
                // Filter out stories from proper profile grid
                setPosts(data.filter(p => p.post_type !== 'story'));
            }
        } catch (error) {
            console.error("Error fetching posts:", error);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchProfile();
            fetchPosts();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4 pointer-events-auto">
            <div className="w-full h-full md:h-auto md:max-w-2xl bg-black/40 backdrop-blur-xl border-x-0 border-y-0 md:border border-white/10 md:rounded-2xl shadow-2xl overflow-hidden flex flex-col md:max-h-[90vh] animate-in zoom-in-95 duration-200 ring-1 ring-white/5">

                {/* Header Bar */}
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-white/5 shrink-0 backdrop-blur-md pt-safe-top">
                    <h1 className="text-lg font-bold text-white tracking-wider uppercase font-mono">Profile Data</h1>
                    {!lockdownMode && (
                        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent bg-gradient-to-b from-transparent to-black/40 pb-safe-bottom">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="animate-spin text-blue-500" size={32} />
                        </div>
                    ) : profile ? (
                        isEditing ? (
                            <EditProfile profile={profile} onSave={() => { setIsEditing(false); fetchProfile(); }} onCancel={() => setIsEditing(false)} />
                        ) : (
                            <>
                                <ProfileHeader
                                    profile={profile}
                                    aiLocalsCount={profile.ai_locals_count || 0}
                                    isOwnProfile={isOwnProfile}
                                    onEdit={() => setIsEditing(true)}
                                />

                                {/* Feed Section */}
                                <div className="mt-4 px-4 pb-20 md:pb-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                                            <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                                            Your World
                                        </h3>
                                        <button onClick={() => setIsCreatingPost(!isCreatingPost)} className="text-blue-400 text-xs hover:text-blue-300 font-mono border border-blue-500/30 px-3 py-1 rounded-full hover:bg-blue-500/10 transition-colors">
                                            {isCreatingPost ? 'CANCEL' : '+ NEW EXPLORATION'}
                                        </button>
                                    </div>

                                    {isCreatingPost && (
                                        <div className="mb-6 bg-white/5 rounded-xl border border-white/10 relative z-20">
                                            <CreatePost onPostCreated={() => { setIsCreatingPost(false); fetchPosts(); fetchProfile(); }} onClose={() => setIsCreatingPost(false)} />
                                        </div>
                                    )}

                                    {posts.length === 0 ? (
                                        <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-white/5">
                                            <Globe className="mx-auto mb-3 opacity-30" size={40} />
                                            <p className="text-gray-500 text-sm font-mono">NO DATA LOGGED IN SECTOR</p>
                                        </div>
                                    ) : (
                                        <div className="columns-2 md:columns-3 gap-2 space-y-2">
                                            {posts.map(post => (
                                                <div key={post.id} onClick={() => setSelectedPost(post)} className="break-inside-avoid relative group cursor-pointer overflow-hidden bg-white/5 rounded-lg border border-transparent hover:border-white/20 transition-all mb-2">
                                                    {post.image_url ? (
                                                        <img src={post.image_url} alt="Post" className="w-full h-auto object-contain transition-transform duration-700 opacity-80 group-hover:opacity-100" />
                                                    ) : (
                                                        <div className="w-full h-auto min-h-[160px] flex flex-col items-center justify-center p-4 text-center select-none bg-gradient-to-br from-gray-900 to-black border border-white/5">
                                                            <MessageCircle size={24} className="text-blue-500/50 mb-3" />
                                                            <p className="text-xs text-gray-300 font-medium line-clamp-4 leading-relaxed px-2 theme-font-primary">
                                                                {post.caption}
                                                            </p>
                                                            {post.location_name && (
                                                                <div className="mt-3 flex items-center gap-1 text-[10px] text-gray-500 uppercase tracking-wider">
                                                                    <MapPin size={10} />
                                                                    <span className="truncate max-w-[100px]">{post.location_name}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2 pointer-events-none backdrop-blur-[2px]">
                                                        {post.rarity_score > 0 && <div className="text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider text-amber-300"><Sparkles size={10} /> RARITY {post.rarity_score}</div>}
                                                        <div className="flex gap-4 text-xs font-bold font-mono">
                                                            <span className="flex items-center gap-1.5"><Heart size={14} className="fill-white" /> {post.likes_count}</span>
                                                            <span className="flex items-center gap-1.5"><MessageCircle size={14} className="fill-white" /> {post.comments_count}</span>
                                                        </div>
                                                    </div>

                                                    {post.is_extraordinary && (
                                                        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )
                    ) : (
                        <div className="p-8 text-center text-red-400 font-mono text-sm">ERROR: FAILED TO LOAD PROFILE DATA</div>
                    )}
                </div>
            </div>

            {selectedPost && (
                <PostDetailModal
                    post={selectedPost}
                    onClose={() => setSelectedPost(null)}
                    onUpdate={() => { fetchPosts(); fetchProfile(); }}
                    onDelete={() => { fetchPosts(); fetchProfile(); }}
                    hasNext={posts.findIndex(p => p.id === selectedPost.id) < posts.length - 1}
                    hasPrev={posts.findIndex(p => p.id === selectedPost.id) > 0}
                    onNext={() => {
                        const idx = posts.findIndex(p => p.id === selectedPost.id);
                        if (idx < posts.length - 1) setSelectedPost(posts[idx + 1]);
                    }}
                    onPrev={() => {
                        const idx = posts.findIndex(p => p.id === selectedPost.id);
                        if (idx > 0) setSelectedPost(posts[idx - 1]);
                    }}
                />
            )}
        </div>
    );
};

export default ProfileModal;
