import { Type } from "typebox";
import { textField } from "./create-text-schema.ts";

export const stepsSchema = (minItems: number, description: string) => Type.Array(textField(2048, "One concrete item; 1–2048 characters, not blank."), { minItems, maxItems: 32, description });
