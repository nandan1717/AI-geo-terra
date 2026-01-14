
// DeepSeek API Service
// NOTE: For security, use the aiProxyClient.ts or queryDeepSeekSecure when possible
// This file maintains backward compatibility but should migrate to proxy calls

import { queryDeepSeekSecure } from './aiProxyClient';
import logger from './logger';

// Legacy fallback - only used if proxy is unavailable
const LEGACY_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;
const API_URL = "https://api.deepseek.com/chat/completions";

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const queryDeepSeek = async (
  messages: DeepSeekMessage[],
  jsonMode: boolean = false,
  temperature: number = 1.3
): Promise<string> => {
  // Try secure proxy first
  try {
    return await queryDeepSeekSecure(messages, jsonMode, temperature);
  } catch (proxyError) {
    logger.warn('AI Proxy unavailable, falling back to direct call:', proxyError);
  }

  // Legacy fallback (only if proxy fails and key is available)
  if (!LEGACY_API_KEY) {
    throw new Error("DeepSeek API unavailable. Please configure the ai-proxy Edge Function.");
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LEGACY_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: messages,
        temperature: temperature,
        response_format: jsonMode ? { type: "json_object" } : { type: "text" },
        stream: false
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    logger.error("DeepSeek Request Failed:", error);
    throw error;
  }
};

export interface RarityResult {
  score: number;
  reason: string;
  isExtraordinary: boolean;
  continent: string;
}

export const analyzeLocationRarity = async (
  locationName: string,
  lat: number,
  lng: number,
  country?: string
): Promise<RarityResult | null> => {
  // No early return - let queryDeepSeek handle proxy/fallback logic

  const prompt = `
    Analyze the travel rarity and significance of this location:
    Name: ${locationName}
    Coordinates: ${lat}, ${lng}
    ${country ? `Country: ${country}` : ''}

    Provide a factual, objective assessment based on tourism data, historical significance, and accessibility.
    
    1. Determine the 'score' (1-10) where 1 is a common everyday place (gas station, random street) and 10 is a world wonder or extremely remote/restricted location.
    2. Determine if it 'isExtraordinary' (true if score >= 8).
    3. Identify the 'continent' this location is in.
    4. Provide a short 'reason' (max 20 words).

    Return ONLY a JSON object in this format:
    {
        "score": number,
        "isExtraordinary": boolean,
        "continent": "Continent Name",
        "reason": "short explanation"
    }
    `;

  try {
    const resultString = await queryDeepSeek([
      { role: 'system', content: 'You are a strict, fact-based geography and travel expert.' },
      { role: 'user', content: prompt }
    ], true, 1.0);

    const result = JSON.parse(resultString);
    return {
      score: result.score,
      isExtraordinary: result.isExtraordinary,
      reason: result.reason,
      continent: result.continent
    };
  } catch (error) {
    logger.error("DeepSeek Analysis Failed:", error);
    return {
      score: 1,
      isExtraordinary: false,
      reason: "Could not analyze location.",
      continent: "Unknown"
    };
  }
};


export const extractTopicForNews = async (query: string): Promise<string> => {
  try {
    const prompt = `
      Extract the main topic/location/subject from this search query for a news search: "${query}"
      
      Examples:
      - "News in Japan" -> "Japan"
      - "Earthquake" -> "Earthquake"
      - "What's happening in Bathinda" -> "Bathinda"
      - "Paris" -> "Paris"
      
      Return JSON: { "topic": "extracted_term" }
    `;

    const raw = await queryDeepSeek([
      { role: 'system', content: 'You are a topic extractor. JSON only.' },
      { role: 'user', content: prompt }
    ], true, 0.1);

    const parsed = JSON.parse(raw);
    return parsed.topic || query;
  } catch (e) {
    logger.warn("Topic extraction failed, using query as is", e);
    return query;
  }
};
