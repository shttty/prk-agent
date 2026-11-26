/** Bring the pending ask (or other user prompt) into view and put focus on its first control. */
export function revealUserPrompt() {
  const prompt = document.querySelector('[data-prompt-kind="ask"]') || document.querySelector("[data-prompt-kind]");
  if (!prompt) return;
  prompt.scrollIntoView({ block: "nearest" });
  const control = prompt.querySelector("input:not(:disabled), button:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])");
  (control || prompt).focus({ preventScroll: true });
}
