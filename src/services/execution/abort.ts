import { invoke } from '@tauri-apps/api/core'

import { isTauriRuntime } from '@/services/project/runtime'

/**
 * 中止指定 task_id 的打包任务
 * 仅支持打包阶段（build-and-deploy 模式下 build 完成前）
 * 返回 true 表示成功设置中止标志，false 表示任务不存在（可能已结束）
 */
export async function abortBuild(taskId: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    throw new Error('当前为浏览器开发模式，暂不支持中止打包任务。')
  }

  const result = await invoke<boolean>('abort_build', { taskId })
  return result
}
