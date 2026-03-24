export interface TTSVoice {
  id: string;
  name: string;
  languageCode: string;
  ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  type: 'Neural2' | 'Studio' | 'Wavenet' | 'Standard';
}

export const GOOGLE_VOICES: TTSVoice[] = [
  { id: 'en-US-Neural2-A', name: 'James (Neural2)', languageCode: 'en-US', ssmlGender: 'MALE', type: 'Neural2' },
  { id: 'en-US-Neural2-C', name: 'Linda (Neural2)', languageCode: 'en-US', ssmlGender: 'FEMALE', type: 'Neural2' },
  { id: 'en-US-Neural2-D', name: 'Robert (Neural2)', languageCode: 'en-US', ssmlGender: 'MALE', type: 'Neural2' },
  { id: 'en-US-Neural2-E', name: 'Emily (Neural2)', languageCode: 'en-US', ssmlGender: 'FEMALE', type: 'Neural2' },
  { id: 'en-US-Studio-O', name: 'Sarah (Studio)', languageCode: 'en-US', ssmlGender: 'FEMALE', type: 'Studio' },
  { id: 'en-US-Studio-Q', name: 'Michael (Studio)', languageCode: 'en-US', ssmlGender: 'MALE', type: 'Studio' },
  { id: 'en-GB-Neural2-B', name: 'Oliver (UK Neural2)', languageCode: 'en-GB', ssmlGender: 'MALE', type: 'Neural2' },
  { id: 'en-GB-Neural2-C', name: 'Sophie (UK Neural2)', languageCode: 'en-GB', ssmlGender: 'FEMALE', type: 'Neural2' },
  { id: 'en-AU-Neural2-B', name: 'Jack (AU Neural2)', languageCode: 'en-AU', ssmlGender: 'MALE', type: 'Neural2' },
  { id: 'en-AU-Neural2-C', name: 'Mia (AU Neural2)', languageCode: 'en-AU', ssmlGender: 'FEMALE', type: 'Neural2' },
];

export const synthesizeSpeech = async (text: string, voice: TTSVoice) => {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voiceName: voice.id,
      languageCode: voice.languageCode,
      ssmlGender: voice.ssmlGender,
    }),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to synthesize speech';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      // If not JSON, use the status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return `data:audio/mp3;base64,${data.audioContent}`;
};