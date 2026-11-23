export interface ProcessWindowLimits {
  readonly maxRequests: number;
  readonly maxBytes: number;
  readonly maxFrameBytes: number;
}
export const CONTROL_CONSUMED = Symbol("process control consumed");

export interface ProcessWindow<Control extends string = never> {
  reserve(id: number, bytes: number, control?: Control): void;
  waitForControl(control: Control, signal: AbortSignal): Promise<void> | undefined;
  confirm(id: number): void;
  retire(reason?: unknown): void;
  snapshot(): { requests: number; bytes: number };
}
interface ControlSlot {
  readonly maxBytes: number;
  bytes: number;
  receipt?: AbortController;
}
export interface ProcessWindowState {
  readonly ordinaryLimits: ProcessWindowLimits;
  readonly controls?: Map<string, ControlSlot>;
  readonly pending: Map<number, number | ControlSlot>;
  ordinaryRequests: number;
  ordinaryBytes: number;
  retired: boolean;
}
