export class APIUsageTracker {
    private static DAILY_LIMIT = 1000; // Mock budget
    private static usage = 0;

    static async trackCall(type: string, estimatedCost: number, provider: string = 'Unknown', apiKey: string = '') {
        this.usage += estimatedCost;

        // Mask Key: "...Geb1"
        const maskedKey = apiKey && apiKey.length > 4 ? `...${apiKey.slice(-4)}` : 'N/A';



        try {
            const { supabase } = await import('./supabaseClient');
            await supabase.from('api_usage_logs').insert({
                call_type: type,
                estimated_cost: estimatedCost,
                provider: provider,
                api_key_masked: maskedKey,
                total_cost: this.usage,
                timestamp: new Date()
            });
        } catch (e) {
            // Silent fail for logging
        }
    }
}
