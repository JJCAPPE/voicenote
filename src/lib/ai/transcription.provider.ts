export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker: string | null;
}

export interface TranscriptUtterance {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker: string;
  words: TranscriptWord[];
}

export interface RawTranscript {
  text: string;
  language: string | null;
  durationSeconds: number | null;
  utterances: TranscriptUtterance[];
  words: TranscriptWord[];
  providerPayload: unknown;
}

export interface SubmitAudioInput {
  audioUrl: string;
  webhookUrl: string;
  webhookSecret: string;
}

export interface TranscriptionProvider {
  submitAudio(input: SubmitAudioInput): Promise<{ externalJobId: string }>;
  getTranscript(externalJobId: string): Promise<RawTranscript>;
}
