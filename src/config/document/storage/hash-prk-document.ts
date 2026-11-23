import { createHash } from "node:crypto";

export const documentHash = (raw: string | undefined): string =>
  raw === undefined ? "" : createHash("sha256").update(raw).digest("hex");
