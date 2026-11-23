export interface MemoryContext {
  scope: string;
  publish(memory: object): void;
  baseline: number | undefined;
  stopped: boolean;
  timer: NodeJS.Timeout | undefined;
  stop(publishFinal?: boolean): void;
}
