import { useContext } from "react";
import { TerminalContext } from "./terminal-context.ts";

export function useTerminalContext() {
  const value = useContext(TerminalContext);
  if (!value) throw new Error("A terminal tab renders only inside a workspace dock.");
  return value;
}
