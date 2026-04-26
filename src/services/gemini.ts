/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI, Modality } from "@google/genai";

// Use the ambient GEMINI_API_KEY provided by the environment
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const getAIContent = async (reqContent: any, modelName: string = "gemini-3-flash-preview") => {
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: Array.isArray(reqContent) ? reqContent : [reqContent],
    });
    
    if (!response.text) {
      throw new Error("AI failed to generate a text response. Please try again.");
    }
    return response.text;
  } catch (err: any) {
    console.error("Gemini Error:", err);
    throw err;
  }
};

const characters: Record<string, { voice: string, style: string }> = {
  'narrator_m': { voice: 'Kore', style: 'professional and clear male movie trailer narrator' },
  'narrator_f': { voice: 'Puck', style: 'professional and clear female narrator' },
  'hero_m': { voice: 'Charon', style: 'deep, authoritative, and heroic male dark knight' },
  'hero_f': { voice: 'Zephyr', style: 'strong, determined, and heroic female warrior' },
  'villain_m': { voice: 'Charon', style: 'dark, menacing, and cold male villain' },
  'villain_f': { voice: 'Fenrir', style: 'mysterious, calculating, and cold female villain' },
  'guide_m': { voice: 'Kore', style: 'friendly, warm, and helpful male AI assistant' },
  'guide_f': { voice: 'Puck', style: 'friendly, warm, and helpful female AI assistant' },
  'sage_m': { voice: 'Fenrir', style: 'mysterious, wise, and ancient male wizard' },
  'sage_f': { voice: 'Zephyr', style: 'wise, mystical, and ancient female oracle' },
  'host_m': { voice: 'Kore', style: 'young, energetic, and enthusiastic male radio host' },
  'host_f': { voice: 'Zephyr', style: 'young, energetic, and enthusiastic female radio host' },
  'anime_m': { voice: 'Zephyr', style: 'energetic and determined male anime protagonist' },
  'anime_f': { voice: 'Puck', style: 'energetic and determined female anime protagonist' },
  'robot': { voice: 'Kore', style: 'monotone, precise, and futuristic robot' }
};

export const generateVoice = async (text: string, characterId: string = 'narrator_m') => {
  try {
    const char = characters[characterId] || characters['narrator_m'];
    
    const speechResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Say this as a ${char.style}: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: char.voice },
          },
        },
      },
    });

    const base64Audio = speechResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio ? `data:audio/mp3;base64,${base64Audio}` : null;
  } catch (err: any) {
    console.error("GenerateVoice Error:", err);
    throw err;
  }
};

export const analyzeImage = async (imageData: string, prompt: string) => {
  const [meta, base64Data] = imageData.split(',');
  const mimeType = meta.split(':')[1].split(';')[0];
  
  return getAIContent([
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    },
    { text: prompt || "Analyze this image" }
  ]);
};

export const analyzeText = async (prompt: string) => {
  return getAIContent(prompt || "Tell me more about YouTube growth");
};

export const analyzeChannel = async (url: string) => {
  const prompt = `Analyze this YouTube channel: ${url}. 
  Find real, current data for: Name and Channel Description/Niche.
  
  Act as a YouTube Growth Expert and provide:
  1. Growth score (1-10)
  2. List of Strengths
  3. List of Weaknesses
  4. 3 "वायरल" (Viral) content ideas based on their niche
  5. Detailed advice on "क्या improve करना चाहिए" strictly in HINDI.

  Format your response AS A VALID JSON OBJECT ONLY with this structure:
  {
    "name": "string",
    "avatar": "string",
    "growthScore": number,
    "strengths": ["string"],
    "weaknesses": ["string"],
    "viralIdeas": ["string"],
    "improvementHindi": "string"
  }`;

  return getAIContent(prompt);
};

export const generateSubtitles = async (mediaData: string, language: string = 'English') => {
  const [meta, base64Data] = mediaData.split(',');
  const mimeType = meta.split(':')[1].split(';')[0];

  return getAIContent([
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    },
    {
      text: `Transcribe this media and generate professional SRT subtitles in ${language}. 
      Requirements:
      1. Accurate timestamps in [00:00:00,000 --> 00:00:00,000] format (Hours:Minutes:Seconds,Milliseconds).
      2. Strictly formatted as a professional .srt file.
      3. Break long sentences into readable subtitle blocks (max 2 lines per block).
      4. Do NOT include any markdown code blocks, backticks, or additional metadata. 
      5. Start directly with '1' and the first timestamp.
      6. Character limit per line: ~40 characters.
      
      Format Example:
      1
      00:00:01,000 --> 00:00:04,500
      This is an example of a subtitle line.
      
      2
      00:00:04,600 --> 00:00:08,000
      And this is the second block.

      Wait for the entire media to be processed and provide the full SRT content.`
    }
  ]);
};

export const transcribeAudio = async (mediaData: string) => {
  const [meta, base64Data] = mediaData.split(',');
  const mimeType = meta.split(':')[1].split(';')[0];
  
  return getAIContent([
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    },
    { text: "Transcribe this media content exactly. Be verbatim." }
  ]);
};
