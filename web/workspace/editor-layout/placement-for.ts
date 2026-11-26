
export function placementFor(groupIds: readonly string[], activeGroupId: string | null | undefined) {
  const target = activeGroupId && groupIds.includes(activeGroupId) ? activeGroupId : groupIds[0];
  return target === undefined ? null : { referenceGroup: target };
}
