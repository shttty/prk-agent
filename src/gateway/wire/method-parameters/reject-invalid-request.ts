import { WireError } from "../create-error.ts";

export const invalid = () => { throw new WireError("INVALID_REQUEST", "Invalid v1 request envelope or method parameters."); };
