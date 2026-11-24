import { Type } from "typebox";
import { CELL_MODES } from "../kernel-options.ts";

const shared = {
  title: Type.Optional(Type.String()),
  reset: Type.Optional(Type.Boolean({ description: "Restart first, clearing vars ('' restarts only)" })),
  yield_s: Type.Optional(Type.Number({ description: "Wait seconds (0 immediate)" })),
};

export const bunParameters = Type.Object({ code: Type.String(), ...shared }, { additionalProperties: false });

export const pythonParameters = Type.Object({
  code: Type.String(), ...shared,
  mode: Type.Optional(Type.Union(CELL_MODES.map((mode) => Type.Literal(mode)))),
  inputs: Type.Optional(Type.Array(Type.String())),
  outputs: Type.Optional(Type.String()),
}, { additionalProperties: false });
