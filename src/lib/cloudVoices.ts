// Free in-browser TTS via Puter.js (AWS Polly under the hood, no API key).
// https://docs.puter.com/AI/txt2speech/

import type { InterviewPersonality } from './interview-prompts';

export type CloudVoice = {
  id: string;
  displayName: string;
  flavour: string;
  options: Record<string, unknown>;
};

export const CLOUD_VOICES: CloudVoice[] = [
  {
    id: 'polly-joanna-neural',
    displayName: 'Joanna',
    flavour: 'Warm US female · neural',
    options: { voice: 'Joanna', engine: 'neural', language: 'en-US' },
  },
  {
    id: 'polly-matthew-neural',
    displayName: 'Matthew',
    flavour: 'Professional US male · neural',
    options: { voice: 'Matthew', engine: 'neural', language: 'en-US' },
  },
  {
    id: 'polly-ruth-generative',
    displayName: 'Ruth',
    flavour: 'Most natural US female · generative',
    options: { voice: 'Ruth', engine: 'generative', language: 'en-US' },
  },
];

export const DEFAULT_CLOUD_VOICE_ID = 'polly-joanna-neural';

export function findCloudVoice(id: string): CloudVoice {
  return (
    CLOUD_VOICES.find((v) => v.id === id) ??
    CLOUD_VOICES.find((v) => v.id === DEFAULT_CLOUD_VOICE_ID) ??
    CLOUD_VOICES[0]
  );
}

export function voiceForPersonality(personality: InterviewPersonality): CloudVoice {
  switch (personality) {
    case 'Strict':
      return findCloudVoice('polly-matthew-neural');
    case 'FAANG-style':
      return findCloudVoice('polly-ruth-generative');
    case 'Friendly':
    default:
      return findCloudVoice('polly-joanna-neural');
  }
}
