import type { ArtifactPlatform } from "../../../artifacts/store/store-types.ts";

export function nativePlatform(): ArtifactPlatform {
  if (process.platform === "linux" && process.arch === "x64") return "x86_64";
  if (process.platform === "linux" && process.arch === "arm64") return "aarch64";
  throw new Error("Remote extension bundles support Linux x86_64/aarch64 only.");
}
