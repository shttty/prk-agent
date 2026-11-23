import type { ArtifactPlatform } from "../../artifacts/store/store-types.ts";

export const ARCH: Readonly<Record<string, ArtifactPlatform>> = { x86_64: "x86_64", amd64: "x86_64", aarch64: "aarch64", arm64: "aarch64" };
