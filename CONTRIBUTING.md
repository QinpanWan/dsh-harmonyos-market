# Contributing · 上架指南

三分钟上架一个插件，提交前先自检原生依赖。

## 步骤

1. Fork 本仓库
2. 在 `data/plugins/` 新建 `owner__name.yml` 条目（模板见下）
3. 本地跑 `node scripts/check-compat.mjs`，确认预检通过
4. 提 PR，标题 `add <owner>/<name>`

## 条目模板

```yaml
name: your-plugin
owner: your-github-id
url: https://github.com/your-github-id/your-plugin
category: ui | tool | notification | theme | agent
harmonyos:
  level: native-free | patched | incompatible
  notes: 一句话说明鸿蒙兼容情况（补丁路径 / 原生依赖清单）
description:
  en: one-line English description
  zh: 一行中文描述
install: dsh plugin --profile web add github:your-github-id/your-plugin
added: 2026-08-25
```

## 兼容等级

- `native-free`：依赖树无原生模块，CI 自动检测确认
- `patched`：含鸿蒙补丁，补丁文件放 `patches/<owner>__<name>/` 并在条目里写路径
- `incompatible`：含原生依赖装不了，收录仅作提示，必须列清单

## 原生依赖黑名单（命中即非 native-free）

`lightningcss`、`node-pty`、`koffi`、`ssh2`、`ref-napi`、`ffi-napi`、`sharp`、`canvas`、任何 `*.node` 二进制

## 快速判断

- 依赖只有 `zod` / `schemastery` 这类纯 JS：直接标 `native-free`
- 有编译产物或 install 脚本：先查是不是原生，是就打 `incompatible` 或提供补丁
- 拿不准：提 Issue，维护者帮你跑预检
