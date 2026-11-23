export interface TraceOptions {
  readonly maxRecords: number;
  readonly argumentChars: number;
  readonly maxArguments: number;
}

export const DEFAULT_TRACE_OPTIONS: TraceOptions = Object.freeze({
  maxRecords: 128,
  argumentChars: 300,
  maxArguments: 4,
});
