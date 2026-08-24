# dsh-harmonyos-market · 鸿蒙市场客户端

在 dsh 设置面板里一键浏览、安装本市场的插件。

## 安装

```sh
dsh plugin --profile web add github:Entity-Him/dsh-harmonyos-market
```

装好后打开 设置 → 鸿蒙市场 · HarmonyOS Market，即可看到本市场收录的插件：

- 每个插件标注兼容等级（纯 JS / 已打鸿蒙补丁 / 含原生依赖）
- 一键安装 / 卸载，安装完成后可一键重启 dsh 生效
- 目录来自 `dsh-harmonyos-market` 仓库的 `plugins.json`，由 CI 自动生成

## 配置

设置里可改三项（默认值即开箱即用）：

- `allowRestart`：是否允许市场触发重启（默认 true；若由 supervisor/systemd 守护，可保持 true，守护进程会自动拉起）
- `registryUrl`：目录地址（默认指向本仓库 main 分支的 plugins.json）
- `profile`：操作的目标 profile（默认从启动参数读取，回退 web）

## 工作原理

- host 半（lib/index.js）挂载 `webServer` 路由，走与官方 dsh-market 相同的 `dsh plugin` CLI 子进程安装方式，安装目标仅限目录内条目（防任意命令注入）
- 浏览器半（client/client.js）在设置页注册独立分节，数据全部走同源 fetch，无 Typert RPC 依赖
- 零运行时依赖（peerDependencies 由宿主提供），鸿蒙上开箱即用
