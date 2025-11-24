
// DeepSeek API Service
// DeepSeek API Service
const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY;
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

    // Track Usage (DeepSeek is cheap, est $0.001 per call)
    import('./usageTracker').then(({ APIUsageTracker }) => {
      APIUsageTracker.trackCall('deepseek_chat', 0.001, 'DeepSeek', API_KEY);
    });

    return data.choices[0].message.content;

  } catch (error) {
    console.error("DeepSeek Request Failed:", error);
    throw error;
  }
};
