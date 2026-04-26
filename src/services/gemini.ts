const callAI = async (type: string, data: unknown, options: Record<string, unknown> = {}) => {
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, data, options })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "AI processing failed");
  }

  const result = await response.json();
  return result.text;
};

export const generateVoice = async (text: string, characterId: string = 'narrator_m') => {
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: 'voice', data: { text, characterId } })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Voice generation failed");
  }

  const result = await response.json();
  return result.audio;
};

export const analyzeImage = async (imageBuffer: string, prompt: string) => {
  return callAI('analyze-image', imageBuffer, { prompt });
};

export const analyzeText = async (prompt: string) => {
  return callAI('analyze-text', prompt);
};

export const analyzeChannel = async (url: string) => {
  return callAI('analyze-channel', url);
};

export const generateSubtitles = async (audioBuffer: string, language: string = 'English') => {
  return callAI('subtitles', audioBuffer, { language });
};

export const transcribeAudio = async (audioBuffer: string) => {
  return callAI('transcribe', audioBuffer);
};
