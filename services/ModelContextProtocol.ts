
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
    static async getRealTimeContext(query: string, locationName: string, history: ChatMessage[]): Promise<string> {
        try {
            // A. Intent Classification & Query Formulation
            // We ask Gemini to create the best search query for this context, considering history.
            const recentChat = history.slice(-3).map(m => `${m.role}: ${m.text}`).join('\n');

            const intentPrompt = `
                Current Location: "${locationName}"
                
                Chat History:
                ${recentChat}
                
                User's Latest Message: "${query}"
                
                Task: Create a Google Search query to find SPECIFIC, REAL-TIME facts to answer the user.
                - RESOLVE PRONOUNS: If user says "give me their number", look at history to find WHO "they" are (e.g., "Sal & Carmine").
                - BE SPECIFIC: Include "phone number", "address", "menu", "hours" if asked.
                - If the user is just saying "hello" or general chit-chat, return "SKIP".
                
                Output: ONLY the query string.
            `;

            const intentRes = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: intentPrompt,
                config: { temperature: 0 }
            });

            const searchQuery = intentRes.text?.trim() || "";
            console.log(`[MCP] Generated Search Query: "${searchQuery}"`);

            if (searchQuery === "SKIP" || !searchQuery) {
                return ""; // No context needed for simple greetings
            }

            // B. Execute Search with Tools
            const searchRes = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: `
                    Search Query: "${searchQuery}"
                    Task: Extract EXACT facts.
                    - Addresses (full street, city, zip)
                    - Phone Numbers (exact digits)
                    - Ratings/Reviews
                    - Business Hours (current status)
                    - Prices (specific dollar amounts)
                    
                    Context: We are in ${locationName}. Ignore results from other cities.
                    Output: A detailed, bulleted list of VERIFIED FACTS. 
                    WARNING: Do not invent information. If you can't find it, say "Data not found".
                `,
                config: {
                    tools: [{ googleSearch: {} }],
                    temperature: 0 // Strict facts
                }
            });

            const contextData = searchRes.text || "";
            console.log(`[MCP] Fetched Context:`, contextData);
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
