"use client";

import type { RecordingSegment } from "@/types/models";

export interface SegmentListProps {
  segments: RecordingSegment[];
  onRetry?: (segmentId: string) => Promise<void>;
}

export function SegmentList({ segments, onRetry }: SegmentListProps) {
  const ordered = [...segments].sort((a, b) => a.segmentIndex - b.segmentIndex);
  if (ordered.length === 0) return <p>No recordings yet.</p>;

  return (
    <ol>
      {ordered.map((segment) => (
        <li key={segment.id}>
          <span>
            Segment {segment.segmentIndex}: {segment.status}
          </span>
          {segment.status === "failed" && onRetry ? (
            <button type="button" onClick={() => void onRetry(segment.id)}>
              Retry
            </button>
          ) : null}
          {segment.errorMessage ? <p role="alert">{segment.errorMessage}</p> : null}
        </li>
      ))}
    </ol>
  );
}
