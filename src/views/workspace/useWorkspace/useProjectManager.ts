import { ref, computed } from "vue"
import { TriangleAlert } from "lucide-vue-next"

import { pickProjectDirectory } from "@/services/project/pick"
import { deleteProject, getProjects, markProjectAsUsed, updateProjectConfig, upsertProject } from "@/services/project/repository"
import { scanProject } from "@/services/project/scan"
import { useConfirm } from "@/services/ui/confirm"
import { showToast } from "@/services/ui/toast"
import { useAppStore } from "@/stores/app"
import type { ProjectRecord } from "@/types/task"
import type { ProjectSummary } from "@/types/project"
import { getErrorMessage, deferAfterPanelTransition } from "./utils"
import type { Ref } from "vue"

interface UseProjectManagerOptions {
  selectedProjectId: Ref<string | null>
  latestScannedProject: Ref<ProjectRecord | null>
  projectDraft: Ref<ProjectRecord | null>
  projectPathInput: Ref<string>
  environmentDraft: Ref<any>
  selectedEnvironmentName: Ref<string | null>
  isEnvironmentEditorVisible: Ref<boolean>
  taskHistoryRecords: Ref<any[]>
  selectedTaskHistoryId: Ref<string | null>
  projectEnvironments: Ref<any[]>
}

export function useProjectManager(options: UseProjectManagerOptions) {
  const appStore = useAppStore()
  const confirm = useConfirm()

  const {
    selectedProjectId,
    latestScannedProject,
    projectDraft,
    projectPathInput,
    environmentDraft,
    selectedEnvironmentName,
    isEnvironmentEditorVisible,
    taskHistoryRecords,
    selectedTaskHistoryId,
    projectEnvironments,
  } = options

  const projects = ref<ProjectRecord[]>([])
  const isImporting = ref(false)
  const importError = ref("")

  const projectSummaries = computed<ProjectSummary[]>(() =>
    projects.value.map((project) => ({
      id: project.id,
      name: project.name,
      path: project.localPath,
      type: project.projectType,
      updatedAt: project.updatedAt,
    })),
  )

  const workspacePanelKey = computed(() => {
    if (appStore.activePanel === "config") {
      return selectedProjectId.value ? `project-detail:${selectedProjectId.value}` : "project-list"
    }
    return appStore.activePanel
  })

  async function refreshProjects() {
    projects.value = await getProjects()

    if (projects.value.length > 0) {
      const selected = selectedProjectId.value
        ? (projects.value.find((project) => project.id === selectedProjectId.value) ?? null)
        : null

      selectedProjectId.value = selected?.id ?? null
      latestScannedProject.value = selected
      projectDraft.value = selected ? { ...selected } : null
      appStore.setSelectedProjectName(selected?.name ?? "项目")
      appStore.setBannerMessage(`已载入 ${projects.value.length} 条项目记录`)
      projectPathInput.value = selected?.localPath ?? ""
    } else {
      selectedProjectId.value = null
      latestScannedProject.value = null
      projectDraft.value = null
      projectEnvironments.value = []
      environmentDraft.value = null
      selectedEnvironmentName.value = null
      isEnvironmentEditorVisible.value = false
      taskHistoryRecords.value = []
      selectedTaskHistoryId.value = null
      projectPathInput.value = ""
      appStore.setSelectedProjectName("未选择项目")
      appStore.setBannerMessage("等待导入项目")
    }
  }

  async function handleImport() {
    importError.value = ""
    isImporting.value = true
    let importedProjectName = ""

    try {
      const scanResult = await scanProject(projectPathInput.value)
      const project = await upsertProject(scanResult)

      selectedProjectId.value = null
      await refreshProjects()
      appStore.setSelectedProjectName("项目")
      appStore.setBannerMessage(`已导入项目：${project.name}`)
      importedProjectName = project.name
    } catch (error) {
      importError.value = getErrorMessage(error, "项目导入失败")
      appStore.setBannerMessage("项目导入失败，请检查路径和 package.json")
    } finally {
      isImporting.value = false
    }

    return importedProjectName
  }

  async function handlePickDirectory() {
    try {
      const selectedPath = await pickProjectDirectory()

      if (!selectedPath) {
        return
      }

      projectPathInput.value = selectedPath
      const importedProjectName = await handleImport()

      if (importedProjectName) {
        showToast(`项目 ${importedProjectName} 导入成功`, "success")
      }
    } catch (error) {
      importError.value = getErrorMessage(error, "目录选择失败")
      appStore.setBannerMessage("目录选择失败")
    }
  }

  async function handleSelectProject(projectId: string) {
    const selected = projects.value.find((project) => project.id === projectId)

    if (!selected) {
      return
    }

    selectedProjectId.value = projectId
    latestScannedProject.value = selected
    projectDraft.value = { ...selected }
    projectPathInput.value = selected.localPath
    appStore.setSelectedProjectName(selected.name)
    appStore.setBannerMessage(`已切换到 ${selected.name}`)

    await deferAfterPanelTransition()

    if (selectedProjectId.value !== projectId) {
      return
    }

    projects.value = await markProjectAsUsed(projectId)
    latestScannedProject.value = projects.value.find((project) => project.id === projectId) ?? selected
    projectDraft.value = latestScannedProject.value ? { ...latestScannedProject.value } : null
  }

  async function handleDeleteProject(projectId: string) {
    const deleted = projects.value.find((project) => project.id === projectId)

    projects.value = await deleteProject(projectId)

    if (selectedProjectId.value === projectId) {
      selectedProjectId.value = null
    }

    if (deleted) {
      appStore.setBannerMessage(`已删除项目：${deleted.name}`)
      showToast(`项目 ${deleted.name} 已删除`, "success")
    }

    await refreshProjects()
  }

  function openProjectDeleteDialog(projectId: string) {
    const project = projects.value.find((item) => item.id === projectId)

    if (!project) {
      return
    }

    confirm.require({
      message: `删除后会移除应用中的项目 "${project.name}"，不会删除你的本地源码。`,
      header: "确认删除项目",
      icon: TriangleAlert,
      rejectLabel: "取消",
      acceptLabel: "删除",
      acceptClass: "p-button-danger",
      accept: () => {
        void handleDeleteProject(projectId)
      },
    })
  }

  function handleBackToProjectList() {
    selectedProjectId.value = null
    appStore.setSelectedProjectName("项目")
    appStore.setBannerMessage("已返回项目列表")

    void deferAfterPanelTransition().then(() => {
      if (selectedProjectId.value) {
        return
      }

      latestScannedProject.value = null
      projectEnvironments.value = []
      projectDraft.value = null
      environmentDraft.value = null
      selectedEnvironmentName.value = null
      isEnvironmentEditorVisible.value = false
      taskHistoryRecords.value = []
      selectedTaskHistoryId.value = null
      projectPathInput.value = ""
    })
  }

  async function handleSaveProjectConfig(projectOverride?: ProjectRecord, options?: { silent?: boolean }): Promise<ProjectRecord[]> {
    const projectToSave = projectOverride ?? projectDraft.value
    if (!projectToSave) {
      return projects.value
    }

    projects.value = await updateProjectConfig(projectToSave)
    latestScannedProject.value = projects.value.find((project) => project.id === projectToSave.id) ?? null
    projectDraft.value = latestScannedProject.value ? { ...latestScannedProject.value } : null

    if (!options?.silent) {
      appStore.setBannerMessage(`已保存项目配置：${projectDraft.value?.name ?? ""}`)
      showToast("项目配置已保存", "success")
    }

    return projects.value
  }

  return {
    projects,
    isImporting,
    importError,
    projectSummaries,
    workspacePanelKey,
    refreshProjects,
    handleImport,
    handlePickDirectory,
    handleSelectProject,
    handleDeleteProject,
    openProjectDeleteDialog,
    handleBackToProjectList,
    handleSaveProjectConfig,
  }
}
