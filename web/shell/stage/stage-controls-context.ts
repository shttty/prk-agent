import type { ReactNode } from "react";
import { createContext } from "react";
import type { StageControlsHost } from "./stage-types.ts";

/** The stage's buttons and the place they render in right now; the corner group's tab row reads it (CornerActions). */
export const StageControlsContext = createContext<{ host: StageControlsHost; controls: ReactNode } | null>(null);
