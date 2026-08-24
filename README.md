# dsh-harmonyos-market · 鸿蒙专属 dsh 插件市场

DeepSeek Harness 的 HarmonyOS 专属插件市场。主流插件市场收录的插件很多依赖原生二进制
（lightningcss / node-pty / ssh 等），在鸿蒙设备上装一个崩一个。这里只收录**能在鸿蒙上跑**的插件。

## 收录标准

| 兼容等级 | 含义 | 校验 |
|---|---|---|
| `native-free` | 纯 JS，无原生依赖，开箱即用 | CI 自动检测依赖树 |
| `patched` | 有鸿蒙补丁（补丁随条目提供） | CI 校验补丁存在 |
| `incompatible` | 含原生依赖，仅收录用于提示 | 条目明确标注，可安装但会崩 |

每条目必须通过 `scripts/check-compat.mjs` 的原生依赖预检（黑名单：`lightningcss`、
`node-pty`、`koffi`、`ssh2`、`.node` 二进制等），**装之前先预检，崩不了才算数**。

## 一键安装（推荐）

装一次市场客户端，之后全部在 dsh 设置里点按钮：

```sh
dsh plugin --profile web add github:Entity-Him/dsh-harmonyos-market
```

打开 设置 → **鸿蒙市场 · HarmonyOS Market**：浏览本市场收录的插件（带兼容等级徽章），
一键安装 / 卸载，安装完成后一键重启生效。目录由 CI 自动生成（`plugins.json`），
客户端插件本身也在本市场收录，零运行时依赖。

## 插件清单

- [dsh-hiboard-push](data/plugins/Entity-Him__dsh-hiboard-push.yml) — 鸿蒙负一屏任务完成推送（今日任务/定时任务通知）
- [dsh-harmonyos-market](data/plugins/Entity-Him__dsh-harmonyos-market.yml) — 鸿蒙市场客户端（在设置里一键浏览/安装本市场插件）

## 命令行安装

```sh
dsh plugin --profile web add github:Entity-Him/dsh-hiboard-push
```

（配合 dsh-harmonyos-pc 的 `dsh-hm-market` 工具可一键预检后安装）

## 上架

想上架你的插件？看 [CONTRIBUTING.md](CONTRIBUTING.md) —— 三分钟提交一个条目。
条目写入 `data/plugins/*.yml` 后，CI 会自动预检并重新生成 `plugins.json`。

## 路线图

- [x] 市场骨架 + 原生依赖预检脚本
- [x] 设置内独立「鸿蒙市场」分节（一键安装/卸载/重启生效）
- [x] `plugins.json` 目录自动生成（CI）
- [ ] 首批插件收录（deveco-bridge / 读图补丁 / 皮肤）
- [ ] 插件兼容性自动评分徽章
