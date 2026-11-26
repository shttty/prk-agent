import type { KernelHelper } from "../../../../codemode/module-catalog/catalog-types.ts";

import type { KernelLanguage } from "../../../../kernel/kernel-types.ts";

export interface KernelPromptInput {
  readonly helpers: readonly KernelHelper[];
  readonly toolLibrary: boolean;
  readonly autoTools: boolean;
  readonly kernelScoped?: boolean;
  readonly asyncExecution: boolean;
  /** kernel_read and kernel_interrupt are enabled; the kernel plugin group switch can turn them off. */
  readonly cellTools: boolean;
  readonly language?: KernelLanguage;
  /** Tool titles are on: kernel_code's title is required. */
  readonly titleRequired?: boolean;
  kernelCapabilities(name: string): boolean;
  binaryPrompt(): string | undefined;
}
