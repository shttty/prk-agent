

export class ExecutionTargetBusyError extends Error {
  constructor(name: string) {
    super(`Execution target ${JSON.stringify(name)} is bound to a nonclosed session.`);
    this.name = "ExecutionTargetBusyError";
  }
}
