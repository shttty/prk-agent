export interface PythonDependency { name: string; version?: string; sha256?: string; filename?: string }
export interface ModuleDependencies { binaries?: string[]; python?: PythonDependency[] }
export type KernelModuleConfig = Record<string, Record<string, unknown>>;
export interface ModuleSource { source: string; path: string; package: boolean }
export interface ModulePayload {
  name: string; path: string; overridesBuiltin: boolean; dependencies: ModuleDependencies;
  sources: Record<string, ModuleSource>; error?: string;
}
