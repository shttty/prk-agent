import type { Setter } from "./composer-types.ts";

export function resetExtensionIndex({ setExtensionIndex }: { setExtensionIndex: Setter<number> }) { setExtensionIndex(0); }
