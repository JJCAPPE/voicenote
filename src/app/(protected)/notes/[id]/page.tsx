import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { getServerEnvValue } from "@/lib/env";
import { getNoteService } from "@/server/services/factories";

import { NoteWorkspace } from "./note-workspace";

const ParamsSchema = z.object({ id: z.uuid() });

export default async function NotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ record?: string }>;
}) {
  try {
    await requireSession();
  } catch {
    redirect("/login");
  }

  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();

  let note;
  try {
    note = await getNoteService().get(parsed.data.id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const workspaceKey = [
    note.updatedAt.toISOString(),
    note.jobs[0]?.id ?? "no-jobs",
    note.jobs[0]?.status ?? "none",
  ].join(":");
  const appHostname = new URL(getServerEnvValue("APP_URL")).hostname;
  return (
    <NoteWorkspace
      key={workspaceKey}
      initialDetail={note}
      autoStart={(await searchParams).record === "1"}
      enableTranscriptionSync={
        appHostname === "localhost" ||
        appHostname === "127.0.0.1" ||
        appHostname === "::1"
      }
    />
  );
}
