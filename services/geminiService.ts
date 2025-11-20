
import { GoogleGenAI } from "@google/genai";
import { LocationMarker, LocalPersona, ChatMessage, CrowdMember, ChatResponse } from "../types";
import { queryDeepSeek } from "./deepseekService";

const MODEL_NAME = "gemini-2.5-flash";
const IMAGEN_MODEL = "imagen-4.0-generate-001";

// Initialize Gemini client for Tools (Search/Maps) and Images
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
      User Query: "${query}"
      Task: Find real-world locations using Google Search/Maps tools.
      Return valid JSON Array.
      Required Fields: name, region, country, latitude, longitude, description, googleMapsUri.
      If query is gibberish, return [].
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
            contents: `List 1 real location for "${query}" as JSON Array with name, lat, lng, description, region, country.`,
            config: { responseMimeType: "application/json", temperature: 0 }
        });
        return JSON.parse(result.text);
    } catch (e) { return []; }
}

export const getPlaceFromCoordinates = async (lat: number, lng: number): Promise<LocationMarker> => {
    try {
        const result = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Reverse Geocode: ${lat}, ${lng}. Return JSON object: {name, region, country, description}.`,
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
            country: data.country || ""
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
export const fetchCrowd = async (location: LocationMarker): Promise<CrowdMember[]> => {
  const localTime = getLocalTime(location.longitude);

  try {
    // Use DeepSeek for more diverse and human-like personas
    const responseText = await queryDeepSeek([
        {
            role: "system",
            content: "You are a creative writer. Output strictly valid JSON."
        },
        {
            role: "user",
            content: `Generate 3 distinct individuals at: ${location.name}, ${location.region}, ${location.country}. Time: ${localTime}.
            JSON Schema: { "members": [{ "name", "gender", "occupation", "age", "lineage", "mindset", "currentActivity", "mood", "bio" }] }`
        }
    ], true);

    const data = JSON.parse(responseText);
    return data.members || [];

  } catch (error: any) {
    console.error("DeepSeek Crowd Error, falling back to Gemini", error);
    // Fallback to Gemini if DeepSeek fails
    return fetchCrowdFallback(location);
  }
}

const fetchCrowdFallback = async (location: LocationMarker): Promise<CrowdMember[]> => {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Generate 3 locals at ${location.name}. JSON format.`,
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

// --- 4. CHAT (Hybrid: Gemini Search -> DeepSeek Reply) ---
export const chatWithPersona = async (
    persona: LocalPersona, 
    locationName: string, 
    history: ChatMessage[], 
    userMessage: string
  ): Promise<ChatResponse> => {
    
    try {
        // STEP 1: USE GEMINI TO GATHER REAL-WORLD DATA (Web Scraping)
        const searchContext = await gatherLocalContext(userMessage, locationName);
        
        // STEP 2: USE DEEPSEEK TO GENERATE HUMAN RESPONSE
        const recentChat = history.slice(-6).map(m => `${m.role}: ${m.text}`).join('\n');
        
        const systemPrompt = `
            Roleplay as ${persona.name} from ${locationName}.
            Traits: ${persona.mindset}. Context: ${persona.currentActivity}.
            
            [REAL-WORLD DATA FOUND]:
            ${searchContext}
            
            RULES:
            1. USE THE DATA. If the search found a phone number or address, GIVE IT EXACTLY. Do not mask digits.
            2. If the data is for a different city, ignore it.
            3. Short, informal, local dialect.
            
            FORMAT:
            [Your Reply]
            ___SUGGESTIONS___
            [Q1]|[Q2]|[Q3]
        `;

        const responseText = await queryDeepSeek([
            { role: "system", content: systemPrompt },
            { role: "user", content: `Chat History:\n${recentChat}\n\nUser: ${userMessage}` }
        ], false, 1.2); // High temp for creativity

        // Parse Response
        const parts = responseText.split("___SUGGESTIONS___");
        const replyText = parts[0].trim();
        const suggestions = parts[1] ? parts[1].split("|").map(s => s.trim()) : [];

        return {
            text: replyText,
            suggestions: suggestions,
            sources: searchContext ? [{ title: "Live Local Data", uri: "google.com" }] : []
        };
  
    } catch (error: any) {
        console.error("Chat Error", error);
        return { text: "...", suggestions: [] };
    }
};

// Helper: Use Gemini to Search
const gatherLocalContext = async (query: string, location: string): Promise<string> => {
    try {
        // Construct a smart query first
        const smartQueryRes = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Convert this to a Google Search query for finding real info in ${location}: "${query}". Return ONLY the query string.`,
            config: { temperature: 0 }
        });
        const smartQuery = smartQueryRes.text?.trim() || `${query} ${location}`;

        // Execute Search
        const searchRes = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Search: "${smartQuery}". Extract EXACT phone numbers, addresses, and business names. If data is not in ${location}, ignore it.`,
            config: { tools: [{ googleSearch: {} }] }
        });

        return searchRes.text || "";
    } catch (e) { return ""; }
}
