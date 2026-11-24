import { Type } from "typebox";
import { textField } from "./create-text-schema.ts";

export const stepsSchema = (minItems: number, description?: string) => Type.Array(textField(2048), { minItems, maxItems: 32, ...(description ? { description } : {}) });
