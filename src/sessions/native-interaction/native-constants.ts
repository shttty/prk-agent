import { NATIVE_IMAGE_MIME_TYPES, NATIVE_TEXT_MIME_TYPES } from "../../gateway/wire/attachment-constants.ts";

export const IMAGE_TYPES = NATIVE_IMAGE_MIME_TYPES;
export const TEXT_TYPES = NATIVE_TEXT_MIME_TYPES;
export const THINKING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
