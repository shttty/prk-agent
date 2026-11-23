import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import { HttpError } from "../request/create-error.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";

export function parseKernelResultQuery(limits: LimitsOptions, url: URL, sessionId: string): { cellId: string; imageIndex?: number } {
  const query = url.searchParams;
  if ([...query.keys()].some((key) => key !== "cellId" && key !== "imageIndex")
    || query.getAll("cellId").length !== 1 || query.getAll("imageIndex").length > 1) {
    throw new HttpError(400, "Kernel result requires one cellId and an optional imageIndex query parameter.");
  }
  const index = query.get("imageIndex");
  if (index !== null && (!/^[1-9][0-9]{0,9}$/u.test(index) || Number(index) > 2_147_483_647)) {
    throw new HttpError(400, "imageIndex must be an integer from 1 to 2147483647.");
  }
  return nativeRequest(limits, { cellId: query.get("cellId"), ...(index === null ? {} : { imageIndex: Number(index) }) }, "kernelResult", sessionId) as { cellId: string; imageIndex?: number };
}
