/* eslint-disable @typescript-eslint/no-explicit-any */
const callAI = async (type: string, data: unknown, options: Record<string, unknown> = {}) => {
  try {
    const targetUrl = "/api/ai/generate";
    console.log(`[AI Request] Calling: ${targetUrl} for ${type}`);
    
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ type, data, options })
    });

    const contentType = response.headers.get("content-type");
    
    if (!response.ok) {
      let errorMessage = `AI Request Failed (${response.status} ${response.statusText})`;
      try {
        if (contentType && contentType.includes("application/json")) {
          const err = await response.json();
          const rawError = err.error || err.message || err;
          errorMessage = typeof rawError === 'string' ? rawError : JSON.stringify(rawError);
        } else {
          const text = await response.text();
          errorMessage = `Server Error (${response.status}): ${text.slice(0, 200)}`;
        }
      } catch {
        errorMessage = `Failed to parse error response: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Non-JSON response from AI API:", text.slice(0, 200));
      throw new Error("Received invalid response format from server. Please try again.");
    }

    const result = await response.json();
    return result.text;
  } catch (err: any) {
    console.error("CallAI Error:", err);
    throw err;
  }
};

export const generateVoice = async (text: string, characterId: string = 'narrator_m') => {
  try {
    const targetUrl = "/api/ai/generate";
    console.log(`[Voice AI] Calling: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ type: 'voice', data: { text, characterId } })
    });
  
    const contentType = response.headers.get("content-type");
  
    if (!response.ok) {
      let errorMessage = "Voice generation failed";
      if (contentType && contentType.includes("application/json")) {
        const err = await response.json();
        const rawError = err.error || err.message || err;
        errorMessage = typeof rawError === 'string' ? rawError : JSON.stringify(rawError);
      } else {
        const text = await response.text();
        errorMessage = `Server Error (${response.status}): ${text.slice(0, 50)}...`;
      }
      throw new Error(errorMessage);
    }
  
    const result = await response.json();
    return result.audio;
  } catch (err: any) {
    console.error("GenerateVoice Error:", err);
    throw err;
  }
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
