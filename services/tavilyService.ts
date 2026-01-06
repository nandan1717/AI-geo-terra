import { APIUsageTracker } from './usageTracker';

const TAVILY_API_URL = "https://api.tavily.com/search";

export class TavilyService {
    private static apiKey = import.meta.env.VITE_TAVILY_API_KEY;

    /**
     * Searches Tavily for real-time context.
     * COST SAVING STRATEGY:
     * 1. Use "basic" depth (1 credit) instead of "advanced" (2 credits).
     * 2. Use "include_answer" to get a direct summary without extra processing.
     * 3. Limit max_results to 3 to reduce noise.
     */
    static async search(query: string): Promise<string | null> {
        if (!this.apiKey) return null;

        try {
            const response = await fetch(TAVILY_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    api_key: this.apiKey,
                    query: query,
                    search_depth: "basic", // Cost: 1 Credit (vs 2 for advanced)
                    include_answer: true,   // Get direct answer
                    max_results: 3,         // Minimize noise
                    include_domains: [],    // Optional: restrict to reliable sources if needed
                    exclude_domains: []
                })
            });

            if (!response.ok) {
                console.warn(`[Tavily] Error: ${response.status} ${response.statusText}`);
                return null;
            }

            const data = await response.json();

            // Track Usage (Estimated $0.005 per credit for paid tier, though free tier exists)
            APIUsageTracker.trackCall('tavily_search', 0.005, 'Tavily', this.apiKey);

            // Format the output
            let context = "";

            // 1. Direct Answer (Best part)
            if (data.answer) {
                context += `**Direct Answer**: ${data.answer}\n\n`;
            }

            // 2. Sources
            if (data.results && data.results.length > 0) {
                context += "**Verified Sources**:\n";
                data.results.forEach((result: any) => {
                    context += `- [${result.title}](${result.url}): ${result.content.substring(0, 150)}...\n`;
                });
            }


            return context;

        } catch (error) {
            console.error("[Tavily] Request Failed:", error);
            return null;
        }
    }
}
