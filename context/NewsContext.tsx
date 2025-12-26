import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { LocationMarker } from '../types';
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
}

const NewsContext = createContext<NewsContextType | undefined>(undefined);

export const NewsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [newsEvents, setNewsEvents] = useState<LocationMarker[]>([]); // What the UI sees
    const [allEvents, setAllEvents] = useState<LocationMarker[]>([]); // Full buffer from API
    const [isLoading, setIsLoading] = useState(false);
    const [isNewsFeedOpen, setIsNewsFeedOpen] = useState(false);

    const [selectedVibe, setSelectedVibe] = useState<'High Energy' | 'Chill' | 'Inspiration' | 'Intense' | 'Trending'>('Trending');

    // Pagination / buffering state
    const [displayCount, setDisplayCount] = useState(10);
    const seenUrlsRef = useRef<Set<string>>(new Set());

    // Initial Fetch & Refresh Logic
    const fetchFreshNews = useCallback(async (reset: boolean = false) => {
        setIsLoading(true);
        try {
            console.log(`Fetching GDELT news for vibe: ${selectedVibe}...`);
            // Reset state if changing vibe
            if (reset) {
                setAllEvents([]);
                setNewsEvents([]);
                seenUrlsRef.current.clear();
                setDisplayCount(10);
            }
            // Fetch a large batch (60)
            // Note: Update service to accept vibe string if not strictly typed in import yet
            const events = await fetchGlobalEvents(60, selectedVibe as any);

            // Filter out duplicates based on Source URL or Title to ensure "freshness"
            const uniqueNewEvents = events.filter(e => {
                const navKey = e.sourceUrl || e.name;
                if (selectedMarkerRef.current.has(navKey)) return false;
                return true;
            });

            // If we have literally 0 new events, we might need to rely on the API returning *something* 
            // but for now, we just prepend whatever is new.
            // Actually, for "Reels", we often just want a linear stream.
            // Let's simplified: Deduplicate against *current session* seen items.

            const newFreshEvents: LocationMarker[] = [];
            events.forEach(e => {
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
            console.log(`State Trigger: Fetching for ${selectedVibe} (Last: ${lastFetchedVibe.current})`);
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
