# Contributing / 参与开发

> 让鸿蒙 dsh 插件生态长起来，需要你。

这是鸿蒙专属 dsh 插件市场：收录在鸿蒙上真正能跑的插件，配套可视化市场客户端
（dsh 设置里的「鸿蒙市场」分节）。无论你是开发群成员、鸿蒙开发者、插件作者，
还是 dsh 深度用户，都欢迎参与。

## How to join / 加入方式

- **共同创建者（Collaborator）**：开发群成员可向群主申请，被邀请后获得 Write 权限——
  可以开分支、提 PR、参与 review、直接维护目录条目。
- **普通贡献者**：Fork 本仓库 → 上架插件 / 改客户端 → 提 PR，一样被欢迎。
- **试用反馈**：装不上、崩了、想上架不知道怎么写条目——提 Issue 或来 Discussions 说一声，就是贡献。

## Getting started / 环境准备

- 一台鸿蒙 PC / 鸿蒙设备（跑 dsh），一台开发机（Node.js ≥ 18 即可，纯 JS 项目零构建）
- 本地预检：`node scripts/check-compat.mjs`（零依赖，只靠 Node 自带 fetch）
- 想体验市场客户端：`dsh plugin --profile web add github:Entity-Him/dsh-harmonyos-market`
  然后打开 设置 → 鸿蒙市场 · HarmonyOS Market

## Repository layout / 仓库结构

| 路径 | 作用 |
|---|---|
| `data/plugins/` | 插件目录条目（上架入口，一个插件一个 yml） |
| `plugins/dsh-harmonyos-market/` | 市场客户端插件本体（host 路由 + 设置页分节） |
| `scripts/` | 原生依赖预检 / 目录生成脚本 |
| `.github/workflows/` | CI：`check`（预检）+ `plugins-json`（自动重生成目录） |
| `plugins.json` | 生成的目录快照（CI 自动维护，勿手改） |

## 上架插件（三分钟）

1. Fork 本仓库
2. 在 `data/plugins/` 新建 `owner__name.yml` 条目（模板见下）
3. 本地跑 `node scripts/check-compat.mjs --entry owner__name.yml`，确认预检通过
4. 提 PR，标题 `add <owner>/<name>`

### 条目模板

```yaml
name: your-plugin
owner: your-github-id
url: https://github.com/your-github-id/your-plugin
category: ui | tool | notification | theme | market | agent | security
harmonyos:
  level: native-free | patched | incompatible
  notes: 一句话说明鸿蒙兼容情况（补丁路径 / 原生依赖清单）
description:
  en: one-line English description
  zh: 一行中文描述
install: dsh plugin --profile web add github:your-github-id/your-plugin
added: 2026-08-25
```

### 兼容等级

- `native-free`：依赖树无原生模块，CI 自动检测确认
- `patched`：含鸿蒙补丁，补丁文件放 `patches/<owner>__<name>/` 并在条目里写路径
- `incompatible`：含原生依赖装不了，收录仅作提示，必须列清单

### 原生依赖黑名单（命中即非 native-free）

`lightningcss`、`node-pty`、`koffi`、`ssh2`、`ref-napi`、`ffi-napi`、`sharp`、`canvas`、任何 `*.node` 二进制

### 快速判断

- 依赖只有 `zod` / `schemastery` 这类纯 JS：直接标 `native-free`
- 有编译产物或 install 脚本：先查是不是原生，是就打 `incompatible` 或提供补丁
- 拿不准：提 Issue，维护者帮你跑预检

## Filing issues / 提 Issue

**Bug 报告**，请附上：

- dsh 版本（`dsh --version`）与鸿蒙系统版本
- 设备型号
- 复现步骤
- 报错日志（`dsh-web.log` / 终端输出 / 设置页错误提示）
- 截图可选，但很加分

**功能建议 / 上架申请**：说明使用场景、期望效果；有参考实现最好。大的功能建议先放
Discussions 讨论，避免返工。

## Submitting PRs / 提 PR

### Step by step / 流程

1. 从最新 `main` 拉分支：`git checkout -b feat/你的改动`
2. 改代码 / 条目，保持改动小而聚焦
3. 本地验证：上架跑 `node scripts/check-compat.mjs`，改客户端跑通 dsh 重启验证
4. 推送分支，开 PR，标题一句话说清改动
5. 等 review；被打回就按评论改，改完推送即可

### Commit conventions / 提交信息规范

```
add: 上架 dsh-xxx
feat: 市场客户端新增 xxx
fix: 修复目录生成脚本 xxx
docs: 更新上架指南
```

- 一行描述，中文或英文皆可，别写 update / fix bug 这种空话
- 一个 PR 尽量只做一件事，别夹带无关改动

### What gets bounced / 什么会被打回

- 直接推 `main`（受保护，除非你是 admin）
- 条目没跑预检、兼容等级与实际依赖不符
- 改动范围明显越界（顺手改了无关文件）
- 大改动没先讨论方案

### What merges fast / 什么会被快速合并

- 上架纯 JS 插件：条目规范、预检通过，直接合
- 修 bug：小而准，有复现步骤
- 文档：改错别字、补教程、补截图

## How review works / Review 怎么进行

- `main` 分支受保护：**必须至少 1 人 review 通过**才能合并（PR 制）
- review 关注：兼容等级是否真实、条目字段是否齐全、客户端改动是否有回归
- 被打回不是否定，改好再推即可

## Working agreements / 协作约定

- 大改动先讨论再动手（Discussions / 开发群）
- 上架前一定跑 `check-compat.mjs`，崩不了才算数
- 改市场客户端前，先确认它在鸿蒙实机 / 本机 dsh 上跑通
- 遇到 dsh 本体的问题，先在官方仓库确认，别把锅背在自己的插件上

## FAQ / 常见问题

**Q：我插件有原生依赖，还能上架吗？**
A：能，标 `incompatible` 收录作提示，或提供鸿蒙补丁标 `patched`；纯 JS 是最佳。

**Q：改了市场客户端怎么验证？**
A：本地 `dsh plugin --profile web add github:...`（或仓库直装），重启 dsh 后看
设置 → 鸿蒙市场分节是否正常。

**Q：目录里没有我的插件？**
A：条目合进 `main` 后，CI 会自动重新生成 `plugins.json`，等一两分钟刷新即可。

## Contact / 沟通渠道

- GitHub Issues / Discussions
- 开发群：930088487（群主维护，招募共同创建者中）
