import { ref, computed } from "vue"
import { TriangleAlert } from "lucide-vue-next"

import {
  PRESET_ENVIRONMENTS,
  createEnvironmentRecordDraft,
  deleteEnvironment,
  getEnvironmentsByProjectIds,
  getProjectEnvironments,
  upsertEnvironment,
} from "@/services/project/environment-repository"
import { useConfirm } from "@/services/ui/confirm"
import { showToast } from "@/services/ui/toast"
import { useAppStore } from "@/stores/app"
import type { DeployEnvironmentRecord, EnvironmentFormValue, ProjectRecord } from "@/types/task"
import { formatEnvironmentLabel, getEnvironmentIcon } from "./utils"
import type { Ref } from "vue"

interface UseEnvironmentManagerOptions {
  selectedProjectId: Ref<string | null>
  latestScannedProject: Ref<ProjectRecord | null>
  servers: Ref<any[]>
}

export function useEnvironmentManager(options: UseEnvironmentManagerOptions) {
  const appStore = useAppStore()
  const confirm = useConfirm()

  const { selectedProjectId, latestScannedProject, servers } = options

  const projectEnvironments = ref<DeployEnvironmentRecord[]>([])
  const projectEnvironmentsMap = ref<Map<string, DeployEnvironmentRecord[]>>(new Map())
  const environmentDraft = ref<EnvironmentFormValue | null>(null)
  const selectedEnvironmentName = ref<string | null>(null)
  const isEnvironmentEditorVisible = ref(false)
  const environmentEditorMode = ref<"create" | "edit">("edit")
  const isCheckingEnvironment = ref(false)

  const environmentCards = computed(() => {
    const cards = [...PRESET_ENVIRONMENTS].map((name) => {
      const matched = projectEnvironments.value.find((environment) => environment.name === name) ?? null
      const server = matched ? (servers.value.find((item) => item.id === matched.serverId) ?? null) : null

      return {
        configured: Boolean(matched),
        deletable: false,
        icon: getEnvironmentIcon(name),
        label: formatEnvironmentLabel(name),
        name,
        preset: true,
        remotePathLabel: matched?.remotePath?.trim() || "还没有设置部署目录",
        serverLabel: server ? `${server.name} / ${server.host}:${server.port}` : "还没有绑定服务器",
      }
    })

    const customCards = projectEnvironments.value
      .filter((environment) => !PRESET_ENVIRONMENTS.includes(environment.name as (typeof PRESET_ENVIRONMENTS)[number]))
      .map((environment) => {
        const server = servers.value.find((item) => item.id === environment.serverId) ?? null

        return {
          configured: true,
          deletable: true,
          icon: getEnvironmentIcon(environment.name),
          label: environment.name,
          name: environment.name,
          preset: false,
          remotePathLabel: environment.remotePath?.trim() || "还没有设置部署目录",
          serverLabel: server ? `${server.name} / ${server.host}:${server.port}` : "还没有绑定服务器",
        }
      })

    return [...cards, ...customCards]
  })

  const executionEnvironmentOptions = computed(() => {
    const options = projectEnvironments.value
      .filter((environment) => environment.enabled)
      .map((environment) => ({
        label: formatEnvironmentLabel(environment.name),
        value: environment.name,
      }))

    if (options.length === 0) {
      return [{ label: "当前无配置环境", value: "" }]
    }

    return options
  })

  const isPresetEnvironment = computed(() =>
    environmentDraft.value ? PRESET_ENVIRONMENTS.includes(environmentDraft.value.name as (typeof PRESET_ENVIRONMENTS)[number]) : false,
  )

  function toEnvironmentDraft(environment: DeployEnvironmentRecord): EnvironmentFormValue {
    return {
      name: environment.name,
      serverId: environment.serverId,
      remotePath: environment.remotePath,
      deployMode: environment.deployMode ?? "build-and-deploy",
      uploadStrategy: environment.uploadStrategy,
      postDeployCommand: environment.postDeployCommand,
      enabled: environment.enabled,
    }
  }

  async function refreshProjectEnvironmentMap(projectIds?: string[]) {
    const ids = projectIds ?? []
    projectEnvironmentsMap.value = await getEnvironmentsByProjectIds(ids)
  }

  async function refreshProjectEnvironmentMapWithData(projectIds: string[]) {
    projectEnvironmentsMap.value = await getEnvironmentsByProjectIds(projectIds)
  }

  async function refreshProjectEnvironments(projectId: string) {
    projectEnvironments.value = await getProjectEnvironments(projectId)
    projectEnvironmentsMap.value = new Map(projectEnvironmentsMap.value)
    projectEnvironmentsMap.value.set(projectId, [...projectEnvironments.value])
  }

  async function loadEnvironmentDraft(projectId: string, projects: ProjectRecord[]) {
    await refreshProjectEnvironments(projectId)
    const currentProject = projects.find((project) => project.id === projectId) ?? latestScannedProject.value
    const preferredName = "dev"
    const selectedEnvironment =
      projectEnvironments.value.find((environment) => environment.name === preferredName) ??
      projectEnvironments.value.find((environment) => environment.name === "test") ??
      projectEnvironments.value.find((environment) => environment.name === "prod") ??
      null

    selectedEnvironmentName.value = selectedEnvironment?.name ?? preferredName
    environmentDraft.value = selectedEnvironment ? toEnvironmentDraft(selectedEnvironment) : createEnvironmentRecordDraft(preferredName)

    if (
      environmentDraft.value &&
      !environmentDraft.value.serverId &&
      currentProject?.defaultDeployServerIdByEnv?.[environmentDraft.value.name]
    ) {
      environmentDraft.value.serverId = currentProject.defaultDeployServerIdByEnv[environmentDraft.value.name] ?? ""
    }
  }

  async function syncEnvironmentByName(environmentName: string, projects?: ProjectRecord[]) {
    if (!selectedProjectId.value) {
      return
    }

    await refreshProjectEnvironments(selectedProjectId.value)
    const matchedEnvironment = projectEnvironments.value.find((environment) => environment.name === environmentName) ?? null
    const projectList = projects ?? []
    const currentProject = projectList.find((project) => project.id === selectedProjectId.value) ?? latestScannedProject.value

    selectedEnvironmentName.value = environmentName
    environmentDraft.value = matchedEnvironment ? toEnvironmentDraft(matchedEnvironment) : createEnvironmentRecordDraft(environmentName)

    if (
      environmentDraft.value &&
      !environmentDraft.value.serverId &&
      currentProject?.defaultDeployServerIdByEnv?.[environmentDraft.value.name]
    ) {
      environmentDraft.value.serverId = currentProject.defaultDeployServerIdByEnv[environmentDraft.value.name] ?? ""
    }
  }

  function handleCreateEnvironment() {
    environmentEditorMode.value = "create"
    selectedEnvironmentName.value = null
    environmentDraft.value = createEnvironmentRecordDraft("")
    isEnvironmentEditorVisible.value = true
    appStore.setBannerMessage("已打开新建环境面板")
  }

  async function handleSelectEnvironment(name: string) {
    if (!selectedProjectId.value) {
      return
    }

    environmentEditorMode.value = "edit"
    selectedEnvironmentName.value = name
    await syncEnvironmentByName(name, [])
    isEnvironmentEditorVisible.value = true
    appStore.setBannerMessage(`已载入环境：${name}`)
  }

  function handleCloseEnvironmentEditor() {
    isEnvironmentEditorVisible.value = false
    environmentEditorMode.value = "edit"
    appStore.setBannerMessage("已关闭环境编辑面板")
  }

  function handleResetEnvironmentDraft() {
    if (!environmentDraft.value) {
      return
    }

    environmentDraft.value = {
      ...environmentDraft.value,
      name: "",
      serverId: "",
      remotePath: "",
      deployMode: "build-and-deploy",
      uploadStrategy: "overwrite",
      postDeployCommand: "",
      enabled: false,
    }

    appStore.setBannerMessage("已清空当前环境表单")
    showToast("当前环境配置已重置", "success")
  }

  async function handleSaveEnvironment(projects: ProjectRecord[], updateProjectConfig: (p: ProjectRecord) => Promise<ProjectRecord[]>) {
    if (!selectedProjectId.value || !environmentDraft.value) {
      return
    }

    if (!environmentDraft.value.name.trim()) {
      showToast("请先填写环境名称", "warning")
      return
    }

    try {
      await upsertEnvironment(selectedProjectId.value, environmentDraft.value)
      await refreshProjectEnvironments(selectedProjectId.value)
      selectedEnvironmentName.value = environmentDraft.value.name
      const currentProject = projects.find((project) => project.id === selectedProjectId.value) ?? null

      if (currentProject) {
        const nextProject: ProjectRecord = {
          ...currentProject,
          defaultDeployServerIdByEnv: {
            ...(currentProject.defaultDeployServerIdByEnv ?? {}),
            [environmentDraft.value.name]: environmentDraft.value.serverId,
          },
        }

        const updatedProjects = await updateProjectConfig(nextProject)
        if (Array.isArray(updatedProjects) && updatedProjects.length > 0) {
          latestScannedProject.value = updatedProjects.find((project) => project.id === selectedProjectId.value) ?? nextProject
        } else {
          latestScannedProject.value = nextProject
        }
      }

      const environmentLabel = formatEnvironmentLabel(environmentDraft.value.name)
      appStore.setBannerMessage(`已保存 ${environmentLabel} 配置`)
      showToast(`${environmentLabel} 配置已保存`, "success")
      isEnvironmentEditorVisible.value = false
      // 注意：此处不再调用 refreshProjectEnvironmentMap()。
      // 上面的 refreshProjectEnvironments(selectedProjectId.value) 已增量更新
      // projectEnvironmentsMap 中当前项目的条目，并保留了其他项目的数据。
      // 无参调用 refreshProjectEnvironmentMap() 会因 getEnvironmentsByProjectIds([])
      // 返回空 Map 而清空整个环境映射，导致返回卡片列表后环境标签全部消失。
    } catch (error) {
      const message = error instanceof Error ? error.message : "环境配置保存失败"
      showToast(message, "error")
    }
  }

  async function handleDeleteEnvironment() {
    if (!selectedProjectId.value || !environmentDraft.value?.name) {
      return
    }

    const environmentName = environmentDraft.value.name
    await deleteEnvironment(selectedProjectId.value, environmentName)
    await refreshProjectEnvironments(selectedProjectId.value)

    isEnvironmentEditorVisible.value = false
    selectedEnvironmentName.value = null
    environmentDraft.value = null

    appStore.setBannerMessage(`已删除环境：${environmentName}`)
    showToast("环境已删除", "success")
    // 同上：refreshProjectEnvironments 已增量更新 map，不再无参调用清空整个映射
  }

  function handleConfirmDeleteEnvironment() {
    if (!environmentDraft.value?.name) {
      return
    }

    const environmentName = environmentDraft.value.name
    confirm.require({
      message: `删除后将移除环境配置 "${environmentName}"。这个操作不会删除服务器记录。`,
      header: "确认删除环境",
      icon: TriangleAlert,
      rejectLabel: "取消",
      acceptLabel: "删除",
      acceptClass: "p-button-danger",
      accept: () => {
        void handleDeleteEnvironment()
      },
    })
  }

  function handleConfirmDeleteEnvironmentByName(name: string) {
    confirm.require({
      message: `删除后将移除环境配置 "${name}"。这个操作不会删除服务器记录。`,
      header: "确认删除环境",
      icon: TriangleAlert,
      rejectLabel: "取消",
      acceptLabel: "删除",
      acceptClass: "p-button-danger",
      accept: () => {
        selectedEnvironmentName.value = name
        environmentDraft.value = createEnvironmentRecordDraft(name)
        void handleDeleteEnvironment()
      },
    })
  }

  return {
    projectEnvironments,
    projectEnvironmentsMap,
    environmentDraft,
    selectedEnvironmentName,
    isEnvironmentEditorVisible,
    environmentEditorMode,
    isCheckingEnvironment,
    environmentCards,
    executionEnvironmentOptions,
    isPresetEnvironment,
    refreshProjectEnvironmentMap,
    refreshProjectEnvironmentMapWithData,
    refreshProjectEnvironments,
    loadEnvironmentDraft,
    syncEnvironmentByName,
    handleCreateEnvironment,
    handleSelectEnvironment,
    handleCloseEnvironmentEditor,
    handleResetEnvironmentDraft,
    handleSaveEnvironment,
    handleDeleteEnvironment,
    handleConfirmDeleteEnvironment,
    handleConfirmDeleteEnvironmentByName,
    formatEnvironmentLabel,
  }
}
