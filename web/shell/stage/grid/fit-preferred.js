import { fitGrid } from "./fit-grid.js";
import { mainTests } from "./main-tests.js";
import { withPreferred } from "./with-preferred.js";

/** The grid laid out for `width` x `height` from the groups' preferred sizes: every other group at its preferred size
 * and the main area (`main`: its group id, null: the chat's) taking the rest; under the main area's floor the others
 * give way together, and as room comes back they return to their preferred sizes before the main area grows. Pure. */
export const fitPreferred = (grid, preferred, width, height, main) => fitGrid(withPreferred(grid, preferred), width, height, mainTests(main));
