import { WireError } from "../../gateway/wire/create-error.ts";

export const invalid = (message: string): never => { throw new WireError("INVALID_REQUEST", message); };
