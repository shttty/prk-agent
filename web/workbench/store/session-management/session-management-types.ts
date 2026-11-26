/** What the create dialog asks for; `project` is an existing `{id, name}` or `{name}` for a new project. */
export type CreateSessionOptions = { cwd?: string; label?: string; project?: { id?: string; name?: string } };

/** The body of `POST /sessions`: only what the Gateway needs, empty fields left out. */
export type CreateSessionPayload = { target: string; cwd?: string; label?: string; project?: { id?: string; name: string } };

/** Where a recovery goes when the user moves the session to another instance. */
export type RecoverySelection = { target: string; cwd?: string };

/** An action on a derived session (docs/wire/sessions.md, session management): `action` plus its own fields. */
export type ManageSessionRequest = { action: string; [field: string]: unknown };
