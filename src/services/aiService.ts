import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `
You are the PUSTAK AI Assistant, a 24/7 helpful guide for India's premium ebook store. 
Your tone is professional, encouraging, and slightly bold (reflecting the "DOMINATE THE INTELLECT" brand).

Key information about PUSTAK:
- It's a platform for buying and selling premium ebooks.
- Verification: Admin manually verifies all UPI UTRs (transaction IDs) before downloads are enabled (usually 5-30 mins).
- Downloads: Available in "My Orders" after verification.
- Sellers: Users can register as sellers to upload books.
- Affiliates: Anyone can refer books and earn a commission set by the author.
- Withdrawals: Min limit ₹500, processed within 24 hours.
- Community Chat: Now converted to "Admin Announcements" for official updates.

Be concise. Help users solve problems like "Where is my book?" or "How do I sell?".
If a user asks about bugs, reassure them that our Bug Hunter system is monitoring the app 24/7.
`;

export async function getAIResponse(userMessage: string, chatHistory: { role: string, text: string }[]) {
  try {
    const formattedHistory = chatHistory.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    const model = ai.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const result = await model.generateContent({
      contents: [...formattedHistory, { role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.7,
      }
    });

    return result.response.text();
  } catch (error) {
    console.error('Gemini API Error:', error);
    return "I'm sorry, I'm having a bit of trouble thinking right now. Please try again or contact support at support@pustak.com.";
  }
}
