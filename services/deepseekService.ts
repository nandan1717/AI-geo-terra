
// DeepSeek API Service
const API_KEY = "sk-782e8f899592402d9f9780e4ec629848";
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
    return data.choices[0].message.content;

  } catch (error) {
    console.error("DeepSeek Request Failed:", error);
    throw error;
  }
};
