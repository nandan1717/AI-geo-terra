
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

// --- 1. MAPS & LOCATION (Gemini - Best for Tools) ---
export const fetchLocationsFromQuery = async (query: string): Promise<LocationMarker[]> => {
  try {
    // Simplified prompt for Gemini to avoid hallucinations
    const prompt = `
      Identify locations in the text: "${query}".
      Return a JSON array of objects with these fields:
      - name: string (official name)
      - latitude: number
      - longitude: number
      - description: string (1 sentence summary)
      - type: "Country" | "State" | "City" | "Place"
      - timezone: string (IANA format e.g., "Europe/London" or "America/New_York")
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
      return Array.isArray(data) ? data : [];
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
    return JSON.parse(result.text);
  } catch (e) { return []; }
}

export const getPlaceFromCoordinates = async (lat: number, lng: number): Promise<LocationMarker> => {
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

    return {
      name: data.name || `Sector ${lat.toFixed(2)}, ${lng.toFixed(2)}`,
      latitude: lat,
      longitude: lng,
      description: data.description || "Current GPS Location",
      region: data.region || "",
      country: data.country || "",
      type: data.type || "Place"
    };
  } catch (error) {
    return {
      name: "Current Location",
      latitude: lat,
      longitude: lng,
      description: `GPS Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
    };
  }
};

// --- 2. CROWD GENERATION (DeepSeek - Best for Creative Writing) ---
export const fetchCrowd = async (location: LocationMarker, customQuery?: string): Promise<CrowdMember[]> => {
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
    return data.members || [];

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
