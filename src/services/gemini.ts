import { GoogleGenAI, Modality } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
  return new GoogleGenAI({ apiKey });
};

export const generateVoice = async (text: string, characterId: string = 'narrator') => {
  const ai = getAI();
  
  // Map character IDs to prebuilt voices and descriptive styles
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
  
  const char = characters[characterId] || characters['narrator'];
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
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

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio ? `data:audio/mp3;base64,${base64Audio}` : null;
};

export const analyzeImage = async (imageBuffer: string, prompt: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: imageBuffer.split(',')[1], mimeType: "image/png" } },
        { text: prompt }
      ]
    }
  });
  return response.text;
};

export const analyzeText = async (prompt: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });
  return response.text;
};

export const analyzeChannel = async (url: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this YouTube channel: ${url}. 
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
    }`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json"
    }
  });
  return response.text;
};

export const generateSubtitles = async (audioBuffer: string, language: string = 'English') => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: audioBuffer.split(',')[1], mimeType: "audio/mp3" } },
        { text: `Generate professional SRT subtitles for this audio in ${language}. Include accurate timestamps and format it strictly as a valid .srt file. Do not include any other text.` }
      ]
    }
  });
  return response.text;
};

export const transcribeAudio = async (audioBuffer: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: audioBuffer.split(',')[1], mimeType: "audio/mp3" } },
        { text: "Transcribe this audio exactly. Provide timestamps if possible." }
      ]
    }
  });
  return response.text;
};
