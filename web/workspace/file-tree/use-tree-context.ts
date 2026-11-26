import { useContext } from "react";
import { TreeContext } from "./tree-context.ts";

export function useTreeContext() {
  const value = useContext(TreeContext);
  if (!value) throw new Error("A file row renders only inside a file tree.");
  return value;
}
