export interface CapturedImage { readonly mimeType: string; readonly data: string }
export type CapturedOutput = { text: string; tail: string; omittedChars: number; truncated: boolean };
