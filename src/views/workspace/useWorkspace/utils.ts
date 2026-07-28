import { Globe2, ShieldCheck, Compass } from "lucide-vue-next"

import { formatEnvironmentLabel, formatUploadStrategyLabel } from "../formatters"

export function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (typeof error === "string" && error.trim()) {
    return error
  }

  if (isObjectRecord(error)) {
    if (typeof error.message === "string" && error.message.trim()) {
      return error.message
    }

    if (typeof error.error === "string" && error.error.trim()) {
      return error.error
    }

    try {
      return JSON.stringify(error)
    } catch {
      return fallback
    }
  }

  return fallback
}

export function isLikelyNetworkPermissionPrompt(message: string) {
  const normalized = message.toLowerCase()

  return (
    normalized.includes("no route to host") ||
    normalized.includes("network is unreachable") ||
    normalized.includes("os error 65") ||
    normalized.includes("couldn't connect to host")
  )
}

export function deferAfterPanelTransition() {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => {
      requestAnimationFrame(() => resolve())
    }, 280)
  })
}

/**
 * 从完整的 build 输出中提取简短的错误摘要，用于 toast/banner 显示。
 * 避免把超长 build 输出直接塞进 toast 导致用户无法查看。
 */
export function extractBuildErrorSummary(fullOutput: string): string {
  if (!fullOutput.trim()) return "打包失败，未获取到输出信息"

  const lines = fullOutput.split("\n")

  // 常见错误行模式
  const errorPatterns = [
    /^\s*error\s*:/i,
    /^\s*ERROR\s*:/i,
    /^\s*ERR!:/i,
    /^\s*ERR_PNPM_/,
    /^\s*✘/,
    /^\s*✗/,
    /^\s*Failed to compile/i,
    /^\s*Build failed/i,
    /^\s*fatal:/i,
    /error TS\d+:/i,
    /^\s*Error:\s/i,
  ]

  const errorLines: string[] = []
  for (const line of lines) {
    if (errorPatterns.some((p) => p.test(line))) {
      const trimmed = line.trim()
      if (trimmed && !errorLines.includes(trimmed)) {
        errorLines.push(trimmed)
      }
    }
  }

  if (errorLines.length > 0) {
    const summary = errorLines.slice(0, 3).join(" | ")
    return truncate(summary, 200)
  }

  // 无明确错误行时取末尾非空行
  const nonEmpty = lines.filter((l) => l.trim())
  const tail = nonEmpty.slice(-5)
  const summary = tail.join(" | ")
  return truncate(summary, 200) || "打包失败，请查看日志了解详情"
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + "..."
}

export { formatEnvironmentLabel, formatUploadStrategyLabel }

export function getEnvironmentIcon(name: string) {
  if (name === "test") return Globe2
  if (name === "prod") return ShieldCheck
  return Compass
}
