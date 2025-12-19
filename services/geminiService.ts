
import { GoogleGenAI } from "@google/genai";
import { LocationMarker, LocalPersona, ChatMessage, CrowdMember, ChatResponse } from "../types";
import { queryDeepSeek } from "./deepseekService";

import { PORTRAIT_DATA } from './portraitLibrary';

const MODEL_NAME = "gemini-2.0-flash-exp";
const IMAGEN_MODEL = "imagen-4.0-generate-001";

// Cost Optimization: Static Portrait Library (Unsplash)
const PORTRAIT_LIBRARY = PORTRAIT_DATA;

// Initialize Gemini client for Tools (Search/Maps) and Images
// Use Vite environment variable with fallback
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;

if (!apiKey) {
  console.error("CRITICAL: Gemini API Key is missing. Please set VITE_GEMINI_API_KEY in your environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

// Helper to estimate local time based on longitude
const getLocalTime = (longitude: number): string => {
  const offsetHours = longitude / 15;
  const date = new Date();
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  const localDate = new Date(utcTime + (3600000 * offsetHours));
  return localDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const handleGeminiError = (error: any, context: string) => {
  const msg = error.toString().toLowerCase();
  if (msg.includes("429") || msg.includes("resource_exhausted") || msg.includes("quota")) {
    throw new Error(`Service quota exhausted. Please try again later.`);
  }
  console.error(`Service Error [${context}]:`, error);
  throw new Error(`Connection Failed: ${context}.`);
};


import { APIUsageTracker } from './usageTracker';

// --- CACHE LAYER ---
export class ServiceCache {
  private static STORAGE_KEY = 'mortals_cache_v2'; // Bumped to v2 to clear old non-Mapbox results
  private static EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  static get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(`${this.STORAGE_KEY}_${key}`);
      if (!item) return null;

      const { value, timestamp } = JSON.parse(item);
      if (Date.now() - timestamp > this.EXPIRY_MS) {
        localStorage.removeItem(`${this.STORAGE_KEY}_${key}`);
        return null;
      }
      return value;
    } catch (e) {
      return null;
    }
  }

  static set(key: string, value: any): void {
    try {
      const item = JSON.stringify({ value, timestamp: Date.now() });
      localStorage.setItem(`${this.STORAGE_KEY}_${key}`, item);
    } catch (e) {
      console.warn('Cache quota exceeded');
    }
  }
}

// --- 1. MAPS & LOCATION (Gemini - Best for Tools) ---
// --- 1. MAPS & LOCATION (Mapbox - Reliable Geocoding) ---
export const fetchLocationsFromQuery = async (query: string): Promise<LocationMarker[]> => {
  const cacheKey = `loc_${query.toLowerCase().trim()}`;
  const cached = ServiceCache.get<LocationMarker[]>(cacheKey);
  if (cached) return cached;

  try {
    // 1. Check Supabase Cache (Global)
    try {
      const { supabase } = await import('./supabaseClient');
      const { data } = await supabase
        .from('location_search_cache')
        .select('results, hit_count')
        .eq('query', cacheKey)
        .maybeSingle();

      if (data && data.results) {
        console.log("✅ Global Supabase Cache Hit:", query);
        supabase.from('location_search_cache')
          .update({ hit_count: (data.hit_count || 0) + 1 })
          .eq('query', cacheKey)
          .then();
        return data.results as LocationMarker[];
      }
    } catch (err) {
      console.warn("Supabase Cache Check Failed:", err);
    }

    // 2. Use Mapbox via LocationService
    const { locationService } = await import('./locationService');
    const mapboxResults = await locationService.searchPlaces(query);

    const results: LocationMarker[] = mapboxResults.map(place => ({
      id: place.id,
      name: place.name,
      description: place.place_name, // Use full address as description
      latitude: place.center[1], // Mapbox gives [lng, lat]
      longitude: place.center[0],
      type: 'Place', // Default type, Mapbox types need mapping if specific needed
      country: place.country,
      region: place.region,
      timezone: 'UTC' // Placeholder, could fetch via timezone api if needed, or leave for later
    }));

    if (results.length > 0) {
      ServiceCache.set(cacheKey, results);

      // Save to Supabase (Global Cache)
      try {
        const { supabase } = await import('./supabaseClient');
        await supabase.from('location_search_cache').insert({
          query: cacheKey,
          results: results,
          hit_count: 1
        });
      } catch (e) {
        console.warn("Failed to save to Supabase cache", e);
      }
    }

    return results;

  } catch (error: any) {
    console.error("Mapbox Search Failed:", error);
    return [];
  }
};

// Helper to fetch GeoJSON from Nominatim (OpenStreetMap)
// fetchGeoJSON removed as per user request


const fetchLocationsInternalFallback = async (query: string): Promise<LocationMarker[]> => {
  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp", // Cost optimization: Flash 2.0
      contents: `List 1 real location for "${query}" as JSON Array with name, lat, lng, description, region, country, type (Country/State/City/Place).`,
      config: { responseMimeType: "application/json", temperature: 0 }
    });
    await APIUsageTracker.trackCall('location_fallback', 0.0005, 'Gemini', apiKey);
    const data = JSON.parse(result.text);
    return Array.isArray(data) ? data.map((item: any, index: number) => ({
      ...item,
      id: `loc_fallback_${Date.now()}_${index}`,
      type: item.type || 'Place'
    })) : [];
  } catch (e) { return []; }
}

export const getPlaceFromCoordinates = async (lat: number, lng: number): Promise<LocationMarker> => {
  const cacheKey = `geo_${lat.toFixed(3)}_${lng.toFixed(3)}`;
  const cached = ServiceCache.get<LocationMarker>(cacheKey);
  if (cached) return cached;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp", // Cost optimization: Flash 2.0
      contents: `Reverse Geocode: ${lat}, ${lng}. Return JSON object: {name, region, country, description, type (Country/State/City/Place)}.`,
      config: { temperature: 0, tools: [{ googleSearch: {} }] }
    });
    await APIUsageTracker.trackCall('reverse_geo', 0.001, 'Gemini', apiKey);

    const text = result.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : "{}";
    const data = JSON.parse(jsonStr);

    const place: LocationMarker = {
      id: `loc_${lat}_${lng}`,
      name: data.name || `Sector ${lat.toFixed(2)}, ${lng.toFixed(2)}`,
      latitude: lat,
      longitude: lng,
      description: data.description || "Current GPS Location",
      region: data.region || "",
      country: data.country || "",
      type: data.type || "Place"
    };
    ServiceCache.set(cacheKey, place);
    return place;
  } catch (error) {
    return {
      id: `loc_${lat}_${lng}`,
      name: "Current Location",
      latitude: lat,
      longitude: lng,
      description: `GPS Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
    };
  }
};

// --- 2. CROWD GENERATION (DeepSeek - Best for Creative Writing) ---
export const fetchCrowd = async (location: LocationMarker, customQuery?: string): Promise<CrowdMember[]> => {
  // 1. If Custom Query -> Bypass Cache, go straight to AI
  if (customQuery) {
    return await generateCrowdWithAI(location, customQuery);
  }

  // 2. Standard Query -> Check Supabase Cache first
  try {
    // Import dynamically to avoid circular dependency issues if any, though safe here
    const { supabase } = await import('./supabaseClient');

    const { data, error } = await supabase
      .from('location_crowd_cache')
      .select('crowd_data')
      .eq('location_name', location.name)
      .eq('country', location.country || '') // Handle optional country
      .maybeSingle();

    if (data && data.crowd_data) {
      console.log("Hit Supabase Cache for Crowd:", location.name);
      return data.crowd_data as CrowdMember[];
    }
  } catch (err) {
    console.warn("Supabase Cache Check Failed:", err);
  }

  // 3. Cache Miss -> Generate with AI
  const members = await generateCrowdWithAI(location);

  // 4. Save to Supabase (Fire and Forget)
  saveCrowdToCache(location, members);

  return members;
}

const generateCrowdWithAI = async (location: LocationMarker, customQuery?: string): Promise<CrowdMember[]> => {
  const cacheKey = `crowd_${location.name}_${customQuery || 'default'}`;
  const cached = ServiceCache.get<CrowdMember[]>(cacheKey);
  if (cached) return cached;

  const localTime = getLocalTime(location.longitude);

  try {
    // Use DeepSeek for more diverse and human-like personas
    let systemPrompt = "Creative writer. Output strictly valid JSON.";
    let userPrompt = `Generate 3 distinct people at: ${location.name}, ${location.country}. Time: ${localTime}.
            JSON Schema: { "members": [{ "name", "gender", "occupation", "age", "lineage", "mindset", "currentActivity", "mood", "bio" }] }`;

    if (customQuery) {
      systemPrompt = "Character generator. Output strictly valid JSON.";
      userPrompt = `Generate 3 distinct people at: ${location.name}. Match description: "${customQuery}".
        Vary age/role/personality.
        JSON Schema: { "members": [{ "name", "gender", "occupation", "age", "lineage", "mindset", "currentActivity", "mood", "bio" }] }`;
    }

    const responseText = await queryDeepSeek([
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ], true);

    const data = JSON.parse(responseText);
    const members = data.members || [];
    if (members.length > 0) ServiceCache.set(cacheKey, members);
    return members;

  } catch (error: any) {
    console.error("DeepSeek Crowd Error, falling back to Gemini", error);
    // Fallback to Gemini if DeepSeek fails
    return fetchCrowdFallback(location, customQuery);
  }
}

const fetchCrowdFallback = async (location: LocationMarker, customQuery?: string): Promise<CrowdMember[]> => {
  const prompt = customQuery
    ? `Generate 3 distinct locals at ${location.name} who all match the description: "${customQuery}". Vary their ages and backgrounds. JSON format.`
    : `Generate 3 locals at ${location.name}. JSON format.`;

  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash-exp", // Cost optimization: Flash 2.0
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
  await APIUsageTracker.trackCall('crowd_fallback', 0.0005, 'Gemini', apiKey);
  return JSON.parse(result.text).members || [];
}

const saveCrowdToCache = async (location: LocationMarker, members: CrowdMember[]) => {
  try {
    const { supabase } = await import('./supabaseClient');
    await supabase.from('location_crowd_cache').insert({
      location_name: location.name,
      country: location.country || '',
      latitude: location.latitude,
      longitude: location.longitude,
      crowd_data: members
    });
    console.log("Saved crowd to Supabase:", location.name);
  } catch (e) {
    console.warn("Failed to save to Supabase cache", e);
  }
}

// --- 3. PERSONA CONNECTION (Gemini Image + DeepSeek Text) ---
export const connectWithCrowdMember = async (member: CrowdMember, location: LocationMarker): Promise<LocalPersona> => {
  const localTime = getLocalTime(location.longitude);

  try {
    // A. DeepSeek for Initial Reaction (Human nuance)
    const reactionJson = await queryDeepSeek([
      {
        role: "system",
        content: "You are a roleplay engine. Output valid JSON."
      },
      {
        role: "user",
        content: `Character: ${member.name}, ${member.occupation} in ${location.name}.
            User: Voice from sky.
            Task: JSON { "message": "Short reaction in local dialect.", "questions": ["Q1", "Q2", "Q3"] }`
      }
    ], true);

    const reactionData = JSON.parse(reactionJson);

    // B. Visuals (Cost Optimized: Cache -> Library -> Gen)
    let imageUrl = "";
    const cacheKey = `img_${member.gender}_${member.age}_${member.occupation}_${location.country}`.replace(/\s+/g, '_').toLowerCase();

    try {
      // 1. Check Supabase Cache
      const { supabase } = await import('./supabaseClient');
      const { data } = await supabase
        .from('persona_image_cache')
        .select('image_url')
        .eq('cache_key', cacheKey)
        .maybeSingle();

      if (data && data.image_url) {
        imageUrl = data.image_url;
      } else {
        // 2. Use Static Library (Context-Aware)
        const isFemale = member.gender.toLowerCase().includes('female');
        const isOld = member.age > 45;

        let libraryKey = isFemale ? 'female' : 'male';
        libraryKey += isOld ? '_old' : '_young';

        // @ts-ignore - Dynamic key access
        const library = PORTRAIT_LIBRARY[libraryKey] || PORTRAIT_LIBRARY[isFemale ? 'female_young' : 'male_young'] || PORTRAIT_LIBRARY.default;

        imageUrl = library[Math.floor(Math.random() * library.length)];

        // 3. Save assignment to cache (so this "type" of person always gets this image)
        await supabase.from('persona_image_cache').insert({
          cache_key: cacheKey,
          image_url: imageUrl
        });
      }

      /* 
      // EXPENSIVE: Imagen Generation (Disabled for cost reduction)
      const imageResult = await ai.models.generateImages({
        model: IMAGEN_MODEL,
        prompt: imagePrompt,
        config: { numberOfImages: 1, aspectRatio: '1:1' },
      });
      const bytes = imageResult.generatedImages?.[0]?.image?.imageBytes;
      if (bytes) imageUrl = `data:image/jpeg;base64,${bytes}`;
      */

    } catch (e) {
      console.warn("Image retrieval failed, using fallback");
      imageUrl = PORTRAIT_LIBRARY.default[0];
    }

    return {
      ...member,
      message: reactionData.message,
      suggestedQuestions: reactionData.questions || [],
      imageUrl: imageUrl,
    };

  } catch (error: any) {
    handleGeminiError(error, "Neural Link");
    throw error;
  }
};

// --- 4. CHAT (MCP Integration) ---
export const chatWithPersona = async (
  persona: LocalPersona,
  locationName: string,
  history: ChatMessage[],
  userMessage: string
): Promise<ChatResponse> => {

  // Import dynamically to avoid circular deps if any (though none here)
  const { MCPContextServer } = await import('./ModelContextProtocol');

  // 1. Get Real-Time Data
  const context = await MCPContextServer.getRealTimeContext(userMessage, locationName, history);

  // 2. Synthesize Response with Persona
  return await MCPContextServer.synthesizeResponse(
    persona,
    locationName,
    history,
    userMessage,
    context
  );
};

// --- 5. GAMIFICATION (Rarity Analysis) ---
export const analyzeLocationRarity = async (
  image: File,
  location: LocationMarker
): Promise<{ score: number; isExtraordinary: boolean; continent: string | null; reason: string }> => {
  try {
    const fileToGenerativePart = async (file: File) => {
      const base64EncodedDataPromise = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result?.toString().split(',')[1]);
        reader.readAsDataURL(file);
      });
      return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
      };
    };

    const imagePart = await fileToGenerativePart(image);
    const prompt = `Analyze this image taken at ${location.name}, ${location.region}, ${location.country}.
        Task: 
        1. Identify the **Continent** this location belongs to (e.g., "North America", "Europe", "Asia").
        2. Verification: Does the image match the location?
        3. Rarity: How rare/unique is this view or activity? (1=Generic, 10=Legendary).
        
        Return JSON: 
        { 
            "score": number, 
            "isExtraordinary": boolean (true if score > 8), 
            "continent": "StringName",
            "reason": "Short explanation" 
        }`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [
        { role: "user", parts: [{ text: prompt }, imagePart as any] } // Cast to any to avoid type issues with inlineData
      ],
      config: { responseMimeType: "application/json" }
    });

    await APIUsageTracker.trackCall('rarity_analysis', 0.005, 'Gemini', apiKey);

    const text = result.text || "{}";
    const data = JSON.parse(text);

    return {
      score: data.score || 1,
      isExtraordinary: data.isExtraordinary || false,
      continent: data.continent || null,
      reason: data.reason || "Analysis failed."
    };

  } catch (error) {
    console.error("Rarity Analysis Failed:", error);
    return { score: 1, isExtraordinary: false, continent: null, reason: "Could not verify rarity." };
  }
};

