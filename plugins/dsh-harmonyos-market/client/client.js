/**
 * dsh-harmonyos-market 浏览器端 bundle(单文件,经 __ModuleLoader__ 加载)。
 *
 * 在设置页注册独立分节「鸿蒙市场 · HarmonyOS Market」:拉取
 * /dsh-harmonyos-market/registry 目录,列出插件与兼容等级,一键安装/卸载
 * (POST /dsh-harmonyos-market/install|uninstall),安装完成后可一键重启生效。
 *
 * 数据通道全部走同源 fetch(host 半挂在 webServer 路由上),不依赖 Typert RPC。
 * 样式使用 --dsw-* 主题变量,跟随全局亮/暗主题。
 */

window.__ModuleLoader__.load({
  id: "dsh-harmonyos-market",
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" })

    const React = require("react")

    const css = [
      "/* dsh-harmonyos-market: 鸿蒙市场设置分节 */",
      ".hm-root{display:flex;flex-direction:column;gap:14px;padding:4px 2px 24px;font-size:13px;color:var(--dsw-alias-label-primary)}",
      ".hm-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
      ".hm-title{font-size:15px;font-weight:700;color:var(--dsw-alias-label-primary)}",
      ".hm-meta{font-size:11px;color:var(--dsw-alias-label-tertiary)}",
      ".hm-btn{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer}",
      ".hm-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}",
      ".hm-btn:disabled{opacity:.5;cursor:default}",
      ".hm-btn.primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-brand-on-primary, #fff)}",
      ".hm-btn.danger{color:var(--dsw-alias-state-error-primary)}",
      ".hm-banner{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);font-size:12px}",
      ".hm-banner.error{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}",
      ".hm-list{display:flex;flex-direction:column;gap:10px}",
      ".hm-card{display:flex;flex-direction:column;gap:6px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}",
      ".hm-card-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
      ".hm-pname{font-size:13px;font-weight:700;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}",
      ".hm-badge{display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:5px;font-size:10px;line-height:18px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}",
      ".hm-badge.ok{color:var(--dsw-alias-state-success-primary)}",
      ".hm-badge.warn{color:var(--dsw-alias-state-warn-primary)}",
      ".hm-desc{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:18px}",
      ".hm-notes{font-size:11px;color:var(--dsw-alias-label-tertiary);line-height:16px}",
      ".hm-card-foot{display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap}",
      ".hm-install{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:6px;font-size:11px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}",
      ".hm-status{font-size:11px;color:var(--dsw-alias-label-tertiary)}",
      ".hm-empty{padding:20px 0;text-align:center;font-size:12px;color:var(--dsw-alias-label-tertiary)}",
      ".hm-spin{display:inline-block;width:12px;height:12px;border:2px solid var(--dsw-alias-border-l1);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:hm-spin .8s linear infinite;vertical-align:-2px}",
      "@keyframes hm-spin{to{transform:rotate(360deg)}}",
    ].join("\n")

    const CATEGORY_ZH = {
      notification: "通知",
      market: "市场",
      tool: "工具",
      ui: "界面",
      theme: "皮肤",
      model: "模型",
      memory: "记忆",
      session: "会话",
      usage: "用量",
      misc: "其他",
    }

    const LEVEL_ZH = {
      "native-free": "纯 JS · 开箱即用",
      patched: "已打鸿蒙补丁",
      incompatible: "含原生依赖 · 可能崩溃",
    }

    function levelClass(level) {
      if (level === "native-free") return "ok"
      if (level === "patched") return "warn"
      return ""
    }

    function PluginCard({ plugin, installed, busy, result, onAction, onRestart }) {
      const desc = (plugin.description && (plugin.description.zh || plugin.description.en)) || ""
      const notes = plugin.harmonyos && plugin.harmonyos.notes ? plugin.harmonyos.notes : ""
      const level = plugin.harmonyos && plugin.harmonyos.level ? plugin.harmonyos.level : ""
      const category = CATEGORY_ZH[plugin.category] || plugin.category || "other"
      const isBusy = busy === plugin.name
      const showResult = result && result.name === plugin.name
      return React.createElement("div", { className: "hm-card" },
        React.createElement("div", { className: "hm-card-top" },
          React.createElement("span", { className: "hm-pname" }, plugin.name),
          React.createElement("span", { className: "hm-badge" }, category),
          level ? React.createElement("span", { className: "hm-badge " + levelClass(level) }, LEVEL_ZH[level] || level) : null,
          React.createElement("span", { className: "hm-badge" }, "@" + plugin.owner),
        ),
        desc ? React.createElement("div", { className: "hm-desc" }, desc) : null,
        notes ? React.createElement("div", { className: "hm-notes" }, "兼容说明：" + notes) : null,
        React.createElement("div", { className: "hm-card-foot" },
          installed.has(plugin.name)
            ? React.createElement("span", { className: "hm-install" }, "已安装")
            : React.createElement("span", { className: "hm-install" }, "未安装"),
          React.createElement("div", { style: { display: "flex", gap: "8px", alignItems: "center" } },
            showResult && result.text
              ? React.createElement("span", {
                  className: "hm-status",
                  style: result.error ? { color: "var(--dsw-alias-state-error-primary)" } : undefined,
                }, result.text)
              : null,
            showResult && !result.error && result.kind === "install"
              ? React.createElement("button", { className: "hm-btn primary", onClick: onRestart }, "重启生效")
              : null,
            React.createElement("button", {
              className: "hm-btn" + (installed.has(plugin.name) ? " danger" : " primary"),
              disabled: isBusy,
              onClick: () => onAction(installed.has(plugin.name) ? "uninstall" : "install", plugin.name),
            },
              isBusy
                ? React.createElement("span", { className: "hm-spin" })
                : (installed.has(plugin.name) ? "卸载" : "安装"),
            ),
          ),
        ),
      )
    }

    function MarketSection() {
      const [state, setState] = React.useState({ status: "loading", registry: null, installed: [], error: null, busy: null, result: null })

      const load = React.useCallback(async () => {
        setState((s) => ({ ...s, status: "loading", error: null }))
        try {
          const [regRes, instRes] = await Promise.all([
            fetch("/dsh-harmonyos-market/registry"),
            fetch("/dsh-harmonyos-market/installed"),
          ])
          const reg = await regRes.json()
          const inst = await instRes.json()
          if (!regRes.ok || reg.error) throw new Error(reg.error || ("HTTP " + regRes.status))
          setState({
            status: "ready",
            registry: reg.registry || null,
            installed: new Set(Array.isArray(inst.installed) ? inst.installed : []),
            error: null,
            busy: null,
            result: null,
          })
        } catch (error) {
          setState((s) => ({ ...s, status: "error", error: String((error && error.message) || error) }))
        }
      }, [])

      React.useEffect(() => { void load() }, [load])

      const act = React.useCallback(async (kind, name) => {
        setState((s) => ({ ...s, busy: name, result: null }))
        try {
          const res = await fetch("/dsh-harmonyos-market/" + kind, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name }),
          })
          const data = await res.json()
          if (data && data.ok) {
            setState((s) => ({ ...s, result: { kind, name, text: kind === "install" ? "安装成功，点击重启生效" : "已卸载（重启后完全移除）", error: false } }))
            await load()
          } else {
            const text = (data && (data.error || (data.stderr ? data.stderr.slice(-240) : ""))) || ("HTTP " + res.status)
            setState((s) => ({ ...s, result: { kind, name, text, error: true } }))
          }
        } catch (error) {
          setState((s) => ({ ...s, result: { kind, name, text: String((error && error.message) || error), error: true } }))
        } finally {
          setState((s) => ({ ...s, busy: null }))
        }
      }, [load])

      const restart = React.useCallback(async () => {
        try {
          await fetch("/dsh-harmonyos-market/restart", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
        } catch { /* 页面即将断开 */ }
      }, [])

      const plugins = (state.registry && Array.isArray(state.registry.plugins) ? state.registry.plugins : []).slice().sort((a, b) => {
        const ai = state.installed.has(a.name) ? 1 : 0
        const bi = state.installed.has(b.name) ? 1 : 0
        return ai - bi
      })
      const meta = state.registry ? ("共 " + plugins.length + " 个插件 · 目录更新于 " + (state.registry.updated || "")) : ""

      return React.createElement("div", { className: "hm-root" },
        React.createElement("div", { className: "hm-head" },
          React.createElement("span", { className: "hm-title" }, "鸿蒙市场 · HarmonyOS Market"),
          React.createElement("span", { className: "hm-meta" }, meta),
          React.createElement("button", { className: "hm-btn", onClick: () => void load(), disabled: state.status === "loading" },
            state.status === "loading" ? React.createElement("span", { className: "hm-spin" }) : "刷新",
          ),
        ),
        state.error
          ? React.createElement("div", { className: "hm-banner error" },
              "目录拉取失败：" + state.error + "（检查网络或 dsh-harmonyos-market 仓库 plugins.json）",
            )
          : null,
        state.status === "ready" && plugins.length === 0
          ? React.createElement("div", { className: "hm-empty" }, "目录为空 — 等待社区贡献插件条目（看 CONTRIBUTING.md）")
          : null,
        React.createElement("div", { className: "hm-list" },
          plugins.map((plugin) => React.createElement(PluginCard, {
            key: plugin.name,
            plugin,
            installed: state.installed,
            busy: state.busy,
            result: state.result,
            onAction: act,
            onRestart: restart,
          })),
        ),
        state.status === "loading" && !state.registry
          ? React.createElement("div", { className: "hm-empty" }, "正在加载目录…")
          : null,
      )
    }

    function apply(ctx) {
      const slots = ctx.get("slots")
      if (slots === undefined) return
      const injected = () => ({})
      slots.inject("settings.section", () => {
        const dispose = slots.register({
          name: "settings.section",
          id: "dsh-harmonyos-market",
          order: 40,
          label: "鸿蒙市场 · HarmonyOS Market",
          inject: injected,
        }, MarketSection)
        return () => dispose()
      })
    }

    exports.apply = apply
    exports.inject = ["slots"]
    return module.exports
  },
})
