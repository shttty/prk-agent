import { createContext } from "react";
import type { EditorContextValue } from "./editor-types.ts";
export const EditorContext = createContext<EditorContextValue | null>(null);
