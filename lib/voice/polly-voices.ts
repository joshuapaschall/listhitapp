export const POLLY_VOICES = [
  { id: "Danielle", label: "Danielle (Female)", engine: "long-form" },
  { id: "Joanna", label: "Joanna (Female)", engine: "neural" },
  { id: "Kendra", label: "Kendra (Female)", engine: "neural" },
  { id: "Ruth", label: "Ruth (Female)", engine: "neural" },
  { id: "Matthew", label: "Matthew (Male)", engine: "neural" },
  { id: "Joey", label: "Joey (Male)", engine: "neural" },
  { id: "Stephen", label: "Stephen (Male)", engine: "neural" },
  { id: "Gregory", label: "Gregory (Male)", engine: "long-form" },
] as const;

export const DEFAULT_VOICE_ID = "Joanna";

export type PollyVoice = (typeof POLLY_VOICES)[number];
