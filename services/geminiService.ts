
import { GoogleGenAI, Type } from "@google/genai";
import { AuraAnalysis, ImageData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeAura(media: ImageData[]): Promise<AuraAnalysis> {
  const modelName = 'gemini-3-flash-preview';
  
  const mediaParts = media.map(m => ({
    inlineData: {
      data: m.base64.split(',')[1],
      mimeType: m.mimeType
    }
  }));

  const systemInstruction = `
    You are an elite, Gen-Z fashion, aesthetic, and vibe consultant for the "IsYourBaby10??!" app. 
    Analyze the uploaded image(s) or video(s) for overall aura, gorgeousness, allure, and aesthetic appeal.
    
    If a video is provided, your analysis MUST include:
    - Motion & Energy: Assess the fluidity and confidence of movement.
    - Presence: How well the subject owns the frame during the video duration.
    - Transitions: Evaluate any hair flips, turns, or facial expression shifts.
    
    For images, evaluate:
    - Lighting & Composition: Color harmony, sharpness, background coherence.
    - Styling: Grooming, fashion, and grooming impact.
    - Confidence: Facial expression and posture.
    
    Output:
    1. A score from 1.0 to 10.0 (one decimal place allowed).
    2. A stylish, snappy, confident paragraph explaining the score.
    3. A vivid "vision" of the level 10 version (specific posture, lighting, or motion advice).
    4. A set of detailed, actionable tips. Each tip should have a punchy title, a brief description of why it matters, and a specific "action" for the user.
    
    Style: Luxurious, bold, and sultry. Use premium Gen-Z aesthetic language (e.g., "serving pure main character", "absolute slayage", "ate the frame", "immaculate vibes").
    Return a structured JSON response.
  `;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: {
      parts: [
        ...mediaParts,
        { text: "Analyze the aesthetic aura and energy of this media. Provide a sophisticated and detailed Glow Up guide." }
      ]
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          auraScore: { type: Type.NUMBER },
          explanation: { type: Type.STRING },
          vision: { type: Type.STRING },
          tips: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Quick summary tips (short strings)."
          },
          detailedTips: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                action: { type: Type.STRING }
              },
              required: ["title", "description", "action"]
            }
          }
        },
        required: ["auraScore", "explanation", "vision", "tips", "detailedTips"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as AuraAnalysis;
}

export async function generateTransformation(image: ImageData): Promise<string> {
  const modelName = 'gemini-2.5-flash-image';
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: {
      parts: [
        {
          inlineData: {
            data: image.base64.split(',')[1],
            mimeType: image.mimeType
          }
        },
        {
          text: `Generate a new image based on this photo. 
          CRITICAL: Keep the person's REAL FACE exactly as it is. 
          CRITICAL: Keep the same BACKGROUND and the same OUTFIT.
          TASK: Change only the POSE and posture to be significantly more effortlessly attractive, high-fashion, and confident. 
          The subject should look like a professional model serving main character energy, but perfectly recognizable as the same person in the same setting.`
        }
      ]
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  throw new Error("Failed to generate transformation image");
}
