import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { ToolLibrary } from "../../codemode/tool-library/assemble-tool-library.ts";
import type { PythonToolClient } from "../../kernel/kernel-types.ts";
import type { ToolLibraryRegistration } from "./registration-types.ts";
import { registerToolLibrary } from "./register-library.ts";

export function assembleToolLibraryPlugin(library: ToolLibrary | undefined, runtime: {
  readonly target: string;
  python(): PythonToolClient;
  sessionId(): string;
  allowed?(name: string): boolean;
  registered?(registration: ToolLibraryRegistration): void;
}): ExtensionFactory {
  return (pi) => {
    if (library) {
      const registration = registerToolLibrary(pi, library, runtime.target, runtime.python, runtime.sessionId, runtime.allowed);
      runtime.registered?.(registration);
    }
  };
}
