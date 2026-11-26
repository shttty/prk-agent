import { useContext } from "react";
import { EditorContext } from "./editor-context.ts";

export function useEditorContext() {
  const value = useContext(EditorContext);
  if (!value) throw new Error("A file tab renders only inside a workspace dock.");
  return value;
}
