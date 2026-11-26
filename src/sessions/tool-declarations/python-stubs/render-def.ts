import type { ParameterLine } from "./render-parameters.ts";

const STUB_WIDTH = 100;

/** The def line of a stub, like the kernel's own: one line when it fits in 100 columns and no parameter has a comment, else one parameter per line. */
export function renderDef(name: string, parameters: readonly ParameterLine[], returns: string, docstring: string): string {
  const oneLine = `def ${name}(${parameters.map(({ text }) => text).join(", ")}) -> ${returns}:`;
  const head = parameters.some(({ comments }) => comments.length > 0) || oneLine.length > STUB_WIDTH
    ? `def ${name}(\n${parameters.map(({ comments, text }) => [...comments.map((line) => `    # ${line}`), `    ${text},`].join("\n")).join("\n")}\n) -> ${returns}:`
    : oneLine;
  return `${head}\n${docstring}`;
}
