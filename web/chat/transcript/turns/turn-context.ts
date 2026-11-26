import { createContext } from "react";
import type { TranscriptMessage } from "../../conversation/conversation-types.ts";
export const TurnContext = createContext<TranscriptMessage | null>(null);
