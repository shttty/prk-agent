/** Runs a dialog's request: closes on success, shows `failureMessage` when it answers `false`, and the error's own message (or `fallbackMessage`) when it throws. */
export async function runDialogAction(action: () => Promise<unknown>, onClose: () => void, setError: (message: string) => void, failureMessage: string, fallbackMessage: string) {
  try {
    const result = await action();
    if (result !== false) onClose();
    else setError(failureMessage);
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : fallbackMessage);
  }
}
