import { WireError } from "../../gateway/wire/create-error.ts";

/**
 * google-shared as patched by scripts/patch-pi.mjs. The shipped .d.ts predates these values
 * (it types finish reasons as the @google/genai enum and excludes xhigh), so the probe
 * describes the patched contract instead.
 */
type PatchedGoogleShared = {
  resolveGoogleThinkingLevel(model: { provider: string; id: string; thinkingLevelMap: { xhigh: string } }, level: "xhigh"): string;
  toGoogleThinkingLevel(level: string): string;
  toGoogleSdkThinkingLevel(level: string): string;
  mapStopReason(reason: string): string;
};

/**
 * Refuse to run if the TEMPORARY Google patches in scripts/patch-pi.mjs were skipped.
 * Imported dynamically for the same reason as assertPrkBrand: the SDK must load only after initializePrkHome().
 */
export async function assertGooglePatches(): Promise<void> {
  const shared = (await import("@earendil-works/pi-ai/api/google-shared")) as unknown as PatchedGoogleShared;
  if (!googlePatchesApplied(shared)) {
    throw new WireError("CLI_ERROR", "Pi SDK Google patches (xhigh thinking level, newer finish reasons) are not applied; run: node scripts/patch-pi.mjs");
  }
}

function googlePatchesApplied(shared: PatchedGoogleShared): boolean {
  const probe = { provider: "prk", id: "patch-probe", thinkingLevelMap: { xhigh: "xhigh" } };
  try {
    const xhigh = shared.toGoogleSdkThinkingLevel(shared.toGoogleThinkingLevel(shared.resolveGoogleThinkingLevel(probe, "xhigh")));
    return xhigh === "XHIGH"
      && shared.mapStopReason("MALFORMED_RESPONSE") === "error";
  }
  catch {
    return false;
  }
}
