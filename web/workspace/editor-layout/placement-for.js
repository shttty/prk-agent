
export function placementFor(groupIds, activeGroupId) {
  const target = groupIds.includes(activeGroupId) ? activeGroupId : groupIds[0];
  return target === undefined ? null : { referenceGroup: target };
}
