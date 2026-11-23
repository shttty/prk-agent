
/** Tasks and subtasks in list order, for the current item and the in-progress count. */
export const flatten = (phases) => phases.flatMap((phase) => phase.tasks.flatMap((task) => [task, ...task.subtasks]));
