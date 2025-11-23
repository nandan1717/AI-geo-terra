
import { GoogleGenAI } from "@google/genai";
import { LocationMarker, LocalPersona, ChatMessage, CrowdMember, ChatResponse } from "../types";
import { queryDeepSeek } from "./deepseekService";

const MODEL_NAME = "gemini-2.5-flash";
const IMAGEN_MODEL = "imagen-4.0-generate-001";

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



// --- CACHE LAYER ---
class ServiceCache {
  private static STORAGE_KEY = 'gemini_terra_cache_v1';
  private static EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

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
export const fetchLocationsFromQuery = async (query: string): Promise<LocationMarker[]> => {
  const cacheKey = `loc_${query.toLowerCase().trim()}`;
  const cached = ServiceCache.get<LocationMarker[]>(cacheKey);
  if (cached) return cached;

  try {
    // Enhanced prompt for "Smart Planet Search"
    // Handles:
    // 1. Direct place names ("Paris")
    // 2. Business names ("MN Garg Trading Co in Bathinda")
    // 3. Natural language queries ("highest mountain peak", "capital of france")
    const prompt = `
      Find the real-world location(s) that best match the user's query: "${query}".
      
      Rules:
      - If the query is a specific place or business, find its exact location.
      - If the query is a description (e.g., "highest mountain"), identify the place (e.g., "Mount Everest") and return its location.
      - If multiple relevant locations exist, return the top 1-3 most relevant ones.
      
      Return a STRICT JSON array of objects with these fields:
      - name: string (official name of the place)
      - latitude: number
      - longitude: number
      - description: string (1 sentence summary explaining why this place matches the query)
      - type: "Country" | "State" | "City" | "Place" | "Business" | "Landmark"
      - timezone: string (IANA format e.g., "Europe/London")
      - country: string (optional)
      - region: string (optional, e.g., state/province)
    `;

    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        temperature: 0, // Deterministic
        tools: [{ googleSearch: {} }], // Use Search to find the place first
      },
    });

    // Robust JSON Extraction
    const text = result.text || "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : "[]";

    try {
      const data = JSON.parse(jsonStr);
      const resultData = Array.isArray(data) ? data.map((item: any, index: number) => ({
        ...item,
        id: `loc_${Date.now()}_${index}`,
        type: item.type || 'Place'
      })) : [];
      if (resultData.length > 0) ServiceCache.set(cacheKey, resultData);
      return resultData;
    } catch (e) {
      // Fallback: Try internal knowledge if search JSON is malformed
      return await fetchLocationsInternalFallback(query);
    }

  } catch (error: any) {
    handleGeminiError(error, "Location Search");
    return [];
  }
};

const fetchLocationsInternalFallback = async (query: string): Promise<LocationMarker[]> => {
  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `List 1 real location for "${query}" as JSON Array with name, lat, lng, description, region, country, type (Country/State/City/Place).`,
      config: { responseMimeType: "application/json", temperature: 0 }
    });
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
      model: MODEL_NAME,
      contents: `Reverse Geocode: ${lat}, ${lng}. Return JSON object: {name, region, country, description, type (Country/State/City/Place)}.`,
      config: { temperature: 0, tools: [{ googleSearch: {} }] }
    });

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
    let systemPrompt = "You are a creative writer. Output strictly valid JSON.";
    let userPrompt = `Generate 3 distinct individuals at: ${location.name}, ${location.region}, ${location.country}. Time: ${localTime}.
            JSON Schema: { "members": [{ "name", "gender", "occupation", "age", "lineage", "mindset", "currentActivity", "mood", "bio" }] }`;

    if (customQuery) {
      systemPrompt = "You are a precise character generator. Output strictly valid JSON.";
      userPrompt = `Generate 3 distinct individuals at: ${location.name}, ${location.region}, ${location.country}. Time: ${localTime}.
        CRITICAL INSTRUCTION: All 3 individuals must strictly match the description: "${customQuery}".
        However, they must be distinct from each other in terms of age, specific role/nuance, personality, and background.
        Example: If query is "Doctor", generate a young resident, an experienced surgeon, and a traditional healer.
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
    model: MODEL_NAME,
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
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
            User: A mysterious voice from the sky.
            Task: JSON Output { "message": "Short, shocked reaction in local dialect.", "questions": ["Q1", "Q2", "Q3"] }`
      }
    ], true);

    const reactionData = JSON.parse(reactionJson);

    // B. Gemini Imagen for Visuals (Multimodal)
    const imagePrompt = `Photorealistic portrait of ${member.name}, ${member.occupation} in ${location.name}, ${location.country}. ${member.gender}, ${member.age} yo. Looking up at sky in awe. Cinematic, 8k.`;

    let imageUrl = "";
    try {
      const imageResult = await ai.models.generateImages({
        model: IMAGEN_MODEL,
        prompt: imagePrompt,
        config: { numberOfImages: 1, aspectRatio: '1:1' },
      });
      const bytes = imageResult.generatedImages?.[0]?.image?.imageBytes;
      if (bytes) imageUrl = `data:image/jpeg;base64,${bytes}`;
    } catch (e) { console.warn("Image gen failed"); }

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
