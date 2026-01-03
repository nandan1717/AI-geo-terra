
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

            // PARALLEL FETCHING: 10 GDELT + 10 AI
            const [fetchedGdeltMarkers, aiPosts] = await Promise.all([
                fetchGlobalEvents(targetGdeltCount, selectedVibe as any, personalizedQuery).catch(err => {
                    console.error("GDELT Fetch Failed", err);
                    return [];
                }),
                aiContentService.batchGeneratePosts(BATCH_SIZE, vibeTopic).catch(err => {
                    console.error("AI Gen Failed", err);
                    return [];
                })
            ]);

            // Deduplicate GDELT
            const newGdeltItems: LocationMarker[] = [];
            fetchedGdeltMarkers.forEach(item => {
                if (!seenIdsRef.current.has(item.id)) {
                    seenIdsRef.current.add(item.id);
                    newGdeltItems.push(item);
                }
            });

            // GDELT pagination tracking logic
            // Only update count if we actually got items, or if we assume we moved forward.
            // GDELT 'maxrows' is absolute, so we update ref to target.
            gdeltCountRef.current = targetGdeltCount;

            // Deduplicate AI Posts (assign unique IDs if needed)
            const newAiItems: LocationMarker[] = [];
            aiPosts.forEach((p: LocationMarker) => { // Explicit type hint
                // Ensure ID uniqueness
                if (!p.id.startsWith('ai-')) p.id = `ai-${Date.now()}-${Math.random()}`;
                if (!seenIdsRef.current.has(p.id)) {
                    seenIdsRef.current.add(p.id);
                    newAiItems.push(p);
                }
            });

            if (newGdeltItems.length === 0 && newAiItems.length === 0 && !isReset) {
                console.log("No new items found. End of feed.");
                setHasMore(false);
                setIsLoading(false);
                return;
            }

            // INTERLEAVE: 1 GDELT, 1 AI, 1 GDELT, 1 AI...
            const interleaved: LocationMarker[] = [];
            const maxLength = Math.max(newGdeltItems.length, newAiItems.length);

            for (let i = 0; i < maxLength; i++) {
                if (i < newGdeltItems.length) interleaved.push(newGdeltItems[i]);
                if (i < newAiItems.length) interleaved.push(newAiItems[i]);
            }

            setNewsEvents(prev => {
                if (isReset) return interleaved;
                return [...prev, ...interleaved];
            });

        } catch (e) {
            console.error("News Fetch Error:", e);
        } finally {
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
