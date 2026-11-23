import { Type } from "typebox";

export const kernelCapabilityRequest = Type.Object({ name: Type.String({ minLength: 1, maxLength: 256 }) }, { additionalProperties: false });
