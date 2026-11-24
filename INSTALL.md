# 在一台新的 Linux 机器上安装和运行 PRK

按顺序做，每一步做到「完成标准」再往下走。命令都在 PRK 源码目录（Git checkout 或解压后的目录）里执行。PRK home 默认是 `~/.config/pi-remote-kernel`；设置了 `XDG_CONFIG_HOME` 时改用其下的 `pi-remote-kernel`，也可显式指定 `PRK_HOME`。下文把实际 PRK home 称为 `$H`。

凭据只放在 provider 支持的配置文件（权限 600）或环境变量中；不要打印、写入日志、提交到 Git 或放在命令行参数里。

## 1. 前置检查

```sh
node --version            # 需要 ≥ 22.19
python3 --version         # 需要 ≥ 3.9；用别的解释器时设 PRK_PYTHON
command -v curl setsid
```

设置本次安装使用的路径，后续命令在同一个 shell 中执行：

```sh
export PRK_HOME="${PRK_HOME:-${XDG_CONFIG_HOME:-$HOME/.config}/pi-remote-kernel}"
H="$PRK_HOME"
```

如果出网要走 HTTP 代理，npm 可配置自己的代理。要让 Gateway 调模型时也使用环境代理，使用支持 `NODE_USE_ENV_PROXY` 的 Node（22.x 至少 22.21），在 `$H/prk.env` 中 `export HTTPS_PROXY=…`、`export NO_PROXY=127.0.0.1,localhost` 和 `export NODE_USE_ENV_PROXY=1`。如果模型端点应直连，把它的域名也加入 `NO_PROXY`。

完成标准：Node 和 Python 版本都满足，本机及目标机有 Python ≥3.9，npm registry（可以是镜像）可用。`npm ci` 安装 PRK 的锁定依赖；`@earendil-works/pi-env` 包携带 daemon，Gateway 按需启动本机 daemon 或向远程目标部署它。

## 2. 安装

```sh
scripts/prk.sh install
```

它会按锁文件安装根目录和 `web/` 依赖（包括已批准的 Pi SDK postinstall 补丁）、构建前端、以所选 Python 的绝对路径初始化新 home 中的 local `default` 实例，并执行离线格式迁移。旧实例的 `name` 键改为 `id`，值、显示名 `label` 和会话 `target` 绑定不变。`PRK_PYTHON` 指定其他 Python ≥3.9，默认 `python3`；它不安装或修改 Python 环境。已有配置不会重新初始化；迁移会转换旧格式，保留配置的可迁移内容和其他数据。已有 `prk.env` 和工具制品不会覆盖。包内已有 `assets/manifest.json` 和 `assets/store/` 时，仅在 home 尚无 `assets/` 时复制整套制品。

如果 `$H` 已存在，必须先停止所有使用它的 Gateway（包括由 systemd 或其他工作树启动的 Gateway），自行确认已停止，然后显式运行：

```sh
scripts/prk.sh install --gateway-stopped --kernelspec-directory /absolute/old/jupyter/kernels
```

最后一个参数可省略；它指向旧 kernelspec 的 `kernels` 目录，用于从 `prk-python` 的 `kernel.json` 读取实际绝对 Python 路径。路径不存在或无法读取时实例标为待补，不会默默改成 `python3`。远程实例不会从旧 URL 推断 SSH 命令，迁移后在网页实例设置补命令及 Python。迁移先预检，再在 `$H/before-pienv` 保存一次备份并逐文件原子替换；如果仅需替换实例 ID 键，原 `instances.toml` 单独备份到 `$H/before-instance-id/instances.toml`，不覆盖已有 pi-env 备份。失败时不要启动 Gateway，按错误所报告的备份完整性和替换情况恢复，不能使用不完整备份。新格式重复迁移只校验，不重复修改。保留原实例 ID 和会话绑定，历史会话仍可读。不要在 Gateway 运行时复制或迁移正在写入的 home。

从已有 checkout 打包给另一台机器：`scripts/package.sh /absolute/output` 要求所有项目变更已提交，归档该提交、当前 PRK home 的 `assets/manifest.json`、`assets/store/`（不含 Gateway 为远程插件宿主生成的 `remote-ext-*` 缓存，目标机自己生成），以及 `$H/agent/settings.json` 里配置的插件：`npm:` 来源按当前已装版本重新安装成 `plugins/npm/`，绝对路径的本地目录从各自仓库的 HEAD 导出（有未提交改动会拒绝打包）并装好运行时依赖。其他来源类型会拒绝打包。`scripts/package.sh /absolute/output --skip <名字>` 可去掉某个插件，名字可写 `settings.json` 里的来源、npm 包名或本地目录名，可重复；写错会拒绝打包。不打包 home 配置、凭据或会话。目标机仍需从 npm registry 安装 PRK 的锁定依赖，pi-env daemon 随 npm 包提供。

旧主目录仍有 `config.json` 或 `instances.json` 时，安装与 Gateway 启动会拒绝继续；不双读、不回退。`node scripts/migrate-config-toml.mjs --home /absolute/prk-home-copy` 只接受已符合当前 local/sshCommand/python schema 的 JSON，并须先在离线副本操作；它使用当前 parser 校验，不能将旧 Jupyter JSON 转成 TOML 再接 pi-env 迁移。S6 专用迁移的输入是旧 split TOML。详见[配置迁移](docs/configuration.md#operator-migration-manual-not-automatic)。Pi/provider 的 `agent/*.json`、目标项目 `.prk/settings.json` 与 PRK 状态文件仍是 JSON。


### 随包插件

包里有 `plugins/` 时，`install` 会把插件装进 home，Gateway 启动时直接加载，不再下载：

- `plugins/npm/` 整个替换 `$H/agent/npm/`。`settings.json` 里的 `npm:<包名>` 来源会在这里找到已装好的版本。
- `plugins/local/<名字>/` 整个替换 `$H/agent/plugins/<名字>/`，作为本地目录插件加载。
- `$H/agent/settings.json` 的 `packages` 里还没有的来源会追加进去（启用状态、位置与打包机一致），每加一条打印一行 `settings.json: added …`。已有条目原样保留，不改启用状态，也不删除。

这两个目录只放插件包内容，不放用户数据；重新安装新包就是更新插件。不想要的插件在网页「插件」页停用或删除。`settings.json` 里不随包提供的来源（比如 `git:` 或包里没有的 `npm:` 包），Gateway 仍会尝试下载；下载失败只是该插件不加载，原因在「插件」页和 `logs gateway` 里。

从源码安装没有预置的随包插件。给另一台机器打包时，先核对所选插件是否依赖打包机上的服务、配置文件或特定平台的原生二进制，用 `--skip` 去掉目标机不具备条件的插件。插件在 Gateway 启动时发出 warning 或 error 通知时，Gateway 会拒绝启动；详细原因见 `logs gateway`。

完成标准：输出包含 `Installed. …`；`$H/instances.toml` 存在且权限 600；随包时每个插件有一行 `plugin files: …`。

### 从源码准备实例制品

源码不包含工具制品。首次创建会话前，默认配置需要对应目标架构的 Linux `bun`、`rg` 和 `fd`；已带齐制品的安装包可跳过本节。准备目标机能运行的可执行文件：[Bun](https://bun.com/docs/installation)、[ripgrep](https://github.com/BurntSushi/ripgrep/releases) 和 [fd](https://github.com/sharkdp/fd/releases)。对于同架构同发行版的本机实例，可直接用发行版提供的 `rg`、`fd`（Debian/Ubuntu 对应 `ripgrep`、`fd-find`，后者的命令名为 `fdfind`）。

Gateway 停止时，把工具导入当前 PRK home。以下为本机实例的例子：先设置 `BUN_BINARY` 为所下载的 Bun 可执行文件的绝对路径，不是压缩包或目录。

```sh
arch=$(uname -m)          # linux 平台目录使用 x86_64 或 aarch64
install -Dm755 "$BUN_BINARY" "$H/assets/bin/bun/linux-$arch/bun"
install -Dm755 "$(command -v rg)" "$H/assets/bin/rg/linux-$arch/rg"
install -Dm755 "$(command -v fd || command -v fdfind)" "$H/assets/bin/fd/linux-$arch/fd"
node scripts/import-tool-artifacts.mjs --home "$H" --version imported
```

完成标准：首次导入输出三条 `Imported ...`。其他架构或已有制品时，按[制品管理](docs/configuration/execution.md#gateway-distributed-clis-tool_bin)为相应平台上传并选择当前版本。只有选用托管 Python 时才需另备 uv 与 Python 归档；现有 Python 不需要装 uv。

## 3. 接模型 provider

Pi 已支持的 provider 可直接使用 `agent/auth.json` 或其支持的环境变量，参见[模型配置](docs/configuration.md#models-and-provider-plugins)。下例演示通过 `agent/models.json` 接入兼容端点。先从 provider 文档确认 API 协议、base URL、模型 ID 和认证方式。

对于提供 `/models` 列表且使用 Bearer 认证的兼容端点，可选用 Bash 检查连接。key 经标准输入传给 `curl`，不会出现在进程参数中：

```bash
read -rs KEY
printf 'Authorization: Bearer %s\n' "$KEY" | curl -fsS -H @- 'https://provider.example.com/v1/models'
unset KEY
```

写 `$H/agent/models.json`（`chmod 600`）。`api` 按协议选 `openai-completions`、`openai-responses` 或 `anthropic-messages`：

```json
{
  "providers": {
    "custom": {
      "baseUrl": "https://provider.example.com/v1",
      "api": "openai-completions",
      "apiKey": "<key>",
      "models": [
        { "id": "<模型名>", "input": ["text", "image"], "contextWindow": 128000, "maxTokens": 16000 }
      ]
    }
  }
}
```

`contextWindow`、`maxTokens` 按 provider 文档填；纯文本模型去掉 `"input"` 里的 `"image"`。用可信的私有 CA 时，在 `$H/prk.env` 加 `export NODE_EXTRA_CA_CERTS=/path/to/ca.pem`。

在 `$H/prk.env` 设 `PRK_MODEL` 为 `provider/model-id` 形式，例如 `PRK_MODEL=custom/your-model-id`。选择支持工具调用的模型，并用实际模型 ID 替换示例。

完成标准：`PRK_MODEL` 指向已配置的 provider 和模型；如果做了 `/models` 检查，返回的列表包含该模型。

只验收启动和 HTTP、没有模型凭据时，可跳过本节的凭据配置，在 `$H/prk.env` 写 `PRK_MODEL=openai/gpt-4o`（Pi 内置模型 ID）。下面可以启动并建会话，但不要发送模型消息。

## 4. 启动并验收

```sh
scripts/prk.sh start      # 依次起 Gateway、API、UI，各自等就绪
scripts/prk.sh status
```

检查直连 API、网页和网页代理均返回 HTTP 200（使用默认端口）：

```sh
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8788/api/workbench
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787/
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787/api/workbench
```

首次用 `attach` 前先显式准备 `default` 实例环境。下面使用默认 API 端口 `8788`；如果改过 `PRK_API_PORT`，同步调整两处 URL 和 `Origin`：

```sh
curl -fsS -H 'Origin: http://127.0.0.1:8788' -H 'Content-Type: application/json' \
  --data '{}' http://127.0.0.1:8788/api/targets/default/environment
curl -fsS http://127.0.0.1:8788/api/targets/default/environment
```

隔几秒重新执行 GET，等 `status` 为 `ready`；如为 `failed`，先按返回的错误排查，不要继续创建会话。也可在网页新建会话，它会先下发环境。

创建测试会话：

```sh
SID=$(node src/main.ts attach create --target default --label smoke | python3 -c 'import sys,json;print(json.load(sys.stdin)["session"]["sessionId"])')
printf 'session: %s\n' "$SID"
```

没有模型凭据时跳过下面的模型调用，直接关闭测试会话。有模型凭据时，再跑一轮真实调用，确认模型能调到 Python：

```sh
OP=$(node src/main.ts attach send --session "$SID" --message "Use the Python tool to compute 6*7 and print it. Then reply with only the number." | python3 -c 'import sys,json;print(json.load(sys.stdin)["operationId"])')
# 每两秒查一次，直到这个 operation 出现在 recentOperations 里
node src/main.ts attach state --session "$SID" | python3 -c 'import sys,json;d=json.load(sys.stdin);print([o.get("status") for o in d.get("recentOperations",[]) if o.get("operationId")==sys.argv[1]])' "$OP"
node src/main.ts attach messages --session "$SID"
```

最后关闭测试会话：

```sh
node src/main.ts attach close-session --session "$SID"
```

完成标准：operation 状态是 `completed`；messages 里有一次 `kernel_code` 调用，tool 结果含 `42`，最后的回答是 `42`。

## 5. 访问网页

UI 默认只听 `127.0.0.1:8787`。PRK 网页没有登录，能访问的人就能操控终端，所以从自己的电脑用 SSH 隧道访问：

```sh
ssh -L 8787:127.0.0.1:8787 user@server.example.com
# 浏览器打开 http://127.0.0.1:8787/
```

只有用户明确要求时才把 `PRK_UI_HOST` 改成局域网地址。端口可用 `PRK_UI_PORT`、`PRK_API_PORT` 调整；API 只听 loopback。

## 6. 日常操作

```sh
scripts/prk.sh status
scripts/prk.sh stop
scripts/prk.sh start
scripts/prk.sh logs gateway  # 或 api、ui
```

pid 和日志在 `.runtime/prk/`。每个组件在自己的进程组里，`stop` 按 UI、API、Gateway 的顺序结束整组。本机及远程 daemon 由 Gateway 按需管理，不需要独立的 Jupyter 服务。

## 排错

| 现象 | 看哪里 / 怎么处理 |
|---|---|
| `start` 报 `gateway is not ready` 或 `gateway exited` | `scripts/prk.sh logs gateway`。`$H/agent/settings.json` 里有不随包提供的插件来源时，Gateway 启动会先尝试下载，内网要等到超时。 |
| 某个插件没加载 | 网页「插件」页看错误；`logs gateway` 里搜插件名。随包插件缺文件时重新跑 `scripts/prk.sh install --gateway-stopped`。 |
| 日志最后一行是 `Gateway command failed`，前面有某个插件的 warning | 那个插件在启动时发了通知，Gateway 因此拒绝启动。在 `$H/agent/settings.json` 里把它的 `enabled` 改成 `false`（这时网页还打不开），再 `start`。 |
| 模型回合 `failed`，消息里是 `Request failed` | `logs gateway` 里有 provider 的详细错误。常见原因：Gateway 没走代理（见第 1 步的 `NODE_USE_ENV_PROXY=1`）、证书（`NODE_EXTRA_CA_CERTS`）、`api` 协议选错、模型名不对。 |
| 模型回合 `failed`，日志里是 `WebSocket error` 或访问了 `/backend-api/` | 用的是 `pi-cliproxyapi-provider` 插件，它走 `<baseUrl>/backend-api/`。改用第 3 步的 `models.json` 写法。 |
| Python 解释器不可用或版本低于 3.9 | 检查目标实例的 Python 绝对路径和目标机上的实际版本；在网页实例设置测试连接并重新选择解释器。 |
| 实例环境下发报 `No current … artifact` | 源码安装请先导入第 2 步的工具制品，确保平台匹配；已有制品请检查该工具的当前版本。 |
| 实例提示待补配置 | 在实例设置填写无人值守连接命令并测试，再选择 Python；local 只需 Python。交互密码、OTP 和 MFA 菜单不受支持。 |

For contributor checks, see the [test environment](docs/kernel-recovery.md#test-environment).
