import { useSyncExternalStore } from "react";
import { layout } from "./layout-store.js";
export const useLayout = () => useSyncExternalStore(layout.subscribe, layout.get);

