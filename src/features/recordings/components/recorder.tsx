"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { SegmentUpload } from "@/server/services/recording.service";
import type { ActionResult, RecordingSegment } from "@/types/models";
import {
  chooseRecorderMimeType,
  formatRecordingTime,
} from "@/features/recordings/lib/recorder-utils";
import {
  hasOpenDialog,
  isTypingTarget,
} from "@/features/shortcuts/shortcuts";

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
  autoStart?: boolean;
  onUploaded?: (segment: RecordingSegment) => void;
  onStateChange?: (state: RecorderState) => void;
}

export type RecorderState = "idle" | "recording" | "uploading";

export type RecorderHandle = {
  toggle: () => void;
};

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

export const Recorder = forwardRef<RecorderHandle, RecorderProps>(function Recorder(
  {
    noteId,
    createSegment,
    confirmSegment,
    autoStart = false,
    onUploaded,
    onStateChange,
  },
  ref,
) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);
  const autoStartConsumedRef = useRef(false);
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const replacePreview = useCallback((url: string | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }, []);

  const updateState = useCallback(
    (nextState: RecorderState) => {
      setState(nextState);
      onStateChange?.(nextState);
    },
    [onStateChange],
  );

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

  const finishRecording = useCallback(
    async (mimeType: string) => {
      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - startedAtRef.current) / 1000),
      );
      const blob = new Blob(chunksRef.current, {
        type: mimeType || "audio/webm",
      });
      replacePreview(URL.createObjectURL(blob));
      updateState("uploading");
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
        updateState("idle");
        recorderRef.current = null;
        streamRef.current = null;
      }
    },
    [
      confirmSegment,
      createSegment,
      noteId,
      onUploaded,
      replacePreview,
      updateState,
    ],
  );

  const startRecording = useCallback(async () => {
    if (recorderRef.current || state !== "idle") return;
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
      startedAtRef.current = Date.now();
      setSeconds(0);
      updateState("recording");
      recorder.start();
    } catch {
      setError("Microphone access is required to record.");
    }
  }, [finishRecording, replacePreview, state, updateState]);

  const stopRecording = useCallback(() => {
    if (state !== "recording") return;
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [state]);

  const toggle = useCallback(() => {
    if (state === "idle") void startRecording();
    else if (state === "recording") stopRecording();
  }, [startRecording, state, stopRecording]);

  useImperativeHandle(ref, () => ({ toggle }), [toggle]);

  useEffect(() => {
    if (!autoStart || autoStartConsumedRef.current) return;
    autoStartConsumedRef.current = true;
    void startRecording().finally(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("record");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    });
  }, [autoStart, startRecording]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() !== "r" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        isTypingTarget(event.target) ||
        hasOpenDialog()
      ) {
        return;
      }
      event.preventDefault();
      toggle();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return (
    <section className="recorder" aria-label="Audio recorder">
      <button
        className="recorder-control"
        type="button"
        disabled={state === "uploading"}
        aria-label={state === "recording" ? "Stop recording" : "Start recording"}
        onClick={toggle}
      >
        <span data-recording={state === "recording"} />
      </button>
      <div className="recorder-readout">
        <p aria-live="polite">
          <span className="record-dot" data-active={state === "recording"} />
          {state === "recording"
            ? "Recording"
            : state === "uploading"
              ? "Uploading segment"
              : "Ready to record"}
        </p>
        <strong>{formatRecordingTime(seconds)}</strong>
      </div>
      <div className="waveform" aria-hidden="true" data-active={state === "recording"}>
        {Array.from({ length: 28 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className="recorder-action">
        {state === "uploading" ? (
          <progress value={progress} max={100}>
            {progress}%
          </progress>
        ) : (
          <>
            <span>{state === "recording" ? "Stop" : "Record"}</span>
            <kbd>R</kbd>
          </>
        )}
      </div>
      {previewUrl ? <audio controls src={previewUrl} /> : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
});
