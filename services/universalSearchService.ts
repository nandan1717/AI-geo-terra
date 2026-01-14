import { searchEvents } from './gdeltService';
import { LocationMarker } from '../types';
import { extractTopicForNews } from './deepseekService';
import logger from './logger';

// REFACTOR: GDELT-ONLY SEARCH
// We have removed User, Persona, and Location searches to focus 100% on News Events.
// This simplifies the UX and privacy model.

export const universalSearchService = {
    search: async (query: string): Promise<{
        results: LocationMarker[],
        intent: 'EVENT',
        entity?: any
    }> => {

        // 1. Extract Topic (Always treat as News Event)
        // We use DeepSeek to extract the "Topic" or "Location" from the query
        // e.g. "What is happening in Bathinda" -> "Bathinda"
        const topic = await extractTopicForNews(query);
        logger.debug(`Universal Search (GDELT Only): ${query} -> [Topic] ${topic}`);

        let results: LocationMarker[] = [];

        try {
            // STRICT GDELT SEARCH
            // We search GDELT for events matching the topic.
            results = await searchEvents(topic);
        } catch (e) {
            console.error("GDELT Search Failed", e);
            results = [];
        }

        return { results, intent: 'EVENT', entity: null };
    }
};
