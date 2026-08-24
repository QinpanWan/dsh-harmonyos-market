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

## 插件清单

- [dsh-hiboard-push](data/plugins/Entity-Him__dsh-hiboard-push.yml) — 鸿蒙负一屏任务完成推送（今日任务/定时任务通知）

## 安装

```sh
dsh plugin --profile web add github:Entity-Him/dsh-hiboard-push
```

（配合 dsh-harmonyos-pc 的 `dsh-hm-market` 工具可一键预检后安装）

## 上架

想上架你的插件？看 [CONTRIBUTING.md](CONTRIBUTING.md) —— 三分钟提交一个条目。

## 路线图

- [x] 市场骨架 + 原生依赖预检脚本
- [ ] 首批插件收录（deveco-bridge / 读图补丁 / 皮肤）
- [ ] `dsh-hm-market` 一键安装工具
- [ ] 插件兼容性自动评分徽章
