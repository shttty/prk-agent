/** An owned byte pipe; process transports release only their own environment lease. */
export interface TargetTransport {
  write(data: string): void;
  onData(listener: (data: string) => void): void;
  /** Fires once when the pipe ends, including our own close(). */
  onClose(listener: (reason: string) => void): void;
  close(): Promise<void>;
}
