import { createContext } from "react";
import type { TreeContextValue } from "./tree-types.ts";
export const TreeContext = createContext<TreeContextValue | null>(null);
