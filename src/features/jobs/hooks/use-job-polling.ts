"use client";

import { useEffect, useState } from "react";
import type { Job } from "@/types/models";

export function useJobPolling(
  jobId: string | null,
  intervalMs = 2000,
): { job: Job | null; error: string | null } {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timeout: number | undefined;

    async function poll() {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) throw new Error("Could not load job status.");
        const next = (await response.json()) as Job;
        if (cancelled) return;
        setJob(next);
        if (next.status === "queued" || next.status === "processing") {
          timeout = window.setTimeout(poll, intervalMs);
        }
      } catch (pollError) {
        if (!cancelled) {
          setError(
            pollError instanceof Error ? pollError.message : "Polling failed.",
          );
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [intervalMs, jobId]);

  return { job, error };
}
