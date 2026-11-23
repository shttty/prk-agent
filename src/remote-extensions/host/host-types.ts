import type { Socket } from "node:net";
import type { Interface } from "node:readline";

export interface GenerationOwner {
  id: string;
  phase: "loading" | "active" | "closing" | "closed";
  snapshot: object | undefined;
  tools: Map<string, object>;
  toolNames: Set<string>;
  handlers: Map<string, object>;
  commands: object[];
  commandHandlers: Map<string, Function>;
  commandsInFlight: Map<AbortController, Promise<object>>;
  nativeDefinitions: Set<object>;
  events: object;
  packages: object[];
  providerOwnerIds: Set<string>;
  sessionManager?: object;
  projectRunner?: object;
}

export interface HostContext {
  reverse: Map<string, object>;
  active: Map<string, object>;
  incoming: Set<string>;
  warned: Set<string>;
  sequence: number;
  generation: GenerationOwner | undefined;
  loadAttempted: boolean;
  shutdownPromise: Promise<object> | undefined;
  memoryTelemetry: { stop(publishFinal?: boolean): void } | undefined;
  connected: boolean;
  socket: Socket | undefined;
  lines: Interface | undefined;
  sourceDirectory: string;
  sourceUrl: string;
  assertLive: Function;
  assertRunning: Function;
  facade: Function;
  warning: Function;
  uiContext: Function;
  reverseRequest: Function;
  disconnect: Function;
}
