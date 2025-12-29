/**
 * Gemini AI Client Helper
 *
 * WHY: Centralizes Gemini API initialization to avoid repeated setup.
 * This runs SERVER-SIDE ONLY to protect the API key.
 * Uses Gemini 1.5 Flash for free tier compatibility.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Validate API key exists at module load time
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn(
    'GEMINI_API_KEY is not set. Chat functionality will be disabled.'
  );
}

// Initialize the Gemini client (singleton pattern)
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Get the Gemini model instance
 * WHY gemini-2.0-flash: It's the latest free tier model with good performance for chat
 */
export function getGeminiModel() {
  if (!genAI) {
    throw new Error('Gemini AI is not configured. Please set GEMINI_API_KEY.');
  }

  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',  // Free tier model
    // Safety settings can be adjusted if needed
    generationConfig: {
      temperature: 0.7, // Balanced between creative and focused
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 1024, // Reasonable limit for chat responses
    },
  });
}

/**
 * Check if Gemini is available
 */
export function isGeminiAvailable(): boolean {
  return genAI !== null;
}
