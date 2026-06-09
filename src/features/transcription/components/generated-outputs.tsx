export type GeneratedOutputView = {
  id: string;
  outputType:
    | "summary"
    | "markdown_notes"
    | "action_items"
    | "decisions"
    | "topics";
  content: Record<string, unknown>;
  model: string;
  promptVersion: string;
  sourceRevision: number;
};

type GeneratedOutputsProps = {
  outputs: GeneratedOutputView[];
  currentRevision: number;
};

export function GeneratedOutputs({
  outputs,
  currentRevision,
}: GeneratedOutputsProps) {
  if (outputs.length === 0) {
    return <p>No AI-generated notes are available yet.</p>;
  }

  return (
    <section aria-labelledby="generated-note-outputs">
      <h2 id="generated-note-outputs">Generated notes</h2>
      {outputs.map((output) => (
        <article key={output.id}>
          <header>
            <h3>{outputLabel(output.outputType)}</h3>
            {output.sourceRevision !== currentRevision ? (
              <span>Out of date</span>
            ) : null}
          </header>
          <OutputContent output={output} />
          <small>
            {output.model} · {output.promptVersion}
          </small>
        </article>
      ))}
    </section>
  );
}

function OutputContent({ output }: { output: GeneratedOutputView }) {
  if (output.outputType === "summary") {
    return (
      <>
        <p>{String(output.content.shortSummary ?? "")}</p>
        <p>{String(output.content.longSummary ?? "")}</p>
      </>
    );
  }

  if (output.outputType === "markdown_notes") {
    return <pre>{String(output.content.markdown ?? "")}</pre>;
  }

  const values =
    output.outputType === "topics"
      ? output.content.topics
      : output.content.items;

  return (
    <pre>
      {JSON.stringify(Array.isArray(values) ? values : [], null, 2)}
    </pre>
  );
}

function outputLabel(outputType: GeneratedOutputView["outputType"]): string {
  return {
    summary: "Summary",
    markdown_notes: "Markdown notes",
    action_items: "Action items",
    decisions: "Decisions",
    topics: "Topics",
  }[outputType];
}
