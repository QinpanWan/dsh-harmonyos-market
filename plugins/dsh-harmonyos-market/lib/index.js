// dsh-harmonyos-market host half.
// Serves the HarmonyOS plugin catalog to the browser settings panel and runs
// one-click install/uninstall through the same `dsh plugin` CLI that launched
// this host (same spawning strategy as the official dsh-market plugin).
import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings"
import z from "@deepseek-ai/schemastery"

export const name = "harmonyos-market"

export const MARKET_NS = settingsNamespace("dsh-harmonyos-market")
export const DEFAULT_REGISTRY_URL = "https://raw.githubusercontent.com/Entity-Him/dsh-harmonyos-market/main/plugins.json"
const CACHE_TTL_MS = 60_000
const COMMAND_TIMEOUT_MS = 10 * 60_000
const OUTPUT_LIMIT = 4000

export const MarketConfigSchema = z.object({
  allowRestart: z.boolean().default(true),
  registryUrl: z.string().default(DEFAULT_REGISTRY_URL),
  profile: z.string().default("web"),
})

function argvProfile() {
  const argv = process.argv
  const flag = argv.indexOf("--profile")
  if (flag !== -1 && flag + 1 < argv.length && !argv[flag + 1].startsWith("-")) return argv[flag + 1]
  return undefined
}

function nodeExecutable() {
  if (process.argv0 !== undefined && process.argv0 !== "" && isAbsolute(process.argv0) && existsSync(process.argv0)) {
    return process.argv0
  }
  return process.execPath
}

function dshArgv() {
  const entry = process.argv[1]
  if (entry !== undefined && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(entry)) {
    const abs = resolve(entry)
    return { file: nodeExecutable(), args: [...process.execArgv, abs], cwd: dirname(abs) }
  }
  return { file: "dsh", args: [], cwd: undefined }
}

function spawnEnv() {
  const separator = process.platform === "win32" ? ";" : ":"
  const parts = (process.env.PATH ?? "").split(separator).filter((part) => part !== "")
  const nodeDir = dirname(nodeExecutable())
  for (const bin of [nodeDir, join(homedir(), ".local", "bin")]) {
    if (!parts.includes(bin)) parts.push(bin)
  }
  return { ...process.env, CI: "true", PATH: parts.join(separator) }
}

function tail(text, max) {
  return text.length > max ? "…" + text.slice(-max) : text
}

function profileDir(profile) {
  const home = process.env.DSH_HOME ?? join(homedir(), ".dsh")
  return join(home, "profiles", profile)
}

function readProfileBundles(profile) {
  try {
    const manifest = JSON.parse(readFileSync(join(profileDir(profile), "package.json"), "utf8"))
    const bundles = manifest?.dsh?.profile?.bundles
    return Array.isArray(bundles) ? bundles.filter((item) => typeof item === "string") : []
  } catch {
    return []
  }
}

let registryCache = { at: 0, value: null }

async function loadRegistry(url) {
  const now = Date.now()
  if (registryCache.value !== null && now - registryCache.at < CACHE_TTL_MS) return registryCache.value
  const response = await fetch(url, { headers: { "user-agent": "dsh-harmonyos-market" } })
  if (!response.ok) throw new Error(`catalog fetch failed: HTTP ${response.status}`)
  const value = await response.json()
  registryCache = { at: now, value }
  return value
}

function specOf(entry) {
  const m = /(?:^|\s)add\s+(\S+)/.exec(entry.install ?? "")
  if (m !== null) return m[1]
  const repo = /github\.com\/([^/]+\/[^/]+?)(?:\/|$)/.exec(entry.url ?? "")
  return repo === null ? null : `github:${repo[1]}`
}

function allowedSpecs(registry) {
  const specs = new Set()
  for (const entry of registry?.plugins ?? []) {
    const spec = specOf(entry)
    if (spec !== null) specs.add(spec)
  }
  return specs
}

function runPluginCommand(profile, pluginArgs) {
  const { file, args, cwd } = dshArgv()
  return new Promise((resolvePromise) => {
    let child
    try {
      child = spawn(file, [...args, "plugin", "--profile", profile, ...pluginArgs], {
        cwd,
        env: spawnEnv(),
        stdio: ["ignore", "pipe", "pipe"],
      })
    } catch (error) {
      resolvePromise({ ok: false, code: -1, stdout: "", stderr: String(error?.message ?? error) })
      return
    }
    let stdout = ""
    let stderr = ""
    child.stdout?.on("data", (chunk) => { stdout += chunk })
    child.stderr?.on("data", (chunk) => { stderr += chunk })
    const timer = setTimeout(() => { child.kill("SIGKILL") }, COMMAND_TIMEOUT_MS)
    child.on("close", (code) => {
      clearTimeout(timer)
      resolvePromise({
        ok: code === 0,
        code: code ?? -1,
        stdout: tail(stdout, OUTPUT_LIMIT),
        stderr: tail(stderr, OUTPUT_LIMIT),
      })
    })
    child.on("error", (error) => {
      clearTimeout(timer)
      resolvePromise({ ok: false, code: -1, stdout: "", stderr: String(error?.message ?? error) })
    })
  })
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  })
  response.end(payload)
}

function readJsonBody(request) {
  return new Promise((resolvePromise) => {
    let raw = ""
    request.on("data", (chunk) => { raw += chunk })
    request.on("end", () => {
      try {
        resolvePromise(JSON.parse(raw))
      } catch {
        resolvePromise(null)
      }
    })
    request.on("error", () => resolvePromise(null))
  })
}

function trustedRestartRequest(request) {
  const address = request.socket?.remoteAddress
  if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") return false
  if (request.headers.forwarded !== undefined
    || request.headers["x-forwarded-for"] !== undefined
    || request.headers["x-real-ip"] !== undefined) return false
  const origin = request.headers.origin
  const host = request.headers.host
  if (origin === undefined || host === undefined) return false
  try {
    const parsed = new URL(origin)
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.host === host
  } catch {
    return false
  }
}

function mountRoutes(host, resolved) {
  const profile = resolved.profile ?? "web"
  const registryUrl = resolved.registryUrl ?? DEFAULT_REGISTRY_URL
  const disposers = []

  disposers.push(host.webServer.register({
    kind: "exact",
    path: "/dsh-harmonyos-market/registry",
    handler: async (_request, response) => {
      try {
        const registry = await loadRegistry(registryUrl)
        sendJson(response, 200, { registry })
      } catch (error) {
        sendJson(response, 502, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))

  disposers.push(host.webServer.register({
    kind: "exact",
    path: "/dsh-harmonyos-market/installed",
    handler: (_request, response) => {
      sendJson(response, 200, { installed: readProfileBundles(profile) })
    },
  }))

  disposers.push(host.webServer.register({
    kind: "exact",
    path: "/dsh-harmonyos-market/install",
    handler: async (request, response) => {
      try {
        const body = await readJsonBody(request)
        const name = typeof body?.name === "string" ? body.name : ""
        const registry = await loadRegistry(registryUrl)
        const entry = registry?.plugins?.find((plugin) => plugin.name === name)
        const spec = entry === undefined ? null : specOf(entry)
        if (spec === null || !allowedSpecs(registry).has(spec)) {
          sendJson(response, 400, { ok: false, error: "unknown plugin or unsafe install target" })
          return
        }
        const result = await runPluginCommand(profile, ["add", spec])
        sendJson(response, 200, { ok: result.ok, code: result.code, stdout: result.stdout, stderr: result.stderr })
      } catch (error) {
        sendJson(response, 502, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))

  disposers.push(host.webServer.register({
    kind: "exact",
    path: "/dsh-harmonyos-market/uninstall",
    handler: async (request, response) => {
      try {
        const body = await readJsonBody(request)
        const name = typeof body?.name === "string" ? body.name : ""
        const registry = await loadRegistry(registryUrl)
        const entry = registry?.plugins?.find((plugin) => plugin.name === name)
        if (entry === undefined) {
          sendJson(response, 400, { ok: false, error: "unknown plugin" })
          return
        }
        const result = await runPluginCommand(profile, ["remove", name])
        sendJson(response, 200, { ok: result.ok, code: result.code, stdout: result.stdout, stderr: result.stderr })
      } catch (error) {
        sendJson(response, 502, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }))

  disposers.push(host.webServer.register({
    kind: "exact",
    path: "/dsh-harmonyos-market/restart",
    handler: async (request, response) => {
      if (resolved.allowRestart === false) {
        sendJson(response, 403, { ok: false, error: "restart disabled by allowRestart=false" })
        return
      }
      if (!trustedRestartRequest(request)) {
        sendJson(response, 403, { ok: false, error: "untrusted restart request" })
        return
      }
      sendJson(response, 200, { ok: true, message: "restarting" })
      setTimeout(() => process.kill(process.pid, "SIGTERM"), 500)
    },
  }))

  return () => {
    for (const dispose of disposers) dispose()
  }
}

function installMarketSettings(ctx, resolved) {
  const entry = {
    allowRestart: resolved.allowRestart !== false,
    registryUrl: resolved.registryUrl ?? DEFAULT_REGISTRY_URL,
    profile: resolved.profile ?? "web",
  }
  let source = () => entry
  installSettingsSection(ctx, MARKET_NS, MarketConfigSchema, entry, {
    setSource: (current) => { source = current },
    onChange: () => { Object.assign(resolved, source()) },
  })
}

export function apply(ctx, config) {
  ctx.inject(["webServer", "loader"], (hostCtx) => {
    const host = hostCtx
    const resolved = {
      profile: config?.profile ?? argvProfile() ?? "web",
      allowRestart: config?.allowRestart ?? true,
      registryUrl: config?.registryUrl ?? DEFAULT_REGISTRY_URL,
    }
    installMarketSettings(ctx, resolved)
    host.effect(() => mountRoutes(host, resolved), "dsh-harmonyos-market: http routes")
  })
}
