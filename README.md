# pi-remote-kernel (PRK)

English · [简体中文](README.zh-CN.md)

PRK hosts the [Pi SDK](https://pi.dev/) and gives a model tools backed by a persistent Python kernel on a local or SSH-connected machine. Use the browser workbench or the `attach` CLI to work with the same Gateway.

```text
Browser workbench -> Web API -> Gateway (Pi SDK, sessions, tool routing)
attach CLI -------------------> Gateway
                                  |
                                  +-> pi-env (local or SSH) -> Python kernel
```

- Run Python with `kernel_code` in a session-scoped namespace. Files and computation stay on the selected machine by default.
- Manage conversations and instances, browse and edit target files, and open target terminals in the workbench.
- Use Pi models and compatible extensions; the SDK remains responsible for session history, branching, and compaction.

## Install

Follow the [Linux installation guide](INSTALL.md) (Chinese) for prerequisites, installation, model setup, startup, and troubleshooting. The guide's smoke check verifies that a model calls `kernel_code` and gets `42` back.

**Use PRK as a trusted single-user workbench.** The Web UI has no login and can control terminals. Keep the default loopback listener and use an SSH tunnel for remote browser access; do not expose the UI to the public internet.

## Configuration

See [Configuration](docs/configuration.md) for the PRK home, global `config.toml`, instance-specific `instances.toml`, and Pi provider and extension settings under `agent/`. The [instance reference](docs/configuration/instances.md) covers local and SSH targets.

## Development

Install the locked dependencies in both packages: `npm ci && npm --prefix web ci`. For frontend development, run `PRK_API=http://127.0.0.1:8788 npm --prefix web run dev` against the API started by the launcher (adjust the URL if you changed its port).

- `npm run check` runs the TypeScript check; `npm run check:unit` runs the pure unit suite.
- `npm run check:quick` runs the cross-process smoke suite; see the [test environment](docs/kernel-recovery.md#test-environment) for its Python and browser requirements.
- See [AGENTS.md](AGENTS.md) for project conventions, [PLAN.md](PLAN.md) for decisions and planned work, and the [transport contract](docs/contract.md) before changing cross-process interfaces.

## License

[MIT](LICENSE). Copyright 2026 Iris Rinne. The [Pi SDK reference directory](docs/pi-sdk/README.md) keeps its upstream MIT notice; bundled third-party assets retain their own licenses.
