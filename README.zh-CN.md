# PRK（pi-remote-kernel）

[English](README.md) · 简体中文

![PRK 架构图](docs/architecture.svg)

PRK 是一个基于 [Pi SDK](https://pi.dev/) 的 agent 宿主，长期挂在一台机器上运行。我写它是因为想让模型在好几台机器上干活，又不想每台都装一套 agent，也不想把文件在机器之间搬来搬去。

所以 PRK 把事情分成了三块。Gateway 是唯一管会话的进程，对话历史、排队和调度都在它那里。真正干活的是目标机：Gateway 通过 SSH（或者任何能免交互登录的命令）在目标机上起一个 daemon，模型的代码在那里跑，文件在那里读写，传回来的只有结果。浏览器和命令行只是客户端，关掉网页、换台电脑再打开，会话还在原地继续。

## 用起来是什么样

每个会话在目标机上有一个常驻的 kernel，默认是 Python，也可以切到 Bun 跑 JavaScript 或 TypeScript。上一次调用读进来的数据、算好的变量，下一次还在，不用重新加载。做数据分析或者排查线上问题时，这一点很省事。

读文件、改文件、grep 都直接在目标机上执行。耗时的命令可以放进终端里跑，命令结束或者一段时间没有输出，模型会被叫醒接着处理。网页上看到的是同一个终端，需要的时候你可以直接接手。

一个会话可以派出几个子会话并行干活，子会话可以在别的机器上，做完的结果会自动交回来。会话之间也可以直接发消息。

模型、provider、扩展和 skill 都按 Pi 的方式配置。对话历史、分支和上下文压缩用的是 Pi SDK 自己的实现，PRK 没有改 Pi。

网页上可以聊天、浏览和编辑目标机上的文件、开终端，也可以管理会话、机器和插件，手机上也能用。

## 出问题的时候

每个 kernel 跑在单独的 systemd scope 里，有内存上限，内存爆了只会杀掉它自己。kernel 崩了或者连接断了，下次输入时会重新起一个；目标机连不上会马上报错，不会一直卡着。会话可以休眠，唤醒以后历史都还在。Gateway 卡死的话，可以在网页上重启。

## 使用前请注意

PRK 设计给一个人在自己的机器和内网里使用。网页没有登录，谁能打开网页，谁就能在你的目标机上执行任意命令。它默认只监听 `127.0.0.1`，从别的电脑访问请用 SSH 隧道，不要直接暴露到公网。

目前只支持 Linux。项目还在频繁改动，配置格式和接口随时可能变，不保证兼容旧版本。大部分设计文档是中文写的。

## 安装

需要 Node.js 22.19 以上、Python 3.9 以上，还要准备 `bun`、`rg`、`fd` 三个可执行文件，PRK 会把它们分发到目标机上。

```sh
git clone https://github.com/shttty/prk-agent.git
cd prk-agent
scripts/prk.sh install
# 导入 bun / rg / fd，配置模型：见安装指南第 2、3 步
scripts/prk.sh start
```

启动后打开 <http://127.0.0.1:8787/>。导入工具、接模型、确认模型真的能调用 kernel 的完整步骤在[安装指南](INSTALL.md)里。

## 文档

[安装指南](INSTALL.md)讲安装、接模型、验收、日常启停和排错。[配置参考](docs/configuration.md)讲 PRK home、`config.toml`、`instances.toml` 和 `agent/` 下的 Pi 设置，本机和远程机器的配置字段在[实例参考](docs/configuration/instances.md)。想自己写客户端，看 [Gateway 协议](docs/wire/)和[跨进程约定](docs/contract.md)。想给 kernel 加自己的 Python 工具，看 [kernel 工具模块](docs/kernel-tools.md)。

## 开发

```sh
npm ci && npm --prefix web ci
npm run check         # TypeScript 检查
npm run check:unit    # 单元测试
npm run check:quick   # 跨进程冒烟测试，Python 和浏览器的要求见 docs/kernel-recovery.md#test-environment
```

改前端时，可以用 `PRK_API=http://127.0.0.1:8788 npm --prefix web run dev` 起一个带热更新的 Vite，连到启动脚本拉起的 API。

代码按目录组织：一个目录是一个对象，一个文件是一个方法，单个代码文件不超过 200 行有效代码。动手之前请先读 [AGENTS.md](AGENTS.md)，项目的规矩都在里面；已经定下的决策和接下来的计划在 [PLAN.md](PLAN.md)。

## 许可证

[MIT](LICENSE)，版权所有 2026 Iris Rinne。[docs/pi-sdk](docs/pi-sdk/README.md) 摘自 Pi 的官方文档，保留上游的 MIT 版权声明。随仓库分发的字体等第三方资源，各自沿用原来的许可证。
