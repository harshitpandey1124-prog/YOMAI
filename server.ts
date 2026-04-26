import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ limit: '200mb', extended: true }));

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
