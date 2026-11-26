import { useSyncExternalStore } from "react";
import { layout } from "./layout-store.ts";
export const useLayout = () => useSyncExternalStore(layout.subscribe, layout.get);

