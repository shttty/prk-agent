import { useSyncExternalStore } from "react";
import { useEditorContext } from "./use-editor-context.ts";

export function useFile(path: string) {
  const { store } = useEditorContext();
  return [store, useSyncExternalStore(store.subscribe, () => store.get(path))] as const;
}
