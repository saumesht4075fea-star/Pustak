import React from 'react';

export async function getAIResponse(userMessage: string, chatHistory: { role: string, text: string }[]) {
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userMessage, chatHistory }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch AI response');
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error('AI Service Error:', error);
    return "I'm sorry, I'm having a bit of trouble thinking right now. Please try again or contact support at support@pustak.com.";
  }
}
