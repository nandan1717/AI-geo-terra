
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { LocationMarker } from '../types';
import { recommendationService } from '../services/recommendationService';
import { aiContentService } from '../services/aiContentService';
import { fetchGlobalEvents } from '../services/gdeltService';

interface NewsContextType {
    newsEvents: LocationMarker[]; // The currently visible "buffer" + history
    allEvents: LocationMarker[]; // The raw fetch
    isLoading: boolean;
    isNewsFeedOpen: boolean;
    toggleNewsFeed: () => void;
    loadMore: () => void;
    refresh: () => void;

    // Vibe Control
    selectedVibe: 'High Energy' | 'Chill' | 'Inspiration' | 'Intense' | 'Trending';
    setVibe: (vibe: 'High Energy' | 'Chill' | 'Inspiration' | 'Intense' | 'Trending') => void;

    // Deep Linking
    focusedEventId: string | null;
    setFocusedEventId: (id: string | null) => void;
}

const NewsContext = createContext<NewsContextType | undefined>(undefined);

export const NewsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [newsEvents, setNewsEvents] = useState<LocationMarker[]>([]); // What the UI sees
    const [allEvents, setAllEvents] = useState<LocationMarker[]>([]); // Full buffer from API
    const [isLoading, setIsLoading] = useState(false);
    const [isNewsFeedOpen, setIsNewsFeedOpen] = useState(false);

    const [selectedVibe, setSelectedVibe] = useState<'High Energy' | 'Chill' | 'Inspiration' | 'Intense' | 'Trending'>('Trending');
    const [focusedEventId, setFocusedEventId] = useState<string | null>(null);

    // Pagination / buffering state
    const [displayCount, setDisplayCount] = useState(10);
    const [offset, setOffset] = useState(0);
    const seenUrlsRef = useRef<Set<string>>(new Set());

    // Cycle Displayed News (for Globe Spin)
    const cycleNews = useCallback(() => {
        if (allEvents.length <= 10) return; // Not enough to cycle

        setOffset(prev => {
            const nextOffset = prev + 10;
            // Wrap around if we run out
            if (nextOffset >= allEvents.length) return 0;
            return nextOffset;
        });
        // Reset display count to show just a fresh batch of 10
        setDisplayCount(10);
    }, [allEvents.length]);

    // Cache for GDELT news to avoid re-fetching duplicates
    const newsCacheRef = useRef<LocationMarker[]>([]);

    // Initial Fetch & Refresh Logic
    const fetchFreshNews = useCallback(async (reset: boolean = false) => {
        setIsLoading(true);
        try {
            // Get Personalization Context
            const personalizedQuery = recommendationService.getPersonalizedQuery();

            // Reset state if changing vibe
            if (reset) {
                setAllEvents([]);
                setNewsEvents([]);
                setOffset(0);
                seenUrlsRef.current.clear();
                setDisplayCount(10);
                newsCacheRef.current = []; // Clear cache on hard reset
            }

            // 1. Get News Batch (from Cache or API)
            let newsBatch: LocationMarker[] = [];

            if (newsCacheRef.current.length < 10) {
                // Fetch a large fresh batch (60)
                // Note: GDELT maxrows=60 gives us a good pool.
                const freshNews = await fetchGlobalEvents(60, selectedVibe as any, personalizedQuery);

                // Filter duplicates against globally seen URLs
                const uniqueFresh = freshNews.filter(e => {
                    const key = e.sourceUrl || e.name;
                    if (seenUrlsRef.current.has(key)) return false;
                    return true;
                });

                // Rank/Score them
                const rankedFresh = recommendationService.rankItems(uniqueFresh);

                // Append to cache
                newsCacheRef.current = [...newsCacheRef.current, ...rankedFresh];
            }

            // Pop 10 items from cache
            newsBatch = newsCacheRef.current.splice(0, 10);

            // 2. Generate AI Content (10 items to match newsBatch size, or less if news ran out)
            const count = newsBatch.length > 0 ? newsBatch.length : 10; // Fallback to 10 AI items if no news

            const aiPosts = await aiContentService.batchGeneratePosts(count, selectedVibe === 'Trending' ? 'world events' : selectedVibe.toLowerCase());

            // 3. INTERLEAVE CONTENT (News, AI, News, AI...)
            const combinedFeed: LocationMarker[] = [];
            const maxLength = Math.max(newsBatch.length, aiPosts.length);

            for (let i = 0; i < maxLength; i++) {
                if (newsBatch[i]) combinedFeed.push(newsBatch[i]);
                if (aiPosts[i]) combinedFeed.push(aiPosts[i]);
            }

            // 4. Update State
            const newFreshEvents: LocationMarker[] = [];
            combinedFeed.forEach(e => {
                const key = e.sourceUrl || e.name;
                if (!seenUrlsRef.current.has(key)) {
                    seenUrlsRef.current.add(key);
                    newFreshEvents.push(e);
                }
            });

            if (newFreshEvents.length > 0) {
                // Determine if we append or replace. 
                // If it's a "Refresh" manually or initial load, we might want to replace.
                // But for "background load", we append to the hidden buffer.

                // For simplicity: We setAllEvents to the new batch + existing remainder?
                // Or just keep a running list?
                // Let's keep a running list of "allEvents" which acts as our source of truth.
                setAllEvents(prev => reset ? newFreshEvents : [...prev, ...newFreshEvents]);
            } else if (reset) {
                // If reset and no events, ensure we blank out
                setAllEvents([]);
            }

            // If this was an initial load and we have no displayed events, fill them.
            setNewsEvents(prev => {
                if (prev.length === 0 && newFreshEvents.length > 0) {
                    return newFreshEvents.slice(0, 10);
                }
                return prev;
            });

        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, [selectedVibe]);

    // Effect: Re-fetch on Vibe Change
    const lastFetchedVibe = useRef<'High Energy' | 'Chill' | 'Inspiration' | 'Intense' | 'Trending' | null>(null);

    // Consolidated Effect: Handle Initial Load AND Vibe Changes
    useEffect(() => {
        if (!isNewsFeedOpen) return;
        if (isLoading) return;

        // Fetch only if the requested vibe doesn't match what we have (or it's the first run)
        if (lastFetchedVibe.current !== selectedVibe) {

            lastFetchedVibe.current = selectedVibe;
            fetchFreshNews(true);
        }
    }, [isNewsFeedOpen, selectedVibe, isLoading, fetchFreshNews]);

    // Load More (Infinite Scroll Trigger)
    const loadMore = useCallback(() => {
        // Increase display count
        // Check if we have enough in 'allEvents' to satisfy the request
        const currentLength = newsEvents.length;
        const potentialNextLength = currentLength + 10;

        if (allEvents.length >= potentialNextLength) {
            // We have buffered events, just show them
            setNewsEvents(allEvents.slice(0, potentialNextLength));
        } else {
            // We are running low! Trigger a background fetch
            console.log("Running low on news, background fetching...");
            fetchFreshNews(false).then(() => {
                // After fetch, update the UI list with whatever we got
                setNewsEvents(current => {
                    // Re-slice from the updated allEvents?
                    // Actually complex: fetchFreshNews updates allEvents. 
                    // We need to wait for state update.
                    // But strictly, we can just bump the slice limit and React will catch up when allEvents grows.
                    return current; // Wait for effect?
                });
            });
            // Allowing the slice to expand even if empty for now, or wait?
            // Safer to just expand displayCount reference and let an effect handle "syncing" display list
            setDisplayCount(prev => prev + 10);
        }
    }, [newsEvents.length, allEvents, fetchFreshNews]);

    // Sync effect: When allEvents grows or displayCount changes, update newsEvents
    useEffect(() => {
        if (allEvents.length > 0) {
            setNewsEvents(allEvents.slice(0, displayCount));
        }
    }, [allEvents, displayCount]);

    // Initial load when opened (Old effect - REMOVED)
    // useEffect(() => {
    //     if (isNewsFeedOpen && allEvents.length === 0) {
    //         fetchFreshNews();
    //     }
    // }, [isNewsFeedOpen, fetchFreshNews, allEvents.length]);

    const toggleNewsFeed = () => setIsNewsFeedOpen(prev => !prev);

    // Helper ref to avoid closure staleness in filter
    const selectedMarkerRef = useRef<Set<string>>(seenUrlsRef.current);

    return (
        <NewsContext.Provider value={{
            newsEvents,
            allEvents,
            isLoading,
            isNewsFeedOpen,
            toggleNewsFeed,
            loadMore,
            refresh: () => fetchFreshNews(true),
            selectedVibe,
            setVibe: setSelectedVibe
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
