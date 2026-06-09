export const PREFERRED_AUDIO_TYPES = [
  "audio/webm;codecs=opus",
  "audio/mp4",
] as const;

export interface MediaRecorderSupport {
  isTypeSupported(type: string): boolean;
}

export function chooseRecorderMimeType(
  mediaRecorder: MediaRecorderSupport,
): string | undefined {
  return PREFERRED_AUDIO_TYPES.find((type) =>
    mediaRecorder.isTypeSupported(type),
  );
}

export function formatRecordingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}
