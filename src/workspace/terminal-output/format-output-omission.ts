
export function outputOmission(chars: number, offset?: number, commandId?: string): string {
  return ` …[+${chars} chars${offset !== undefined && commandId !== undefined ? `, terminal_read(command=${JSON.stringify(commandId)}, offset=${offset})` : ""}]… `;
}
