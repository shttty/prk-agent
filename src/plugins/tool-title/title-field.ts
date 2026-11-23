/**
 * The call title: one argument added to every declared tool schema and, once stripped before Pi validates the call,
 * the toolcall block key that keeps it in the persisted assistant message. Tools that declare it themselves keep it.
 */
export const TITLE_FIELD = "title";

export const TITLE_PROPERTY = Object.freeze({
  type: "string",
  description: "A very short present-progressive phrase saying what this call is doing, in the user's language "
    + "(e.g. \"Reading the build config\", \"正在比对两版输出\"). Shown to the user as the title of this call.",
});
