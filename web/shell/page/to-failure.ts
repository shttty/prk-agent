import type { ApiFailure } from "./page-types.ts";

/** A caught value as the backend's failure shape (the /api client rejects with an Error carrying `code`, `status`, `details`). */
export const toFailure = (error: unknown): ApiFailure => (error instanceof Error ? error : { message: String(error) });
