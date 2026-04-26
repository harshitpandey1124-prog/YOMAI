/* eslint-disable @typescript-eslint/no-explicit-any */
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Request logger
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[API Request]: ${req.method} ${req.url}`);
    }
    next();
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Gemini AI Proxy
  app.get("/api/ai/generate", (req, res) => {
    res.json({ message: "Gemini API Proxy is alive. Use POST to generate." });
  });

  app.post("/api/ai/generate", async (req, res) => {
    const { type, data, options } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing on server" });
    }

    try {
      const client = new GoogleGenAI({ apiKey } as any);
      const model = (client as any).getGenerativeModel({ model: "gemini-1.5-flash" });

      const getAIContent = async (reqContent: unknown) => {
        const result = await (model as any).generateContent(reqContent);
        const response = result.response;
        try {
          return response.text();
        } catch (error) {
          console.error("Gemini Response Error:", JSON.stringify(response, null, 2));
          if (response.candidates?.[0]?.finishReason === 'SAFETY') {
            throw new Error("Content flagged by safety filters. Please ensure your media is compliant.", { cause: error });
          }
          throw new Error("AI failed to generate a text response. Please try again.", { cause: error });
        }
      };

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
        
        const voiceModel = (client as any).getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await voiceModel.generateContent({
          contents: [{ parts: [{ text: `Say this as a ${char.style}: ${text}` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: char.voice },
              },
            },
          },
        } as any);

        const base64Audio = result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return res.json({ audio: base64Audio ? `data:audio/mp3;base64,${base64Audio}` : null });
      }

      if (type === 'subtitles') {
        const [meta, base64Data] = data.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];
        const language = options?.language || 'English';

        const text = await getAIContent([
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          {
            text: `Transcribe this media and generate professional SRT subtitles in ${language}. 
            Requirements:
            1. Accurate timestamps in [HH:MM:SS,mmm --> HH:MM:SS,mmm] format.
            2. Strictly formatted as a valid .srt file.
            3. Break long sentences into readable subtitle blocks.
            4. Do NOT include any markdown code blocks, metadata, or additional text. 
            5. Start directly with '1' and the first timestamp.
            
            Safety: Ensure the transcription is verbatim and objective.`
          }
        ]);
        
        return res.json({ text });
      }

      if (type === 'transcribe') {
        const [meta, base64Data] = data.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];
        const text = await getAIContent([
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          { text: "Transcribe this media content exactly. Be verbatim." }
        ]);
        return res.json({ text });
      }

      if (type === 'analyze-channel') {
        const text = await getAIContent([
          {
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
          }
        ]);
        return res.json({ text });
      }

      if (type === 'analyze-text') {
        const text = await getAIContent(data || "Tell me more about YouTube growth");
        return res.json({ text });
      }

      if (type === 'analyze-image') {
        const [meta, base64Data] = data.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];
        const text = await getAIContent([
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          { text: options?.prompt || "Analyze this image" }
        ]);
        return res.json({ text });
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

  // API 404 handler
  app.all("/api/*", (req, res) => {
    console.warn(`[API 404]: ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: "API endpoint not found", 
      path: req.url,
      method: req.method
    });
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
