import { useContext } from "react";
import { useSyncExternalStore } from "react";
import { EditorContext } from "./editor-context.js";
export function useFile(path) {
  const { store } = useContext(EditorContext);
  return [store, useSyncExternalStore(store.subscribe, () => store.get(path))];
}
