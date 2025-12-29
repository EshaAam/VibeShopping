'use server';

/**
 * Chat Server Actions
 *
 * WHY Server Actions:
 * - Keeps API key secure (never sent to client)
 * - Runs on server, reducing client bundle size
 * - Follows Next.js 15 best practices
 * - Provides type-safe mutations
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildPrompt } from '@/lib/ai/systemPrompt';

// Type for chat response
export interface ChatResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Send a message to the AI assistant
 *
 * @param userMessage - The user's question or message
 * @returns ChatResponse with success status and AI response
 */
export async function sendChatMessage(
  userMessage: string
): Promise<ChatResponse> {
  try {
    // Validate input
    if (!userMessage || typeof userMessage !== 'string') {
      return {
        success: false,
        message: '',
        error: 'Please enter a message.',
      };
    }

    // Trim and check length
    const trimmedMessage = userMessage.trim();
    if (trimmedMessage.length === 0) {
      return {
        success: false,
        message: '',
        error: 'Please enter a message.',
      };
    }

    // Limit message length to prevent abuse
    if (trimmedMessage.length > 500) {
      return {
        success: false,
        message: '',
        error: 'Message is too long. Please keep it under 500 characters.',
      };
    }

    // Get API key directly to ensure it's available
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set in environment variables');
      return {
        success: false,
        message: '',
        error: 'Chat is temporarily unavailable. Please try again later.',
      };
    }

    // Initialize Gemini directly in the server action
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',  // Free tier model
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
      },
    });

    const prompt = buildPrompt(trimmedMessage);

    // Generate content using Gemini
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Check if we got a valid response
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        message: '',
        error: "I couldn't generate a response. Please try again.",
      };
    }

    return {
      success: true,
      message: text.trim(),
    };
  } catch (error) {
    // Log detailed error for debugging (server-side only)
    console.error('Chat error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error message:', errorMessage);

    // Handle rate limiting specifically
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('Too Many Requests')) {
      return {
        success: false,
        message: '',
        error: 'Too many requests. Please wait a moment and try again.',
      };
    }

    // Handle model not found
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      return {
        success: false,
        message: '',
        error: 'AI service configuration error. Please contact support.',
      };
    }

    // Return user-friendly error
    return {
      success: false,
      message: '',
      error: 'Something went wrong. Please try again.',
    };
  }
}
