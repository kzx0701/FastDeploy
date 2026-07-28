import { reactive, computed } from "vue"

import { abortBuild } from "@/services/execution/abort"

export type DeploymentTaskStage = "running" | "success" | "error" | "canceled"

export interface DeploymentTask {
  id: string
  projectId: string
  projectName: string
  environmentName: string
  environmentLabel: string
  serverName: string
  serverHost: string
  remotePath: string
  stage: DeploymentTaskStage
  message: string
  progress: number
  startedAt: string
  finishedAt: string | null
  dismissed: boolean
}

const tasks = reactive<DeploymentTask[]>([])

const runningTasks = computed(() => tasks.filter((t) => t.stage === "running"))
const runningCount = computed(() => runningTasks.value.length)
const hasRunning = computed(() => runningCount.value > 0)

function addTask(task: Omit<DeploymentTask, "dismissed">): string {
  const id = task.id || crypto.randomUUID()
  tasks.unshift({
    ...task,
    id,
    dismissed: false,
  })
  return id
}

function updateTask(id: string, updates: Partial<DeploymentTask>) {
  const task = tasks.find((t) => t.id === id)
  if (task) {
    Object.assign(task, updates)
  }
}

function dismissTask(id: string) {
  const task = tasks.find((t) => t.id === id)
  if (task) {
    task.dismissed = true
  }
}

function removeTask(id: string) {
  const index = tasks.findIndex((t) => t.id === id)
  if (index !== -1) {
    tasks.splice(index, 1)
  }
}

function clearFinished() {
  for (let i = tasks.length - 1; i >= 0; i--) {
    if (tasks[i].stage !== "running") {
      tasks.splice(i, 1)
    }
  }
}

/**
 * 中止运行中的部署任务（仅支持打包阶段）
 * 调用后端 abort_build 命令设置中止标志，实际的 stage 更新由 executeDeploy catch 块完成
 * 返回 true 表示成功设置中止标志
 */
async function cancelTask(id: string): Promise<boolean> {
  const task = tasks.find((t) => t.id === id)
  if (!task || task.stage !== "running") {
    return false
  }

  try {
    const success = await abortBuild(id)
    if (!success) {
      // 任务可能已结束，由 executeDeploy 正常处理
      return false
    }
    return true
  } catch (error) {
    console.error("[deployment-progress] 中止部署任务失败:", error)
    return false
  }
}

export function useDeploymentProgress() {
  return {
    tasks,
    runningTasks,
    runningCount,
    hasRunning,
    addTask,
    updateTask,
    dismissTask,
    removeTask,
    clearFinished,
    cancelTask,
  }
}
