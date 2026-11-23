export class ArtifactError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ArtifactError";
    this.status = status;
  }
}
