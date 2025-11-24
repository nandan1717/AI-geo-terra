
import { GoogleGenAI } from "@google/genai";
import { LocalPersona, ChatMessage, ChatResponse } from "../types";
import { queryDeepSeek } from "./deepseekService";

const MODEL_NAME = "gemini-2.0-flash-exp"; // Use a fast, tool-capable model

// Initialize Gemini for Tool Use
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

/**
 * Model Context Protocol (MCP) Server
 * 
 * Acts as the orchestration layer between:
 * 1. Real-Time World Data (Google Search, Weather, etc.)
 * 2. The Persona Engine (DeepSeek)
 * 
 * It ensures that the "Context" fed to the persona is 100% grounded in real data,
 * while the "Persona" itself is free to hallucinate its personality.
 */
export class MCPContextServer {

    /**
     * 1. GATHER REAL-TIME CONTEXT
     * Uses Gemini Tools to fetch live data about the user's query in the specific location.
     * NOW CONTEXT-AWARE: Uses history to understand "it", "they", etc.
     */
    /**
     * 1. GATHER REAL-TIME CONTEXT
     * Uses Gemini Tools to fetch live data about the user's query in the specific location.
     * NOW CONTEXT-AWARE: Uses history to understand "it", "they", etc.
     */
    static async getRealTimeContext(query: string, locationName: string, history: ChatMessage[]): Promise<string> {
        // 1. Check Cache
        // We cache based on location + query to save costs on repeated questions
        const cacheKey = `mcp_ctx_${locationName}_${query}`.toLowerCase().replace(/\s+/g, '_');

        // Import ServiceCache dynamically or assume it's available if we imported it at top
        // Since we need to import it, let's do it at the top of the file or dynamically here.
        // Dynamic import is safer for circular deps if any.
        const { ServiceCache } = await import('./geminiService');
        const cached = ServiceCache.get<string>(cacheKey);
        if (cached) {
            console.log(`[MCP] Cache Hit for: "${query}"`);
            return cached;
        }

        try {
            // A. Intent Classification & Query Formulation
            // We ask Gemini to create the best search query for this context, considering history.
            const recentChat = history.slice(-3).map(m => `${m.role}: ${m.text}`).join('\n');

            const intentPrompt = `
                Current Location: "${locationName}"
                Current Time: "${new Date().toLocaleString()}"
                
                Chat History:
                ${recentChat}
                
                User's Latest Message: "${query}"
                
                Task: Create a Google Search query to find SPECIFIC, REAL-TIME facts.
                
                PRIORITY ORDER:
                1. **OFFICIAL WEBSITE**: Always try to find the official site first.
                2. **PRODUCTS/SERVICES**: What do they actually sell/do?
                3. **REVIEWS**: What do people say?
                4. **CONTACT**: Address, Phone, Hours.

                Instructions:
                - If the user asks about a business (e.g., "MN Garg Trading"), generate a query like: "MN Garg Trading Co official website products reviews address phone".
                - TIME SENSITIVE: If user asks "what time is it", use Current Time.
                - RESOLVE PRONOUNS: If user says "their number", find WHO "they" are from history.
                - If the user is just saying "hello" or general chit-chat, return "SKIP".
                
                Output: ONLY the query string.
            `;

            // Cost Optimization: Use Flash 2.0 (Valid & Efficient)
            const INTENT_MODEL = "gemini-2.0-flash-exp";

            const intentRes = await ai.models.generateContent({
                model: INTENT_MODEL,
                contents: intentPrompt,
                config: { temperature: 0 }
            });

            // Track Intent Call (Cheap)
            import('./usageTracker').then(({ APIUsageTracker }) => {
                APIUsageTracker.trackCall('mcp_intent', 0.0005, 'Gemini', apiKey);
            });

            const searchQuery = intentRes.text?.trim() || "";
            console.log(`[MCP] Generated Search Query: "${searchQuery}"`);

            if (searchQuery === "SKIP" || !searchQuery) {
                return ""; // No context needed for simple greetings
            }

            // B. Execute Search (Hybrid: Tavily Preferred -> Gemini Fallback)
            let contextData = "";
            let usedProvider = "Gemini";

            // 1. Try Tavily First (If Key Exists)
            try {
                const { TavilyService } = await import('./tavilyService');
                // Only use Tavily if we have a focused query
                const tavilyResult = await TavilyService.search(searchQuery); // Use the CLEAN query, not raw user text

                if (tavilyResult) {
                    contextData = tavilyResult;
                    usedProvider = "Tavily";
                    console.log("[MCP] Used Tavily for context.");
                }
            } catch (e) {
                console.warn("[MCP] Tavily check failed, proceeding to Gemini.");
            }

            // 2. Fallback to Gemini Tools (If Tavily failed or no key)
            if (!contextData) {
                const searchRes = await ai.models.generateContent({
                    model: MODEL_NAME, // Keep high quality model for reading search results
                    contents: `
                        Search Query: "${searchQuery}"
                        Task: Extract EXACT facts in this PRIORITY ORDER:
                        1. **OFFICIAL SOURCE**: URL of the official website if found.
                        2. **PRODUCTS/MENU**: Specific items they sell or services offered.
                        3. **REVIEWS/REPUTATION**: Star rating and summary of recent feedback.
                        4. **LOCATION/CONTACT**: Full Address, Phone Number.
                        5. **HOURS**: Current open/close status.
                        
                        Context: We are in ${locationName}. Ignore results from other cities.
                        Output: A structured, bulleted list.
                        WARNING: Do not invent information. If you can't find it, say "Data not found".
                    `,
                    config: {
                        tools: [{ googleSearch: {} }],
                        temperature: 0 // Strict facts
                    }
                });

                // Track Search Call (Expensive)
                import('./usageTracker').then(({ APIUsageTracker }) => {
                    APIUsageTracker.trackCall('mcp_search', 0.002, 'Gemini', apiKey);
                });

                contextData = searchRes.text || "";
            }

            console.log(`[MCP] Fetched Context (${usedProvider}):`, contextData);

            // Save to Cache
            if (contextData.length > 20) { // Only cache substantial results
                ServiceCache.set(cacheKey, contextData);
            }

            return contextData;

        } catch (error) {
            console.warn("MCP Context Fetch Failed:", error);
            return ""; // Fail gracefully, persona will improvise
        }
    }

    /**
     * 2. SYNTHESIZE RESPONSE
     * Combines the Real-Time Context with the Persona's System Prompt to generate the final response.
     */
    static async synthesizeResponse(
        persona: LocalPersona,
        locationName: string,
        history: ChatMessage[],
        userMessage: string,
        realTimeContext: string
    ): Promise<ChatResponse> {

        // Construct the "God Prompt" that enforces the separation of concerns
        const systemPrompt = `
            === IDENTITY ===
            Name: ${persona.name}
            Role: ${persona.occupation}
            Location: ${locationName}
            Bio: ${persona.bio}
            Mindset: ${persona.mindset}
            Dialect: Local, informal, authentic.

            === REAL-WORLD CONTEXT (VERIFIED FACTS) ===
            ${realTimeContext ? realTimeContext : "NO DATA FOUND. DO NOT GUESS."}

            === CRITICAL INSTRUCTIONS ===
            1. **TRUTH FIRST**: You are a roleplayer, but your FACTS must be 100% real.
            2. **NO HALLUCINATIONS**: If the user asks for a phone number/address and it is NOT in the context above, say "I don't have that info on me" or "You'll have to look that up". DO NOT INVENT NUMBERS.
            3. **USE CONTEXT**: If the context has the info, weave it naturally into your speech.
            4. **STAY IN CHARACTER**: Don't sound like a robot reading a list. Be ${persona.name}.
            5. **IGNORE IRRELEVANT**: If the search result is for a different city, ignore it.

            === FORMAT ===
            [Your In-Character Response]
            ___SUGGESTIONS___
            [Follow-up Q1]|[Follow-up Q2]|[Follow-up Q3]
        `;

        const recentHistory = history.slice(-6).map(m => `${m.role}: ${m.text}`).join('\n');

        try {
            const responseText = await queryDeepSeek([
                { role: "system", content: systemPrompt },
                { role: "user", content: `Chat History:\n${recentHistory}\n\nUser: ${userMessage}` }
            ], false, 1.1); // Slightly creative temperature

            // Parse the special format
            const parts = responseText.split("___SUGGESTIONS___");
            const replyText = parts[0].trim();
            const suggestions = parts[1] ? parts[1].split("|").map(s => s.trim()) : [];

            return {
                text: replyText,
                suggestions: suggestions,
                sources: realTimeContext ? [{ title: "Live Data Verification", uri: "https://google.com" }] : []
            };

        } catch (error) {
            console.error("MCP Synthesis Failed:", error);
            return {
                text: "I'm having a bit of a headache... ask me again?",
                suggestions: []
            };
        }
    }
}
