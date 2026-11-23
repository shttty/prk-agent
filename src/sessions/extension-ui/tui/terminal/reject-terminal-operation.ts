export const unsupportedTui = (name: string): never => {
  throw new Error(`Extension UI capability unavailable: ${name} requires a terminal TUI.`);
};
