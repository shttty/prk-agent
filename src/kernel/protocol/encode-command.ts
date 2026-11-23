export function encodeCommand(generation: string, id: number, payload: Record<string, unknown>): string {
  return JSON.stringify({ ...payload, generation, id }) + "\n";
}
