
// DeepSeek API Service
const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY;

// Use direct URL if proxy fails or for debugging (DeepSeek supports CORS)
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
  try {
    if (!API_KEY) throw new Error("Missing DeepSeek API Key");

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
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
    console.error("DeepSeek Request Failed:", error);
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
  if (!API_KEY) {
    console.error("DeepSeek API Key missing");
    return null;
  }

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
    console.error("DeepSeek Analysis Failed:", error);
    return {
      score: 1,
      isExtraordinary: false,
      reason: "Could not analyze location.",
      continent: "Unknown"
    };
  }
};

export const fetchCountryColor = async (countryName: string): Promise<[number, number, number]> => {
  if (!API_KEY) {
    console.warn("DeepSeek API Key missing, using default orange.");
    return [1, 0.5, 0.1];
  }

  const prompt = `
    What is the single most dominant/representative color of the national flag of "${countryName}"?
    Return the color as a JSON object with "r", "g", "b" values normalized between 0.0 and 1.0.
    Example for India (Saffron): { "r": 1.0, "g": 0.6, "b": 0.2 }
    Example for USA (Blue): { "r": 0.23, "g": 0.35, "b": 0.6 }
    
    Return ONLY valid JSON.
  `;

  try {
    const resultString = await queryDeepSeek([
      { role: 'system', content: 'You are a color expert. Return strict JSON only.' },
      { role: 'user', content: prompt }
    ], true, 0.5); // Lower temperature for consistent colors

    const color = JSON.parse(resultString);

    // Validate bounds
    const r = Math.min(1, Math.max(0, color.r));
    const g = Math.min(1, Math.max(0, color.g));
    const b = Math.min(1, Math.max(0, color.b));

    return [r, g, b];
  } catch (error) {
    console.warn("Failed to fetch AI color for country:", countryName, error);
    return [1, 0.5, 0.1]; // Fallback Orange
  }
};
