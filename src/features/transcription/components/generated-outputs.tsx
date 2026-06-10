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
    return (
      <div className="ai-empty-state">
        <h2>AI notes will appear here.</h2>
        <p>Record or add a transcript, then generate structured notes.</p>
      </div>
    );
  }

  return (
    <section className="ai-notes-document" aria-labelledby="generated-note-outputs">
      <h2 className="sr-only" id="generated-note-outputs">Generated notes</h2>
      {outputs.map((output) => (
        <article key={output.id}>
          <header>
            <h3>{outputLabel(output.outputType)}</h3>
            {output.sourceRevision !== currentRevision ? (
              <span>Out of date</span>
            ) : null}
          </header>
          <OutputContent output={output} />
          <small className="output-provenance">
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
    return <p className="markdown-output">{String(output.content.markdown ?? "")}</p>;
  }

  const values =
    output.outputType === "topics"
      ? output.content.topics
      : output.content.items;

  if (!Array.isArray(values) || values.length === 0) {
    return <p className="muted">None identified.</p>;
  }

  return (
    <ul className="generated-list">
      {values.map((value, index) => (
        <li key={index}>
          {typeof value === "string"
            ? value
            : output.outputType === "decisions"
              ? String((value as { decision?: unknown }).decision ?? "")
              : String((value as { task?: unknown }).task ?? "")}
        </li>
      ))}
    </ul>
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
