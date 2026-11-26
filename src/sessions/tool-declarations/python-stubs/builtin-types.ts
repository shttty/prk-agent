import type { PythonType } from "./stub-types.ts";

export const ANY: PythonType = { kind: "name", text: "Any" };
export const NEVER: PythonType = { kind: "name", text: "Never" };
export const NONE: PythonType = { kind: "name", text: "None" };
