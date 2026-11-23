import { Type } from "typebox";
import { CELL_MODES } from "../kernel-options.ts";

const shared = {
  title: Type.Optional(Type.String({ description: "Short cell title." })),
  reset: Type.Optional(Type.Boolean({ description: "Retire this kernel before running code, stopping all its cells and discarding all variables. Use empty code to restart only." })),
  yield_s: Type.Optional(Type.Number({ description: "Seconds to wait when yielding is enabled; 0 returns immediately. Omit for the configured default. Ignored when yielding is disabled." })),
};

export const bunParameters = Type.Object({ code: Type.String({ description: "JavaScript or TypeScript cell body." }), ...shared }, { additionalProperties: false });

export const pythonParameters = Type.Object({
  code: Type.String({ description: "Python code to execute in the retained kernel." }), ...shared,
  mode: Type.Optional(Type.Union(CELL_MODES.map((mode) => Type.Literal(mode)), {
    description: "Optional cell execution mode (thread, async, isolated). Does not control foreground waiting.",
  })),
  inputs: Type.Optional(Type.Array(Type.String(), { description: "Isolated execution only: names of existing Python variables to copy into the cell." })),
  outputs: Type.Optional(Type.String({ description: "Isolated execution only: Python variable name to bind to the cell's return value on success." })),
}, { additionalProperties: false });
