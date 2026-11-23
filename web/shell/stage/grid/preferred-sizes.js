import { updatePreferred } from "./update-preferred.js";

/** The stage's record of preferred group sizes (see updatePreferred). `squeezing()`: the stage's own size is changing
 * (window, session sidebar), so layout changes meanwhile are passive and update nothing; `settle(current)`: that is
 * over and `current` is how it was laid out (dockview reports layout changes late, so one arriving after this compares
 * against it and changes nothing); `observe(current, main)` after every layout change; `set(preferred, current)` after
 * a layout or a restore decided them. */
export function preferredSizes(initial) {
  let preferred = initial;
  let laid = {};
  let passive = false;
  return {
    get: () => preferred,
    set(next, current) { preferred = next; laid = current; },
    squeezing() { passive = true; },
    settle(current) { laid = current; passive = false; },
    observe(current, main) {
      if (!passive) preferred = updatePreferred(preferred, laid, current, main);
      laid = current;
    },
  };
}
