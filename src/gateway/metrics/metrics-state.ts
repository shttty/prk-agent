export interface MetricsState {
  /** Stops the event-loop sampler and unbinds the session gauge. */
  close(): void;
}
