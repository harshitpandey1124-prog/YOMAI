import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Gemini AI Proxy
  app.post("/api/ai/generate", async (req, res) => {
    const { type, data, options } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing on server" });
    }

    try {
      const { GoogleGenAI, Modality } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      if (type === 'voice') {
        const { text, characterId } = data;
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
        
        const char = characters[characterId] || characters['narrator_m'];
        
        const result = await ai.models.generateContent({
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
        } as Parameters<typeof ai.models.generateContent>[0]);

        const base64Audio = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return res.json({ audio: base64Audio ? `data:audio/mp3;base64,${base64Audio}` : null });
      }

      if (type === 'subtitles') {
        const [meta, base64Data] = data.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];
        const language = options?.language || 'English';

        try {
          const result = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{
              parts: [
                { inlineData: { data: base64Data, mimeType: mimeType } },
                { text: `Transcribe this media and generate professional SRT subtitles in ${language}. 
                Requirements:
                1. Accurate timestamps in [HH:MM:SS,mmm --> HH:MM:SS,mmm] format.
                2. Strictly formatted as a valid .srt file.
                3. Break long sentences into readable subtitle blocks.
                4. Do NOT include any markdown code blocks, metadata, or additional text. 
                5. Start directly with '1' and the first timestamp.
                
                Safety: Ensure the transcription is verbatim and objective based on the provided audio.` }
              ]
            }]
          });
          return res.json({ text: result.text });
        } catch (mediaErr: any) {
          console.error("Gemini Media Error:", mediaErr);
          // Special handling for common media issues
          if (mediaErr.message?.includes("Safety")) {
            throw new Error("AI refused to transcribe this content due to safety filters. Please ensure the media doesn't violate terms.");
          }
          throw mediaErr;
        }
      }

      if (type === 'transcribe') {
        const [meta, base64Data] = data.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];

        const result = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [{
            parts: [
              { inlineData: { data: base64Data, mimeType: mimeType } },
              { text: "Transcribe this audio exactly. Provide timestamps if possible." }
            ]
          }]
        });
        return res.json({ text: result.text });
      }

      if (type === 'analyze-image') {
        const [meta, base64Data] = data.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];
        const prompt = options?.prompt || "Analyze this image";

        const result = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [{
            parts: [
              { inlineData: { data: base64Data, mimeType: mimeType } },
              { text: prompt }
            ]
          }]
        });
        return res.json({ text: result.text });
      }

      if (type === 'analyze-text') {
        const result = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: data
        });
        return res.json({ text: result.text });
      }

      if (type === 'analyze-channel') {
        const result = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [{
            text: `Analyze this YouTube channel: ${data}. 
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
            }`
          }],
          config: {
            responseMimeType: "application/json"
          }
        });
        return res.json({ text: result.text });
      }

      res.status(400).json({ error: "Invalid AI type" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to process AI request";
      console.error("AI Proxy Error:", message);
      res.status(500).json({ error: message });
    }
  });

  // Google Cloud Text-to-Speech Proxy
  app.post("/api/tts", async (req, res) => {
    const { text, voiceName, languageCode, ssmlGender } = req.body;
    const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;

    try {
      let audioContent = "";
      
      // Try official Google Cloud TTS first if API key exists
      if (apiKey) {
        const response = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: { text },
              voice: { languageCode, name: voiceName, ssmlGender },
              audioConfig: { audioEncoding: "MP3" },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          audioContent = data.audioContent;
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.warn("Official TTS failed, attempting fallback:", errorData.error?.message || response.statusText);
        }
      }

      // Fallback to unofficial Translate TTS if official failed or no key
      if (!audioContent) {
        console.log("Using Translate TTS fallback...");
        // Translate TTS has a limit of ~200 characters per request.
        const maxLength = 200;
        const textChunks = [];
        for (let i = 0; i < text.length; i += maxLength) {
          textChunks.push(text.substring(i, i + maxLength));
        }

        const audioBuffers = [];
        for (const chunk of textChunks) {
          const encodedChunk = encodeURIComponent(chunk);
          const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedChunk}&tl=${languageCode.split('-')[0]}&client=tw-ob`;
          const fallbackResponse = await fetch(fallbackUrl);
          
          if (fallbackResponse.ok) {
            audioBuffers.push(await fallbackResponse.arrayBuffer());
          }
        }

        if (audioBuffers.length > 0) {
          // Merge buffers (simplified: just concat)
          const totalLength = audioBuffers.reduce((acc, curr) => acc + curr.byteLength, 0);
          const combinedBuffer = new Uint8Array(totalLength);
          let offset = 0;
          for (const buffer of audioBuffers) {
            combinedBuffer.set(new Uint8Array(buffer), offset);
            offset += buffer.byteLength;
          }
          audioContent = Buffer.from(combinedBuffer).toString('base64');
        } else {
          throw new Error("Both official and fallback TTS failed.");
        }
      }

      res.json({ audioContent });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Internal Server Error";
      console.error("TTS Proxy Error:", message);
      res.status(500).json({ error: message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
