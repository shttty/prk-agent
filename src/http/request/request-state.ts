import type { HttpOptions } from "../../config/http/http-options.ts";
import type { IncomingMessage } from "node:http";

export interface BodyContext {
  readonly http: HttpOptions;
  readonly request: IncomingMessage;
  readonly declaredLength: number | undefined;
  readonly chunks: Buffer[];
  size: number;
  settled: boolean;
  readonly resolve: (value: Buffer) => void;
  readonly reject: (error: unknown) => void;
  readonly onData: (chunk: Buffer | string) => void;
  readonly onEnd: () => void;
  readonly onAborted: () => void;
  readonly onError: () => void;
}
