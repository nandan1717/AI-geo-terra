
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { LocationMarker } from '../types';
import { recommendationService } from '../services/recommendationService';
import { aiContentService } from '../services/aiContentService';
import { fetchGlobalEvents } from '../services/gdeltService';

interface NewsContextType {
    newsEvents: LocationMarker[]; // The currently visible items
    allEvents: LocationMarker[]; // Same as newsEvents in this simpler model
    isLoading: boolean;
    isNewsFeedOpen: boolean;
    toggleNewsFeed: () => void;
    loadMore: () => void;
    refresh: () => void;
    hasMore: boolean;

    // Vibe Control
    selectedVibe: 'High Energy' | 'Chill' | 'Inspiration' | 'Intense' | 'Trending';
    setVibe: (vibe: 'High Energy' | 'Chill' | 'Inspiration' | 'Intense' | 'Trending') => void;

    // Deep Linking
    focusedEventId: string | null;
    setFocusedEventId: (id: string | null) => void;
}

const NewsContext = createContext<NewsContextType | undefined>(undefined);

export const NewsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [newsEvents, setNewsEvents] = useState<LocationMarker[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isNewsFeedOpen, setIsNewsFeedOpen] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [selectedVibe, setSelectedVibe] = useState<'High Energy' | 'Chill' | 'Inspiration' | 'Intense' | 'Trending'>('Trending');
    const [focusedEventId, setFocusedEventId] = useState<string | null>(null);

    // Track seen IDs to absolutely prevent duplicates (React Key Collision Fix)
    const seenIdsRef = useRef<Set<string>>(new Set());

    // Track how many GDELT items we have fetched to ask for the next batch correctly
    const gdeltCountRef = useRef(0);

    // Reset Logic
    const resetState = () => {
        setNewsEvents([]);
        seenIdsRef.current.clear();
        gdeltCountRef.current = 0;
        setHasMore(true);
    };

    // Core Fetch Logic
    // nextBatchSize: How many NEW items we want.
    const fetchNewsBatch = useCallback(async (isReset: boolean = false) => {
        if (isLoading) return;
        setIsLoading(true);

        try {
            if (isReset) {
                resetState();
            }

            // Target counts
            const BATCH_SIZE = 10;
            const currentCount = isReset ? 0 : gdeltCountRef.current;
            const targetGdeltCount = currentCount + BATCH_SIZE;

            const personalizedQuery = recommendationService.getPersonalizedQuery();
            const vibeTopic = selectedVibe === 'Trending' ? 'world events' : selectedVibe.toLowerCase();

            // 1. FAST PATH: Fetch GDELT from Supabase (Instant)
            const fetchedGdeltMarkers = await fetchGlobalEvents(targetGdeltCount, selectedVibe as any, personalizedQuery).catch(err => {
                console.error("GDELT Fetch Failed", err);
                return [];
            });

            // Process GDELT Immediately
            const newGdeltItems: LocationMarker[] = [];
            fetchedGdeltMarkers.forEach(item => {
                if (!seenIdsRef.current.has(item.id)) {
                    seenIdsRef.current.add(item.id);
                    newGdeltItems.push(item);
                }
            });

            // Render GDELT immediately
            if (newGdeltItems.length > 0) {
                setNewsEvents(prev => {
                    const base = isReset ? [] : prev;
                    return [...base, ...newGdeltItems];
                });
            }

            // Update ref
            gdeltCountRef.current = targetGdeltCount;

            // 2. SLOW PATH: AI Generation (Background)
            // We do not await this to block the UI, but we track 'loading' state for it?
            // Actually, if we unset isLoading, the user sees content.
            // We can let AI generate in background and append.
            setIsLoading(false); // Unblock UI!

            aiContentService.batchGeneratePosts(BATCH_SIZE, vibeTopic).then(aiPosts => {
                const newAiItems: LocationMarker[] = [];
                aiPosts.forEach((p: LocationMarker) => {
                    if (!p.id.startsWith('ai-')) p.id = `ai-${Date.now()}-${Math.random()}`;
                    if (!seenIdsRef.current.has(p.id)) {
                        seenIdsRef.current.add(p.id);
                        newAiItems.push(p);
                    }
                });

                if (newAiItems.length > 0) {
                    setNewsEvents(prev => {
                        // Naive append. Ideally interleave, but ensuring speed is key for now.
                        return [...prev, ...newAiItems];
                    });
                }
            }).catch(err => console.error("AI Gen Failed", err));

            // Stop here since we already cleared isLoading
            return;

        } catch (e) {
            console.error("News Fetch Error:", e);
            setIsLoading(false);
        }
    }, [selectedVibe, isLoading]);

    // Initial Load & Vibe Change
    useEffect(() => {
        if (isNewsFeedOpen) {
            // Check if we need to load initially
            // Or if vibe changed?
            // Simple rule: If empty, load.
            // But we need to handle Vibe switching clearing the list.
            // We'll trust the "Refresh" button or explicit vibe setters to call fetchNewsBatch(true).
            // But for safety, if we open and it's empty, we fetch.
            if (gdeltCountRef.current === 0) {
                fetchNewsBatch(true);
            }
        }
    }, [isNewsFeedOpen, fetchNewsBatch]); // fetchNewsBatch depends on selectedVibe, so this handles vibe changes if we reset properly?

    // Actually explicit vibe change effect is safer
    useEffect(() => {
        // When vibe changes, we WANT to reset.
        if (isNewsFeedOpen) {
            fetchNewsBatch(true);
        } else {
            // If closed, just reset refs so next open is fresh?
            resetState();
        }
    }, [selectedVibe]);


    const loadMore = useCallback(() => {
        if (!hasMore || isLoading) return;
        console.log("Loading more news...");
        fetchNewsBatch(false);
    }, [hasMore, isLoading, fetchNewsBatch]);

    return (
        <NewsContext.Provider value={{
            newsEvents,
            allEvents: newsEvents, // Simplified: they are the same now
            isLoading,
            isNewsFeedOpen,
            toggleNewsFeed: () => setIsNewsFeedOpen(p => !p),
            loadMore,
            refresh: () => fetchNewsBatch(true),
            hasMore,
            selectedVibe,
            setVibe: setSelectedVibe,
            focusedEventId,
            setFocusedEventId
        }}>
            {children}
        </NewsContext.Provider>
    );
};

export const useNews = () => {
    const context = useContext(NewsContext);
    if (!context) {
        throw new Error('useNews must be used within a NewsProvider');
    }
    return context;
};
