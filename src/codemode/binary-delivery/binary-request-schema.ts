import { Type } from "typebox";

/** Kernel callbacks resolve current metadata only; environment deployment owns all bytes. */
const target = {
  name: Type.String({ pattern: "^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$" }),
  system: Type.String(),
  machine: Type.String(),
};
export const binRequest = Type.Object(target, { additionalProperties: false });
