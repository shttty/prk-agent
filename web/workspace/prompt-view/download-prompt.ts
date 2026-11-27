/** Saves the request as the provider payload JSON, named after its place among the session's requests. */
export function downloadPrompt(seq: number, payload: unknown): void {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `prompt-request-${seq}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
