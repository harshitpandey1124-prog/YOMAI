import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Google Cloud Text-to-Speech Proxy
  app.post("/api/tts", async (req, res) => {
    const { text, voiceName, languageCode, ssmlGender } = req.body;
    const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GOOGLE_CLOUD_TTS_API_KEY is not configured in environment variables." });
    }

    try {
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

      if (!response.ok) {
        let message = "Failed to synthesize speech";
        try {
          const errorData = await response.json();
          message = errorData.error?.message || message;
        } catch {
          message = response.statusText || message;
        }
        
        // Detect "API not enabled" error and provide a clear instruction
        if (message.includes("Cloud Text-to-Speech API has not been used") || message.includes("disabled")) {
          throw new Error(`Google Cloud Text-to-Speech API is not enabled. Please enable it here: https://console.cloud.google.com/apis/library/texttospeech.googleapis.com`);
        }
        
        throw new Error(message);
      }

      const data = await response.json();
      res.json({ audioContent: data.audioContent });
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
