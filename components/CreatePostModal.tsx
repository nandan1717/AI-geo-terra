import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Sparkles, Image as ImageIcon, Globe, MapPin, Heart, Send, ArrowLeft, ChevronLeft } from 'lucide-react';
import { socialService } from '../services/socialService';
import { analyzeLocationRarity } from '../services/deepseekService';
import LocationInput from './LocationInput';

interface CreatePostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPostCreated: () => void;
}

// ------------------------------------------------------------------
// 1. Post Type Selection Screen
// ------------------------------------------------------------------
const PostTypeSelection: React.FC<{
    onSelect: (type: 'global' | 'story' | 'local') => void;
}> = ({ onSelect }) => {
    return (
        <div className="w-full max-w-4xl mx-auto p-4 flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in zoom-in-95 duration-300">
            <h2 className="text-white text-2xl font-bold mb-8 tracking-wider font-display text-center">
                SELECT TRANSMISSION MODE
            </h2>

            <div className="flex flex-col md:flex-row gap-6 w-full justify-center items-stretch">
                {/* Global Card */}
                <button
                    onClick={() => onSelect('global')}
                    className="group relative flex-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 hover:bg-blue-600/20 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-2 min-h-[200px]"
                >
                    <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Globe size={32} className="text-blue-400" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-bold text-white mb-1">Global Feed</h3>
                        <p className="text-sm text-gray-400 group-hover:text-blue-100/80">Public broadcast to all sectors.</p>
                    </div>
                </button>

                {/* Story Card */}
                <button
                    onClick={() => onSelect('story')}
                    className="group relative flex-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 hover:bg-amber-600/20 hover:border-amber-500/50 transition-all duration-300 hover:-translate-y-2 min-h-[200px]"
                >
                    <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Sparkles size={32} className="text-amber-400" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-bold text-white mb-1">Story Board</h3>
                        <p className="text-sm text-gray-400 group-hover:text-amber-100/80">Ephemeral updates. 6h visibility.</p>
                    </div>
                </button>

                {/* Local Card */}
                <button
                    onClick={() => onSelect('local')}
                    className="group relative flex-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 hover:bg-emerald-600/20 hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-2 min-h-[200px]"
                >
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <MapPin size={32} className="text-emerald-400" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-bold text-white mb-1">Local Profile</h3>
                        <p className="text-sm text-gray-400 group-hover:text-emerald-100/80">Save to your personal archives.</p>
                    </div>
                </button>
            </div>
        </div>
    );
};

// ------------------------------------------------------------------
// 2. Dedicated Story Creator UI (Mimics StoryBar Viewer)
// ------------------------------------------------------------------
const StoryCreator: React.FC<{
    image: File | null;
    preview: string | null;
    caption: string;
    loading: boolean;
    onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCaptionChange: (val: string) => void;
    onSubmit: () => void;
    onClose: () => void;
    onBack: () => void;
}> = ({ image, preview, caption, loading, onImageChange, onCaptionChange, onSubmit, onClose, onBack }) => {

    // We mock the "User" look for the preview
    // In a real app we'd fetch current user data, here we can use placeholders or props if passed
    const currentDate = new Date();

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
            {/* Main Container - Matches StoryBar Dimensions */}
            <div className="relative w-full h-full md:w-[480px] md:h-[92vh] md:rounded-[2rem] bg-gray-900 border border-white/10 overflow-hidden shadow-2xl flex flex-col">

                {/* 1. Progress Bar (Mocked as empty/full) */}
                <div className="absolute top-0 left-0 w-full z-30 flex gap-1 p-3 pt-4">
                    <div className="h-1 bg-white/20 rounded-full flex-1 overflow-hidden backdrop-blur-sm">
                        <div className="h-full bg-amber-500 w-0" /> {/* Empty state for creator */}
                    </div>
                </div>

                {/* 2. Header Info (Mocked Current User) */}
                <div className="absolute top-6 left-0 w-full z-30 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-1 rounded-full bg-black/20 text-white/70 hover:text-white mr-2 transition-colors">
                            <ChevronLeft size={24} />
                        </button>
                        <div className="p-[2px] border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)] rounded-full">
                            {/* Placeholder Avatar */}
                            <div className="w-9 h-9 rounded-full bg-gray-800 border-2 border-black flex items-center justify-center">
                                <span className="text-xs text-amber-500 font-bold">YOU</span>
                            </div>
                        </div>
                        <div className="flex flex-col drop-shadow-md">
                            <span className="text-white text-sm font-black tracking-wide font-display">New Story</span>
                            <span className="text-amber-200/80 text-[10px] font-mono tracking-wider flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                                Just now
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all border border-white/5"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 3. Main Content Area (The "Blank Format") */}
                <div className="flex-1 relative bg-black flex flex-col items-center justify-center group">
                    {preview ? (
                        <>
                            <img src={preview} className="w-full h-full object-cover opacity-100" />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-8 text-center gap-6">
                            <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center animate-pulse">
                                <Sparkles size={32} className="text-white/20" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg mb-2">Create Your Story</h3>
                                <p className="text-gray-500 text-sm max-w-[200px]">Share a moment. It will disappear in 6 hours.</p>
                            </div>
                            <label className="px-6 py-3 bg-white text-black rounded-full font-bold cursor-pointer hover:bg-gray-200 connection-all hover:scale-105 active:scale-95 transition-all">
                                <span>Upload Media</span>
                                <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
                            </label>
                        </div>
                    )}

                    {/* Change Media Button (Visible only when preview exists) */}
                    {preview && (
                        <label className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 px-6 py-3 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-full font-bold cursor-pointer opacity-0 group-hover:opacity-100 transition-all hover:bg-black/80">
                            <span>Change Media</span>
                            <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
                        </label>
                    )}

                    {/* Caption Overlay - Positioned exactly where viewer captions are */}
                    <div className="absolute bottom-32 left-0 w-full px-8 z-30">
                        <input
                            type="text"
                            placeholder="Add a caption..."
                            value={caption}
                            onChange={(e) => onCaptionChange(e.target.value)}
                            className="w-full bg-transparent border-none outline-none text-white placeholder-white/50 text-lg font-medium text-center drop-shadow-md font-display focus:placeholder-transparent"
                            autoFocus
                        />
                    </div>
                </div>

                {/* 4. Bottom Interactions (Replaced with Post Action) */}
                <div className="absolute bottom-0 left-0 w-full p-6 z-30 flex items-center justify-between gap-4">
                    {/* Mimic the viewer's bottom bar layout but with relevant controls */}

                    <div className="flex-1 h-12 flex items-center px-2">
                        {/* Hidden/Empty to match spacing or maybe put location here? */}
                    </div>

                    <button
                        onClick={onSubmit}
                        disabled={!image || loading}
                        className="h-12 px-6 rounded-full bg-amber-500 text-black font-bold shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:bg-amber-400 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : (
                            <>
                                <span>Post Story</span>
                                <Send size={18} />
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
};

// ------------------------------------------------------------------
// 3. Unified Post Creator (Global & Local)
// ------------------------------------------------------------------
const UnifiedPostCreator: React.FC<{
    mode: 'global' | 'local'; // New prop to distinguish mode
    image: File | null;
    preview: string | null;
    caption: string;
    loading: boolean;
    location: { name: string, lat: number, lng: number, country?: string } | null;
    rarity: { score: number, isExtraordinary: boolean, reason?: string, continent?: string } | null;
    analyzingRarity: boolean;
    onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCaptionChange: (val: string) => void;
    onLocationSelect: (loc: any) => void;
    onSubmit: () => void;
    onClose: () => void;
    onBack: () => void;
}> = ({ mode, image, preview, caption, loading, location, rarity, analyzingRarity, onImageChange, onCaptionChange, onLocationSelect, onSubmit, onClose, onBack }) => {

    const isGlobal = mode === 'global';
    const badgeText = isGlobal ? "Global Post" : "Local Archive";
    const badgeColor = isGlobal ? "bg-blue-600/80 border-blue-400/30" : "bg-emerald-600/80 border-emerald-400/30";
    const submitText = isGlobal ? "Share to Global" : "Save to Profile";
    const submitColor = isGlobal ? "bg-blue-600 hover:bg-blue-500 shadow-blue-900/20" : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20";

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
            {/* Main Container - Matches NewsFeed Card Dimensions */}
            <div className="relative w-full h-full md:w-[450px] md:h-[90vh] md:rounded-[2rem] bg-gray-900 border border-white/10 overflow-hidden shadow-2xl flex flex-col group">

                {/* Header Actions */}
                <div className="absolute top-6 left-0 w-full z-30 px-6 flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-3 pointer-events-auto">
                        <button onClick={onBack} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white transition-colors border border-white/10">
                            <ChevronLeft size={24} />
                        </button>
                        <div>
                            <span className={`px-3 py-1 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest text-white border shadow-lg ${badgeColor}`}>
                                {badgeText}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all border border-white/10 pointer-events-auto"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Background Media Layer */}
                <div className="absolute inset-0 z-0 bg-black">
                    {preview ? (
                        <img src={preview} className="w-full h-full object-cover opacity-100" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] flex flex-col items-center justify-center">
                            <div className={`w-24 h-24 rounded-full border flex items-center justify-center animate-pulse mb-4 ${isGlobal ? 'bg-blue-500/10 border-blue-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                                {isGlobal ? <Globe size={40} className="text-blue-500/50" /> : <MapPin size={40} className="text-emerald-500/50" />}
                            </div>
                            <p className={`font-mono text-xs tracking-widest uppercase ${isGlobal ? 'text-blue-500/50' : 'text-emerald-500/50'}`}>Add Image</p>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
                </div>

                {/* Content Layer (Bottom Aligned) */}
                <div className="relative z-10 flex-1 flex flex-col justify-end p-6 pb-8 gap-4">

                    {/* Tags & Metadata */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {analyzingRarity ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-white/10 text-white/50 border border-white/5 flex items-center gap-1">
                                <Loader2 size={10} className="animate-spin" /> Analyzing Sector...
                            </span>
                        ) : rarity ? (
                            <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full backdrop-blur-md border flex items-center gap-1 ${rarity.isExtraordinary ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                                <Sparkles size={10} /> {rarity.isExtraordinary ? 'Legendary Find' : `Rarity Class ${rarity.score}`}
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-white/10 text-white/50 border border-white/5">
                                Pending Scan
                            </span>
                        )}

                        {/* Location Input (Styled as Tag) */}
                        <div className="flex-1 min-w-[200px]">
                            <LocationInput
                                value={location ? location.name : ''}
                                onLocationSelect={onLocationSelect}
                                placeholder={image ? "Tag Sector Location..." : "Location required"}
                                className="bg-transparent border-0 p-0 text-white placeholder-gray-400 text-xs font-mono uppercase tracking-wide focus:ring-0"
                            />
                        </div>
                    </div>

                    {/* Title/Caption Input */}
                    <div className="relative">
                        <textarea
                            value={caption}
                            onChange={(e) => onCaptionChange(e.target.value)}
                            placeholder="What's happening?"
                            className="w-full bg-transparent border-none outline-none text-white placeholder-gray-500 text-2xl md:text-3xl font-display font-bold leading-tight resize-none h-auto overflow-hidden bg-none focus:ring-0 p-0 shadow-none"
                            rows={3}
                        />
                    </div>

                    {/* Upload / Change Media Button (Hidden but accessible via overlay or button) */}
                    {!preview && (
                        <label className={`w-full py-4 border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer group-upload ${isGlobal ? 'hover:border-blue-500/50 hover:bg-blue-500/10' : 'hover:border-emerald-500/50 hover:bg-emerald-500/10'}`}>
                            <ImageIcon size={24} className="mb-2 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-bold uppercase tracking-wider">Add Photo</span>
                            <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
                        </label>
                    )}

                    {preview && (
                        <label className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full text-white text-xs font-bold uppercase tracking-wider cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity border border-white/20 hover:bg-black/80">
                            Change Visual
                            <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
                        </label>
                    )}

                    {/* Footer / Submit */}
                    <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                        <div className="text-[10px] text-gray-500 font-mono uppercase">
                            {loading ? 'Posting...' : 'Ready'}
                        </div>
                        <button
                            onClick={onSubmit}
                            disabled={!image || !location || loading}
                            className={`px-6 py-2 text-white rounded-full font-bold text-xs uppercase tracking-wider shadow-lg disabled:opacity-50 disabled:grayscale transition-all hover:scale-105 active:scale-95 flex items-center gap-2 ${submitColor}`}
                        >
                            {loading && <Loader2 size={12} className="animate-spin" />}
                            {submitText}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

// ------------------------------------------------------------------
// 4. Main Modal Logic
// ------------------------------------------------------------------
const CreatePostModalComponent: React.FC<CreatePostModalProps> = ({ isOpen, onClose, onPostCreated }) => {
    // Stage: 'selection' | 'creating'
    const [stage, setStage] = useState<'selection' | 'creating'>('selection');
    const [postType, setPostType] = useState<'global' | 'story' | 'local'>('global');

    // Form State
    const [caption, setCaption] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState<{ name: string, lat: number, lng: number, country?: string, region?: string, continent?: string } | null>(null);

    // Rarity Logic
    const [analyzingRarity, setAnalyzingRarity] = useState(false);
    const [rarity, setRarity] = useState<{ score: number, isExtraordinary: boolean, reason?: string, continent?: string } | null>(null);

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setStage('selection'); // Always start at selection
            setCaption('');
            setImage(null);
            setPreview(null);
            setLocation(null);
            setRarity(null);
        }
    }, [isOpen]);

    const handleSelectType = (type: 'global' | 'story' | 'local') => {
        setPostType(type);
        setStage('creating');
    };

    const handleBackToSelection = () => {
        setStage('selection');
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImage(file);
            setPreview(URL.createObjectURL(file));
            setRarity(null);
        }
    };

    useEffect(() => {
        const analyze = async () => {
            if (image && location && !rarity && !analyzingRarity && postType !== 'story') {
                setAnalyzingRarity(true);
                const result = await analyzeLocationRarity(location.name, location.lat, location.lng, location.country);
                setRarity(result);
                setAnalyzingRarity(false);
            }
        };
        analyze();
    }, [location, image, postType]);

    const handleSubmit = async () => {
        if (!caption && !image) return;
        if (image && !location && postType !== 'story') {
            alert("Please tag a location for your photo to earn XP.");
            return;
        }

        setLoading(true);
        try {
            await socialService.createPost(image, caption, location, rarity ? { score: rarity.score, isExtraordinary: rarity.isExtraordinary, continent: rarity.continent } : undefined, postType);
            onPostCreated();

            // Dispatch event for StoryBar to refresh if it's a story
            if (postType === 'story') {
                window.dispatchEvent(new Event('geo-terra:story-created'));
            } else if (postType === 'global') {
                window.dispatchEvent(new Event('geo-terra:global-post-created'));
            }

            onClose();
        } catch (error) {
            console.error("Failed to post:", error);
            alert("Failed to create post. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // STEP 1: Selection Screen
    if (stage === 'selection') {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                <button onClick={onClose} className="absolute top-6 right-6 p-2 text-white/50 hover:text-white transition-colors border border-white/10 rounded-full">
                    <X size={24} />
                </button>
                <PostTypeSelection onSelect={handleSelectType} />
            </div>
        );
    }

    // STEP 2A: Story Creator (Full Screen, Custom UI)
    if (postType === 'story') {
        return (
            <StoryCreator
                image={image}
                preview={preview}
                caption={caption}
                loading={loading}
                onImageChange={handleImageChange}
                onCaptionChange={setCaption}
                onSubmit={handleSubmit}
                onClose={onClose}
                onBack={handleBackToSelection}
            />
        );
    }

    // STEP 2B & 2C: Global & Local Creator (Unified UI)
    return (
        <UnifiedPostCreator
            mode={postType as 'global' | 'local'}
            image={image}
            preview={preview}
            caption={caption}
            loading={loading}
            location={location}
            rarity={rarity}
            analyzingRarity={analyzingRarity}
            onImageChange={handleImageChange}
            onCaptionChange={setCaption}
            onLocationSelect={setLocation}
            onSubmit={handleSubmit}
            onClose={onClose}
            onBack={handleBackToSelection}
        />
    );
};

export default CreatePostModalComponent;
