
export function loadReferenceCandidates({ referenceQuery, actions }) {
    if (referenceQuery === null) {
      actions.clearReferenceCandidates();
      return;
    }
    void actions.loadReferenceCandidates(referenceQuery);
  }
