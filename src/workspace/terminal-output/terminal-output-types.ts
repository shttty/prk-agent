
export type Piece = { text: string; offset?: number; end?: number; hidden?: number };
/** A bounded capture has retained text on either side of this missing source span. */
export type OutputGap = { at: number; chars: number };
