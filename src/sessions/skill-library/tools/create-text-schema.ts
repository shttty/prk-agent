import { Type } from "typebox";

export const textField = (maxLength: number, description: string) => Type.String({ minLength: 1, maxLength, pattern: "\\S", description });
