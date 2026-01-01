import React, { useState, useEffect } from 'react';
import { X, MapPin, Heart, MessageCircle, Send, MoreHorizontal, Edit2, Trash2, Eye, EyeOff, Sparkles, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { socialService, Post, Comment } from '../services/socialService';
import { getPlaceFromCoordinates } from '../services/geminiService';

interface PostDetailModalProps {
    post: Post;
    onClose: () => void;
    onUpdate: () => void;
    onDelete?: () => void;
    hasNext?: boolean;
    hasPrev?: boolean;
    onNext?: () => void;
    onPrev?: () => void;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({ post, onClose, onUpdate, onDelete, hasNext, hasPrev, onNext, onPrev }) => {
    const [liked, setLiked] = useState(post.has_liked);
    const [likesCount, setLikesCount] = useState(post.likes_count);
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
        loadComments();
    }, [post.id]);

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
        setLoadingComments(true);
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
        try {
            await socialService.toggleHidePost(post.id, !post.is_hidden);
            onUpdate();
            setShowMenu(false);
        } catch (error) {
            console.error("Failed to toggle hide:", error);
            alert("Failed to hide/unhide post.");
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this post? This cannot be undone.")) return;
        setIsDeleting(true);
        try {
            await socialService.deletePost(post.id);
            onClose(); // Close modal first
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

    // Mobile View Controller
    const [showMobileDetails, setShowMobileDetails] = useState(false);

    // Swipe Handling
    const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null);
    const [touchEnd, setTouchEnd] = useState<{ x: number, y: number } | null>(null);

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
    }

    const onTouchMove = (e: React.TouchEvent) => setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distanceX = touchStart.x - touchEnd.x;
        const distanceY = touchStart.y - touchEnd.y;
        const minSwipeDistance = 50;

        if (Math.abs(distanceX) > Math.abs(distanceY)) {
            // Horizontal Swipe
            if (distanceX > minSwipeDistance && onNext) onNext(); // Swipe Left -> Next
            if (distanceX < -minSwipeDistance && onPrev) onPrev(); // Swipe Right -> Prev
        } else {
            // Vertical Swipe (Down to close)
            if (distanceY < -minSwipeDistance) onClose();
        }
    }

    if (isDeleting) return null;

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black p-0 md:p-4 animate-in fade-in duration-200">
            {/* Mobile Close Button (X) - Top Right (User Requested) */}
            <button
                onClick={onClose}
                className="md:hidden absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-white/20 transition-colors z-[5010] mt-safe shadow-lg active:scale-95">
                <X size={24} />
            </button>

            {/* Navigation Buttons (Desktop & Overlay) */}
            {hasPrev && (
                <button
                    onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/30 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-white/20 transition-all z-[5010] hidden md:flex active:scale-90"
                >
                    <ChevronLeft size={32} />
                </button>
            )}
            {hasNext && (
                <button
                    onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/30 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-white/20 transition-all z-[5010] hidden md:flex active:scale-90"
                >
                    <ChevronRight size={32} />
                </button>
            )}

            <div
                className="w-full max-w-6xl h-full md:h-[90vh] flex flex-col md:flex-row bg-[#0a0a0a] border-x-0 border-y-0 md:border border-white/10 md:rounded-2xl overflow-hidden shadow-2xl relative"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >

                {/* Image Section - Takes full height on mobile */}
                <div className={`flex-1 bg-black flex items-center justify-center border-b md:border-b-0 md:border-r border-white/10 relative group overflow-hidden ${showMobileDetails ? 'h-1/2' : 'h-full'} md:h-full transition-all duration-300`}>
                    {post.image_url ? (
                        <div className="w-full h-full overflow-auto flex items-center justify-center">
                            <img
                                src={post.image_url}
                                alt="Post content"
                                className="max-w-full max-h-full object-contain transition-transform duration-200"
                                style={{ touchAction: 'pan-x pan-y' }}
                            />
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center select-none bg-gradient-to-br from-gray-900 to-black">
                            <MessageCircle size={48} className="text-blue-500/50 mb-6" />
                            <div className="max-w-md">
                                <p className="text-lg md:text-2xl text-gray-200 font-medium leading-relaxed theme-font-primary">
                                    "{post.caption}"
                                </p>
                                {post.location_name && (
                                    <div className="mt-6 flex items-center justify-center gap-2 text-sm text-blue-400 uppercase tracking-wider">
                                        <MapPin size={14} />
                                        <span>{post.location_name}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Rarity Overlay - Repositioned for Mobile (Left) */}
                    {post.rarity_score > 0 && (
                        <div className={`absolute top-4 left-4 md:left-4 mt-safe md:mt-0 px-3 py-1.5 rounded-sm backdrop-blur-md border shadow-lg flex items-center gap-2 z-[110]
                            ${post.is_extraordinary
                                ? 'bg-amber-900/80 border-amber-500/50 text-amber-100'
                                : 'bg-black/80 border-white/20 text-white'}`}>
                            <Sparkles size={16} className={post.is_extraordinary ? 'fill-amber-400 text-amber-400' : 'text-blue-400'} />
                            <div className="flex flex-col leading-none">
                                <span className="text-[10px] uppercase tracking-wider font-bold opacity-80 font-mono">Rarity</span>
                                <span className="text-sm font-bold font-mono">{post.rarity_score}/10</span>
                            </div>
                        </div>
                    )}

                    {/* Mobile Navigation Arrows (Visible on Image) */}
                    {hasPrev && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
                            className="md:hidden absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/20 backdrop-blur-sm border border-white/5 rounded-full text-white/70 hover:bg-white/10 transition-colors z-[105]"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    )}
                    {hasNext && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                            className="md:hidden absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/20 backdrop-blur-sm border border-white/5 rounded-full text-white/70 hover:bg-white/10 transition-colors z-[105]"
                        >
                            <ChevronRight size={24} />
                        </button>
                    )}

                    {/* Mobile Floating Actions Overlay - Increased Z-Index & Visibility */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 md:hidden flex justify-between items-end bg-gradient-to-t from-black/90 via-black/50 to-transparent pb-8 z-[110]">
                        {!showMobileDetails && (
                            <>
                                <div className="flex flex-col gap-2 text-white max-w-[70%]">
                                    <div className="flex items-center gap-2">
                                        <img src={post.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user_id}`} className="w-6 h-6 rounded-full border border-white/20" />
                                        <h3 className="font-bold text-shadow-sm text-sm">{post.user?.full_name}</h3>
                                    </div>
                                    <p className="text-sm opacity-90 line-clamp-2 text-shadow-sm leading-relaxed">{post.caption}</p>
                                </div>
                                <div className="flex flex-col gap-6 items-center">
                                    <button onClick={handleLike} className="flex flex-col items-center gap-1 group">
                                        <div className={`p-3 rounded-full backdrop-blur-md border transition-all active:scale-90 ${liked ? 'bg-pink-500/20 border-pink-500 text-pink-500' : 'bg-black/40 border-white/20 text-white group-hover:bg-white/10'}`}>
                                            <Heart size={24} className={liked ? 'fill-current' : ''} />
                                        </div>
                                        <span className="text-[10px] font-bold text-white text-shadow">{likesCount}</span>
                                    </button>
                                    <button onClick={() => setShowMobileDetails(true)} className="flex flex-col items-center gap-1 group">
                                        <div className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white group-hover:bg-white/10 transition-all active:scale-90">
                                            <MessageCircle size={24} />
                                        </div>
                                        <span className="text-[10px] font-bold text-white text-shadow">{post.comments_count + comments.length}</span>
                                    </button>
                                    {isOwner && (
                                        <button onClick={() => setShowMenu(!showMenu)} className="flex flex-col items-center gap-1 group relative">
                                            <div className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white group-hover:bg-white/10 transition-all active:scale-90">
                                                <MoreHorizontal size={24} />
                                            </div>
                                            {showMenu && (
                                                <div className="absolute right-full mr-2 bottom-0 w-32 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-[120] overflow-hidden">
                                                    <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); setShowMenu(false); setShowMobileDetails(true); }} className="w-full text-left px-3 py-3 text-xs text-white hover:bg-white/10 flex items-center gap-2">
                                                        <Edit2 size={12} /> Edit
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleToggleHide(); }} className="w-full text-left px-3 py-3 text-xs text-white hover:bg-white/10 flex items-center gap-2">
                                                        {post.is_hidden ? <Eye size={12} /> : <EyeOff size={12} />} {post.is_hidden ? 'Unhide' : 'Hide'}
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="w-full text-left px-3 py-3 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                                                        <Trash2 size={12} /> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Details Section - Desktop: Sidebar / Mobile: Drawer/Panel */}
                <div className={`w-full md:w-[400px] flex flex-col bg-[#0a0a0a] backdrop-blur-xl absolute md:relative bottom-0 left-0 right-0 z-20 h-[60vh] md:h-full rounded-t-2xl md:rounded-none border-t border-white/10 transition-transform duration-300 transform md:transform-none ${showMobileDetails ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}`}>

                    {/* Mobile Drag Handle / Close Header */}
                    <div className="md:hidden w-full flex flex-col items-center pt-2 pb-1 border-b border-white/10 shrink-0" onClick={() => setShowMobileDetails(false)}>
                        <div className="w-12 h-1.5 bg-white/20 rounded-full mb-3" />
                        <div className="text-xs text-gray-500 font-mono uppercase">Pull down to close</div>
                    </div>

                    {/* Header */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <img src={post.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user_id}`} alt={post.user?.full_name} className="w-10 h-10 rounded-full border border-white/10" />
                            <div>
                                <h3 className="font-bold text-white text-sm">{post.user?.full_name || 'Unknown User'}</h3>
                                {post.location_name && (
                                    <div className="flex items-center gap-1 text-xs text-blue-400">
                                        <MapPin size={10} />
                                        <span>{post.location_name}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {isOwner && (
                            <div className="relative">
                                <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white">
                                    <MoreHorizontal size={20} />
                                </button>
                                {showMenu && (
                                    <div className="absolute right-0 top-full mt-2 w-40 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden">
                                        <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex items-center gap-2 text-white">
                                            <Edit2 size={14} /> Edit
                                        </button>
                                        <button onClick={handleToggleHide} className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex items-center gap-2 text-white">
                                            {post.is_hidden ? <Eye size={14} /> : <EyeOff size={14} />} {post.is_hidden ? 'Unhide' : 'Hide'}
                                        </button>
                                        <button onClick={handleDelete} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                                            <Trash2 size={14} /> Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Scrollable Content (Caption + Comments) */}
                    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <div className="p-4 space-y-4">
                            {/* Caption */}
                            {isEditing ? (
                                <div className="space-y-3 bg-white/5 p-3 rounded-xl border border-white/10">
                                    <textarea
                                        value={editCaption}
                                        onChange={(e) => setEditCaption(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                                        rows={4}
                                    />
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={editLocation}
                                            onChange={(e) => setEditLocation(e.target.value)}
                                            className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                            placeholder="Location"
                                        />
                                        <button onClick={handleGetLocation} className="p-2 bg-white/10 rounded-lg text-blue-400 hover:bg-white/20"><MapPin size={18} /></button>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
                                        <button onClick={handleSaveEdit} disabled={isSaving} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-full hover:bg-blue-500 disabled:opacity-50">
                                            {isSaving ? 'Saving...' : 'Save'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                                    <span className="font-bold text-white mr-2">{post.user?.full_name}</span>
                                    {post.caption}
                                </div>
                            )}

                            <div className="w-full border-t border-white/10" />

                            {/* Comments List */}
                            <div className="space-y-4 pb-20 md:pb-0">
                                {loadingComments ? (
                                    <div className="flex justify-center p-4">
                                        <Loader2 className="animate-spin text-gray-500" size={20} />
                                    </div>
                                ) : comments.length > 0 ? (
                                    comments.map(comment => (
                                        <div key={comment.id} className="flex gap-3 items-start">
                                            <img src={comment.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.user_id}`} className="w-8 h-8 rounded-full border border-white/10" />
                                            <div className="flex-1">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-xs font-bold text-white">{comment.user?.full_name}</span>
                                                    <span className="text-[10px] text-gray-500">{new Date(comment.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-sm text-gray-300 mt-0.5">{comment.content}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-xs text-gray-600 italic py-4">No comments yet.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-white/10 bg-black/20 shrink-0 mb-safe-bottom md:mb-0">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex gap-4">
                                <button onClick={handleLike} className={`group flex items-center gap-2 transition-colors ${liked ? 'text-pink-500' : 'text-white hover:text-pink-500'}`}>
                                    <Heart size={24} className={`transition-transform group-active:scale-75 ${liked ? 'fill-current' : ''}`} />
                                </button>
                                <button onClick={() => { }} className="text-white hover:text-blue-400 transition-colors">
                                    <MessageCircle size={24} />
                                </button>
                                <button className="text-white hover:text-green-400 transition-colors">
                                    <Send size={24} />
                                </button>
                            </div>
                            {post.xp_earned > 0 && (
                                <div className="text-emerald-400 text-xs font-bold px-2 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                                    +{post.xp_earned} XP EARNED
                                </div>
                            )}
                        </div>

                        <div className="font-bold text-sm text-white mb-2">{likesCount} likes</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">{new Date(post.created_at).toLocaleDateString(undefined, {
                            year: 'numeric', month: 'long', day: 'numeric'
                        })}</div>

                        {/* Comment Input */}
                        <form onSubmit={handleComment} className="relative">
                            <input
                                type="text"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Add a comment..."
                                className="w-full bg-white/5 border border-white/10 rounded-full pl-4 pr-12 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all placeholder-gray-500"
                            />
                            <button
                                type="submit"
                                disabled={!newComment.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors">
                                <span className="text-xs font-bold uppercase">Post</span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
