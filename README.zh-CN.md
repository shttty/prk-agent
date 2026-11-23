# pi-remote-kernel（PRK）

[English](README.md) · 简体中文

PRK 托管 [Pi SDK](https://pi.dev/)，让模型通过工具使用本机或 SSH 目标机上的持久 Python kernel。浏览器工作台和 `attach` CLI 可以连接同一个 Gateway。

```text
浏览器工作台 -> Web API -> Gateway（Pi SDK、会话与工具路由）
attach CLI ---------------> Gateway
                              |
                              +-> pi-env（本机或 SSH）-> Python kernel
```

- 通过 `kernel_code` 在会话自己的命名空间运行 Python。计算和文件默认留在所选机器上。
- 在工作台管理对话和实例、浏览和编辑目标机文件，或打开目标机终端。
- 使用 Pi 模型和兼容扩展；会话历史、分支和上下文压缩继续由 SDK 管理。

## 安装

按 [Linux 安装指南](INSTALL.md) 检查依赖、安装、配置模型并启动。指南里的冒烟验收会核对模型确实调用 `kernel_code` 并得到 `42`。

**PRK 面向可信单用户。** 网页没有登录，能访问的人就能操控终端。保留默认的 loopback 监听；远程访问走 SSH 隧道，不要把网页暴露到公网。

## 配置

[配置参考](docs/configuration.md) 介绍 PRK home、全局配置 `config.toml`、实例配置 `instances.toml`，以及 `agent/` 下的 Pi provider 与扩展设置。本机和 SSH 目标的字段见[实例参考](docs/configuration/instances.md)。

## 开发与测试

在两个 npm 包里安装锁定依赖：`npm ci && npm --prefix web ci`。开发前端时，可用 `PRK_API=http://127.0.0.1:8788 npm --prefix web run dev` 连接启动脚本拉起的 API；如改过 API 端口，相应调整 URL。

- `npm run check` 做 TypeScript 检查，`npm run check:unit` 跑纯单元测试。
- `npm run check:quick` 跑跨进程冒烟检查，Python 和浏览器依赖见[测试环境](docs/kernel-recovery.md#test-environment)。
- 项目约束见 [AGENTS.md](AGENTS.md)，决策与后续计划见 [PLAN.md](PLAN.md)；修改跨进程接口前先读[通信契约](docs/contract.md)。

## 许可证

[MIT](LICENSE)。版权所有 2026 Iris Rinne。[Pi SDK 参考文档目录](docs/pi-sdk/README.md) 保留上游的 MIT 版权声明；随仓库分发的第三方资源保留各自的许可证。
