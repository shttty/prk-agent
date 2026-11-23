export function renderAsk(callable: readonly string[]): string {
  return callable.includes("ask") ? "To ask the user to choose or confirm, call gateway.ask(questions=[{id, question, options:[{label, description?}], recommended?, multi?}]) in a cell: recommended is the 0-based integer index into options (0 = first, never the label text) and multi a boolean. The cell waits for the answer as text; gateway.describe('ask') has the schema." : "";
}
