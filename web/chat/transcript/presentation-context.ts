import { createContext } from "react";
import type { PresentationValue } from "./presentation-types.ts";
export const PresentationContext = createContext<PresentationValue | null>(null);
