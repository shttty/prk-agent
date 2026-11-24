import { createContext } from "react";

// Only mutation controls need operation state; message bodies and markdown do not.
export const MessageActionState = createContext(null);
