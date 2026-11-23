
export function activeOperation(state) {
  return state.session.snapshot?.operation || [...state.session.operations.values()].find((record) => record.accepted && !record.completion) || null;
}
