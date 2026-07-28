<template>
  <section class="project-page">
    <article class="project-list-page">
      <WorkspaceToolbarPanel>
        <template #search>
          <div class="workspace-list-search-field">
            <Search class="workspace-list-search-icon h-4 w-4" />
            <InputText
              :model-value="searchKeyword"
              class="pl-[38px]"
              placeholder="搜索项目名称、本地路径..."
              @update:model-value="searchKeyword = String($event ?? '')"
            />
          </div>
        </template>

        <template #actions>
          <Button variant="secondary" :loading="isImporting" @click="$emit('pick-directory')">
            <Plus class="h-4 w-4" />
            <span>导入项目</span>
          </Button>
        </template>
      </WorkspaceToolbarPanel>

      <Alert v-if="importError" :variant="resolveAlertVariant('error')" :class="resolveAlertToneClass('error')">
        {{ importError }}
      </Alert>

      <section v-if="projects.length > 0" class="project-library-section">
        <header class="project-section-header">
          <h2>项目</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            class="section-refresh-button"
            :class="{ 'is-refreshing': isRefreshing }"
            :title="isRefreshing ? '正在同步...' : '同步最新数据'"
            :aria-label="isRefreshing ? '正在同步' : '同步最新数据'"
            :disabled="isRefreshing"
            @click.stop="handleRefresh"
          >
            <RefreshCw class="h-4 w-4" :class="{ 'refresh-spinning': isRefreshing }" aria-hidden="true" />
          </Button>
        </header>

        <div v-if="filteredProjects.length > 0" class="project-card-list">
          <ResourceCard
            v-for="project in filteredProjects"
            :key="project.id"
            :description="project.path"
            :title="project.name"
            @select="$emit('select-project', project.id)"
          >
            <template #icon>
              <img class="project-icon-image" :src="projectFolderIcon" alt="" aria-hidden="true" />
            </template>

            <template #meta>
              <div class="project-card-deploy-actions">
                <template v-if="getDeployOptions(project.id).length > 0">
                  <button
                    v-for="option in getDeployOptions(project.id)"
                    :key="option.environment.name"
                    class="deploy-env-tag"
                    :class="[getDeployTagTheme(option.environment.name), getDeployButtonClass(project.id, option.environment.name)]"
                    :disabled="isDeployingOther(project.id, option.environment.name) || isAborting(project.id, option.environment.name)"
                    :title="isDeploying(project.id, option.environment.name) ? '点击中止部署' : `部署到${formatEnvironmentLabel(option.environment.name)}`"
                    @click.stop="handleDeployTagClick(project.id, option)"
                  >
                    <Loader2 v-if="isAborting(project.id, option.environment.name)" class="h-3 w-3 deploy-spinning" />
                    <Ban v-else-if="isDeploying(project.id, option.environment.name)" class="h-3 w-3 deploy-abort-icon" />
                    <Send v-else class="h-3 w-3" />
                    <span>{{ formatEnvironmentLabel(option.environment.name) }}</span>
                  </button>
                </template>
                <button
                  v-else
                  class="deploy-env-setup-tag"
                  @click.stop="$emit('select-project', project.id)"
                >
                  <Plus class="h-3 w-3" />
                  <span>配置环境</span>
                </button>
              </div>
            </template>

            <template #actions>
              <Button
                variant="ghost"
                size="icon-sm"
                title="删除项目"
                class="delete-project-button"
                @click.stop="$emit('delete-project', project.id)"
              >
                <Trash2 class="h-4 w-4" aria-hidden="true" />
              </Button>
            </template>
          </ResourceCard>
        </div>

        <section v-else class="project-search-empty">
          <p>没有匹配的项目</p>
          <small>试试搜索项目名称或本地路径。</small>
        </section>
      </section>

      <Empty v-else class="project-empty-state border-0">
        <EmptyMedia>
          <FolderOpen class="project-empty-icon" :size="48" />
        </EmptyMedia>
        <EmptyContent>
          <EmptyTitle class="project-empty-title">暂无项目</EmptyTitle>
          <EmptyDescription class="project-empty-desc">点击上方「导入项目」开始使用</EmptyDescription>
        </EmptyContent>
      </Empty>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { Ban, FolderOpen, Loader2, Plus, RefreshCw, Search, Send, Trash2 } from "lucide-vue-next"

import Alert from "@/components/ui/alert/Alert.vue"
import Button from "@/components/ui/button/Button.vue"
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input as InputText } from "@/components/ui/input"
import ResourceCard from "@/components/ResourceCard.vue"
import WorkspaceToolbarPanel from "@/components/workspace-header/WorkspaceToolbarPanel.vue"
import projectFolderIcon from "@/assets/images/folder.png"
import { useDeploymentProgress } from "@/services/ui/deployment-progress"
import { showToast } from "@/services/ui/toast"
import { resolveAlertToneClass, resolveAlertVariant } from "@/lib/ui-status"

import { formatEnvironmentLabel } from "./formatters"
import type { QuickDeployEnvironmentOption } from "./types"
import type { WorkspaceProjectListItem } from "./types"

const emit = defineEmits<{
  "delete-project": [projectId: string]
  "pick-directory": []
  "refresh": []
  "select-project": [projectId: string]
  "start-quick-deploy": [option: QuickDeployEnvironmentOption]
}>()

const props = defineProps<{
  deployStage: "confirm" | "running" | "success" | "error" | "canceled"
  deployingEnvironmentName: string | null
  deployingProjectId: string | null
  importError: string
  isImporting: boolean
  projects: WorkspaceProjectListItem[]
  quickDeployOptions: Map<string, QuickDeployEnvironmentOption[]>
}>()

const deploymentProgress = useDeploymentProgress()
const abortingTaskId = ref<string | null>(null)
const isRefreshing = ref(false)

const searchKeyword = ref("")
const filteredProjects = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()

  if (!keyword) {
    return props.projects
  }

  return props.projects.filter((project) => {
    return [project.name, project.path].some((field) => field.toLowerCase().includes(keyword))
  })
})

function getDeployOptions(projectId: string): QuickDeployEnvironmentOption[] {
  return props.quickDeployOptions.get(projectId) ?? []
}

function isDeploying(projectId: string, environmentName: string): boolean {
  return props.deployStage === "running" && props.deployingProjectId === projectId && props.deployingEnvironmentName === environmentName
}

function isDeployingOther(projectId: string, environmentName: string): boolean {
  if (props.deployStage !== "running") return false
  return !(props.deployingProjectId === projectId && props.deployingEnvironmentName === environmentName)
}

/** 当前项目+环境是否处于中止中（本地 loading 态） */
function isAborting(projectId: string, environmentName: string): boolean {
  if (!abortingTaskId.value) return false
  const task = deploymentProgress.tasks.find((t) => t.id === abortingTaskId.value)
  return !!task && task.projectId === projectId && task.environmentName === environmentName
}

/** 从全局任务列表中查找运行中的 taskId */
function findRunningTaskId(projectId: string, environmentName: string): string | null {
  const task = deploymentProgress.tasks.find(
    (t) => t.projectId === projectId && t.environmentName === environmentName && t.stage === "running",
  )
  return task?.id ?? null
}

/** 部署按钮点击：运行中则中止，否则发起部署 */
function handleDeployTagClick(projectId: string, option: QuickDeployEnvironmentOption) {
  if (isDeploying(projectId, option.environment.name)) {
    handleAbortDeploy(projectId, option.environment.name)
    return
  }
  // 中止中不允许发起新部署
  if (isAborting(projectId, option.environment.name)) return
  // 其他项目的部署进行中也不允许
  if (isDeployingOther(projectId, option.environment.name)) return
  emit("start-quick-deploy", option)
}

/** 中止当前项目+环境的部署任务 */
async function handleAbortDeploy(projectId: string, environmentName: string) {
  const taskId = findRunningTaskId(projectId, environmentName)
  if (!taskId) {
    showToast("任务可能已结束，无法中止", "warning")
    return
  }
  if (abortingTaskId.value) return
  abortingTaskId.value = taskId
  try {
    const success = await deploymentProgress.cancelTask(taskId)
    if (!success) {
      showToast("任务可能已结束，无法中止", "warning")
    }
  } finally {
    setTimeout(() => {
      if (abortingTaskId.value === taskId) {
        abortingTaskId.value = null
      }
    }, 1500)
  }
}

function getDeployButtonClass(projectId: string, environmentName: string): string {
  if (props.deployingProjectId !== projectId || props.deployingEnvironmentName !== environmentName) return ""
  if (props.deployStage === "success") return "deploy-tag-success"
  if (props.deployStage === "error") return "deploy-tag-error"
  if (props.deployStage === "canceled") return "deploy-tag-canceled"
  return ""
}

function getDeployTagTheme(environmentName: string): string {
  if (environmentName === "prod") return "deploy-tag-prod"
  return "deploy-tag-test"
}

/** 点击标题行刷新按钮：同步最新项目与环境数据 */
async function handleRefresh() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    emit("refresh")
  } finally {
    // 给一个最小展示时长，避免图标闪过；实际刷新由父级异步完成
    setTimeout(() => {
      isRefreshing.value = false
    }, 600)
  }
}
</script>

<style scoped>
.project-page {
  grid-column: 1 / -1;
  position: relative;
}

.project-list-page {
  display: grid;
  gap: 18px;
  grid-column: 1 / -1;
}

.workspace-list-search-field {
  position: relative;
  width: 100%;
}

.workspace-list-search-icon {
  position: absolute;
  top: 50%;
  left: 14px;
  color: var(--text-muted);
  transform: translateY(-50%);
  pointer-events: none;
}

.project-library-section {
  display: grid;
  gap: 14px;
}

.project-section-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
}

.project-section-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
  letter-spacing: 0;
}

.section-refresh-button {
  color: var(--text-muted);
}

.section-refresh-button:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.section-refresh-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.refresh-spinning {
  animation: refresh-spin 0.9s linear infinite;
}

@keyframes refresh-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.project-card-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  max-width: 860px;
}

.project-icon-image {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.project-card-deploy-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* === 部署环境标签按钮 === */
.deploy-env-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--card-border);
  border-radius: 4px;
  background: var(--surface);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 160ms ease;
}

.deploy-env-tag:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.deploy-env-tag:hover:not(:disabled) {
  background: var(--surface-hover);
  border-color: var(--text-muted);
  color: var(--text-primary);
}

/* 测试环境 */
.deploy-tag-test {
  border-color: var(--info);
  color: var(--info);
}

.deploy-tag-test:hover:not(:disabled) {
  background: var(--info-tint);
  border-color: var(--info);
  color: var(--info);
}

/* 生产环境 */
.deploy-tag-prod {
  border-color: var(--warning);
  color: var(--warning-soft);
}

.deploy-tag-prod:hover:not(:disabled) {
  background: var(--warning-tint);
  border-color: var(--warning);
  color: var(--warning-soft);
}

/* 部署成功 */
.deploy-tag-success {
  border-color: var(--success-soft) !important;
  color: var(--success-soft) !important;
  background: var(--success-tint) !important;
}

/* 部署失败 */
.deploy-tag-error {
  border-color: var(--danger-soft) !important;
  color: var(--danger-soft) !important;
  background: var(--danger-tint) !important;
}

/* 部署已中止 */
.deploy-tag-canceled {
  border-color: var(--text-muted) !important;
  color: var(--text-muted) !important;
  background: var(--surface-active) !important;
}

/* 运行中按钮的 Ban 中止图标（红色） */
.deploy-abort-icon {
  color: var(--destructive);
}

/* 旋转动画 */
.deploy-spinning {
  animation: deploy-spin 1s linear infinite;
}

@keyframes deploy-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* === 配置环境标签 === */
.deploy-env-setup-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  border: 1px dashed var(--card-border);
  border-radius: 4px;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 160ms ease;
}

.deploy-env-setup-tag:hover {
  border-color: var(--text-muted);
  color: var(--text-primary);
  background: var(--surface-hover);
}

.delete-project-button {
  color: var(--danger-soft);
}

.delete-project-button:hover {
  background: var(--danger-tint);
  color: var(--danger-soft);
}

.project-search-empty {
  display: grid;
  gap: 6px;
  padding: 18px 16px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-hover);
}

.project-search-empty p,
.project-search-empty small {
  margin: 0;
}

.project-search-empty p {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
}

.project-search-empty small {
  color: var(--text-muted);
  line-height: 1.6;
}

.project-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 400px;
  padding: 40px;
}

.project-empty-icon {
  color: var(--text-muted);
}

.project-empty-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
}

.project-empty-desc {
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
}

@media (max-width: 680px) {
  .project-card-list {
    grid-template-columns: 1fr;
  }
}
</style>
