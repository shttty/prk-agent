import { createContext } from "react";

/** Id of the message the transcript search is currently on. */
export const SearchMatchContext = createContext<string | null>(null);
