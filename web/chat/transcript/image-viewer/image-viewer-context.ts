import { createContext } from "react";
/** Opens the lightbox on the image with this key; `opener` gets focus back when it closes. */
export const ImageViewerContext = createContext<((imageId: string, opener: HTMLElement) => void) | null>(null);
