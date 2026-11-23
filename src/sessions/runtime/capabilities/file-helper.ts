import type { KernelHelper } from "../../../codemode/module-catalog/catalog-types.ts";

export function fileHelper(helperNames: KernelHelper[], name: string): boolean { return helperNames.some((helper) => helper.name === name); }
