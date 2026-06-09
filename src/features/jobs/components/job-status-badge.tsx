import type { JobStatus } from "@/types/models";

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <span data-status={status}>{status}</span>;
}
