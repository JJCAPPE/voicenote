"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SegmentUpload } from "@/server/services/recording.service";
import type { ActionResult, RecordingSegment } from "@/types/models";
import {
  chooseRecorderMimeType,
  formatRecordingTime,
} from "@/features/recordings/lib/recorder-utils";

type CreateSegment = (input: {
  noteId: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds: number;
}) => Promise<ActionResult<SegmentUpload>>;
type ConfirmSegment = (input: {
  segmentId: string;
}) => Promise<ActionResult<RecordingSegment>>;

export interface RecorderProps {
  noteId: string;
  createSegment: CreateSegment;
  confirmSegment: ConfirmSegment;
  onUploaded?: (segment: RecordingSegment) => void;
}

function uploadBlob(
  signedUrl: string,
  blob: Blob,
  onProgress: (value: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("Audio upload failed."));
    };
    request.onerror = () => reject(new Error("Audio upload failed."));
    const formData = new FormData();
    formData.append("cacheControl", "3600");
    formData.append("", blob);
    request.send(formData);
  });
}

export function Recorder({
  noteId,
  createSegment,
  confirmSegment,
  onUploaded,
}: RecorderProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);
  const [state, setState] = useState<"idle" | "recording" | "uploading">("idle");
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const replacePreview = useCallback((url: string | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }, []);

  useEffect(() => {
    if (state !== "recording") return;
    const timer = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (state === "idle") return;
    const preventLoss = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [state]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  async function startRecording() {
    setError(null);
    replacePreview(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = chooseRecorderMimeType(MediaRecorder);
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => void finishRecording(recorder.mimeType);
      streamRef.current = stream;
      recorderRef.current = recorder;
      // Timing starts only after permission is granted and the recorder exists.
      // eslint-disable-next-line react-hooks/purity
      startedAtRef.current = Date.now();
      setSeconds(0);
      setState("recording");
      recorder.start();
    } catch {
      setError("Microphone access is required to record.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }

  async function finishRecording(mimeType: string) {
    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - startedAtRef.current) / 1000),
    );
    const blob = new Blob(chunksRef.current, {
      type: mimeType || "audio/webm",
    });
    replacePreview(URL.createObjectURL(blob));
    setState("uploading");
    setProgress(0);

    try {
      const created = await createSegment({
        noteId,
        filename: `recording-${new Date().toISOString()}`,
        mimeType: blob.type,
        fileSizeBytes: blob.size,
        durationSeconds,
      });
      if (!created.ok) throw new Error(created.error);
      await uploadBlob(created.data.upload.signedUrl, blob, setProgress);
      const confirmed = await confirmSegment({
        segmentId: created.data.segment.id,
      });
      if (!confirmed.ok) throw new Error(confirmed.error);
      setProgress(100);
      onUploaded?.(confirmed.data);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed.",
      );
    } finally {
      setState("idle");
      recorderRef.current = null;
      streamRef.current = null;
    }
  }

  return (
    <section aria-label="Audio recorder">
      <p aria-live="polite">
        {state === "recording" ? "Recording" : state === "uploading" ? "Uploading" : "Ready"}{" "}
        {formatRecordingTime(seconds)}
      </p>
      {state === "idle" ? (
        <button type="button" onClick={startRecording}>
          Start recording
        </button>
      ) : state === "recording" ? (
        <button type="button" onClick={stopRecording}>
          Stop recording
        </button>
      ) : (
        <progress value={progress} max={100}>
          {progress}%
        </progress>
      )}
      {previewUrl ? <audio controls src={previewUrl} /> : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
