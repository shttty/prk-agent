export function saveDisclosure(actions, key, open) {
  actions?.savePresentation((presentation) => ({
    openedTools: [...(presentation?.openedTools ?? []).filter((value) => value !== key && value !== `!${key}`), open ? key : `!${key}`],
  }));
}
