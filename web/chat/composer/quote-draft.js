/** The composer draft after quoting `text`: each line as a Markdown quote (`> `), after the current draft with a blank
 * line between. Used by the reply menu's 引用 and the terminal's 引用到输入框. */
export function quoteDraft(current, text) {
  const quoted = text.replace(/\n+$/u, "").split("\n").map((line) => `> ${line}`).join("\n");
  return current ? `${current}\n\n${quoted}\n` : `${quoted}\n`;
}
