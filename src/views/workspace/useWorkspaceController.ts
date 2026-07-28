import { watch, onMounted, onBeforeUnmount, ref } from "vue";
import { TriangleAlert } from "lucide-vue-next";

import { getTaskHistory, deleteTaskHistoryRecord } from "@/services/task-history/repository";
import { runServerConnectionCheck } from "@/services/execution/connection-check";
import { showToast } from "@/services/ui/toast";
import { useConfirm } from "@/services/ui/confirm";
import { useAppStore } from "@/stores/app";
import type { ProjectRecord, TaskHistoryRecord, TaskHistoryStatus } from "@/types/task";
import { useProjectManager } from "./useWorkspace/useProjectManager";
import { useEnvironmentManager } from "./useWorkspace/useEnvironmentManager";
import { useServerManager } from "./useWorkspace/useServerManager";
import { useQuickDeploy } from "./useWorkspace/useQuickDeploy";
import { useLogs } from "./useWorkspace/useLogs";
import { useDeployLogFilter } from "./useWorkspace/useDeployLogFilter";

export function useWorkspaceController() {
  const appStore = useAppStore();
  const confirm = useConfirm();

  appStore.setConnectionStatus("disconnected");

  const projectPathInput = ref("");
  const selectedProjectId = ref<string | null>(null);
  const latestScannedProject = ref<any>(null);
  const projectDraft = ref<any>(null);
  const taskHistoryRecords = ref<TaskHistoryRecord[]>([]);
  const deploymentHistoryRecords = ref<TaskHistoryRecord[]>([]);
  const selectedTaskHistoryId = ref<string | null>(null);

  const logs = useLogs();

  // Create a shared servers ref that both managers will use
  const sharedServers = ref<any[]>([]);

  const environmentManager = useEnvironmentManager({
    selectedProjectId,
    latestScannedProject,
    servers: sharedServers,
  });

  // projectManager 必须在 serverManager 之前创建，
  // 这样 serverManager 能直接拿到正确的 projects ref 和 environment 方法，
  // 避免"先传占位值再后续赋值"导致的闭包陷阱（内部解构的值不会更新）。
  const projectManager = useProjectManager({
    selectedProjectId,
    latestScannedProject,
    projectDraft,
    projectPathInput,
    environmentDraft: environmentManager.environmentDraft,
    selectedEnvironmentName: environmentManager.selectedEnvironmentName,
    isEnvironmentEditorVisible: environmentManager.isEnvironmentEditorVisible,
    taskHistoryRecords,
    selectedTaskHistoryId,
    projectEnvironments: environmentManager.projectEnvironments,
  });

  const serverManager = useServerManager({
    selectedProjectId,
    environmentDraft: environmentManager.environmentDraft,
    projectEnvironmentsMap: environmentManager.projectEnvironmentsMap,
    projects: projectManager.projects,
    loadEnvironmentDraft: async (projectId: string) => {
      await environmentManager.loadEnvironmentDraft(projectId, projectManager.projects.value);
    },
    refreshProjectEnvironmentMap: async () => {
      await environmentManager.refreshProjectEnvironmentMapWithData(projectManager.projects.value.map((p: any) => p.id));
    },
    pushServerLog: logs.pushLog,
  });

  // Keep the shared servers ref in sync with serverManager's servers
  watch(() => serverManager.servers.value, (newVal) => {
    sharedServers.value = newVal;
  }, { immediate: true });

  async function refreshTaskHistory(projectId?: string | null) {
    taskHistoryRecords.value = await getTaskHistory(projectId);
    selectedTaskHistoryId.value = taskHistoryRecords.value[0]?.id ?? null;
  }

  async function refreshDeploymentHistory() {
    deploymentHistoryRecords.value = await getTaskHistory();
  }

  async function handleDeleteDeploymentHistoryRecord(recordId: string) {
    const record = deploymentHistoryRecords.value.find((r) => r.id === recordId);
    const recordName = record ? `${record.projectName} - ${record.environmentName}` : "该记录";

    confirm.require({
      message: `确认删除该部署日志？此操作不可撤销。`,
      header: "确认删除",
      icon: TriangleAlert,
      rejectLabel: "取消",
      acceptLabel: "删除",
      acceptClass: "p-button-danger",
      accept: async () => {
        await deleteTaskHistoryRecord(recordId);
        await refreshDeploymentHistory();

        if (selectedProjectId.value) {
          await refreshTaskHistory(selectedProjectId.value);
        } else {
          await refreshTaskHistory();
        }

        showToast("部署日志已删除", "success");
      },
    });
  }

  const quickDeploy = useQuickDeploy({
    selectedProjectId,
    projects: projectManager.projects,
    servers: serverManager.servers,
    projectEnvironmentsMap: environmentManager.projectEnvironmentsMap,
    executionLogs: logs.logs,
    pushExecutionLog: logs.pushLog,
    refreshDeploymentHistory,
    refreshTaskHistory,
  });

  const deployLogFilter = useDeployLogFilter(deploymentHistoryRecords);

  function updateFilterProject(projectId: string | null) {
    deployLogFilter.filter.value.projectId = projectId;
  }

  function updateFilterEnvironment(environmentName: string | null) {
    deployLogFilter.filter.value.environmentName = environmentName;
  }

  function updateFilterStatus(status: TaskHistoryStatus | null) {
    deployLogFilter.filter.value.status = status;
  }

  async function handleSelectProject(projectId: string) {
    await projectManager.handleSelectProject(projectId);

    if (selectedProjectId.value === projectId && projectManager.projects.value.length > 0) {
      await environmentManager.loadEnvironmentDraft(projectId, projectManager.projects.value);
      await refreshTaskHistory(projectId);
    }
  }

  watch(() => (appStore as any).projectPanelTrigger, () => {
    if (appStore.activePanel === 'config') {
      selectedProjectId.value = null
    }
  })

  let prevPanel = appStore.activePanel

  watch(() => appStore.activePanel, (panel) => {
    if (panel === 'config' && prevPanel !== 'config') {
      selectedProjectId.value = null
    }
    prevPanel = panel
  })

  function handleNavigateProjectList() {
    selectedProjectId.value = null
  }

  /**
   * 重新从 storage 同步项目列表与环境映射，用于卡片列表的手动刷新。
   * 会保留当前选中项目（若仍存在），并刷新其环境数据。
   */
  async function handleRefreshProjectData() {
    await projectManager.refreshProjects();
    await environmentManager.refreshProjectEnvironmentMapWithData(
      projectManager.projects.value.map((p: any) => p.id)
    );
    if (selectedProjectId.value) {
      await environmentManager.loadEnvironmentDraft(
        selectedProjectId.value,
        projectManager.projects.value,
      );
    }
    showToast("已同步最新项目数据", "success");
  }

  /**
   * 重新从 storage 同步服务器列表与环境映射，用于服务器面板的手动刷新。
   */
  async function handleRefreshServerData() {
    await serverManager.refreshServers();
    await environmentManager.refreshProjectEnvironmentMapWithData(
      projectManager.projects.value.map((p: any) => p.id)
    );
    showToast("已同步最新服务器数据", "success");
  }

  onMounted(async () => {
    window.addEventListener('fastdeploy:navigate-project-list', handleNavigateProjectList)
    await projectManager.refreshProjects();
    await serverManager.refreshServers();
    await environmentManager.refreshProjectEnvironmentMapWithData(
      projectManager.projects.value.map((p: any) => p.id)
    );
    await refreshDeploymentHistory();

    if (selectedProjectId.value) {
      await environmentManager.loadEnvironmentDraft(selectedProjectId.value, projectManager.projects.value);
      await refreshTaskHistory(selectedProjectId.value);
    }
  });

  onBeforeUnmount(() => {
    window.removeEventListener('fastdeploy:navigate-project-list', handleNavigateProjectList)
  });

  return {
    appStore,
    projectPathInput,
    isImporting: projectManager.isImporting,
    importError: projectManager.importError,
    projects: projectManager.projects,
    latestScannedProject,
    selectedProjectId,
    projectDraft,
    environmentDraft: environmentManager.environmentDraft,
    selectedEnvironmentName: environmentManager.selectedEnvironmentName,
    isEnvironmentEditorVisible: environmentManager.isEnvironmentEditorVisible,
    environmentEditorMode: environmentManager.environmentEditorMode,
    isCheckingEnvironment: environmentManager.isCheckingEnvironment,
    servers: serverManager.servers,
    taskHistoryRecords,
    deploymentHistoryRecords,
    filteredDeploymentRecords: deployLogFilter.filteredRecords,
    deployLogFilter: deployLogFilter.filter,
    hasActiveDeployLogFilter: deployLogFilter.hasActiveFilter,
    resetDeployLogFilter: deployLogFilter.resetFilter,
    updateFilterProject,
    updateFilterEnvironment,
    updateFilterStatus,
    selectedTaskHistoryId,
    isCreatingServer: serverManager.isCreatingServer,
    selectedServerId: serverManager.selectedServerId,
    serverDraft: serverManager.serverDraft,
    quickDeployProjectId: quickDeploy.quickDeployProjectId,
    quickDeployEnvironmentName: quickDeploy.quickDeployEnvironmentName,
    quickDeployStage: quickDeploy.quickDeployStage,
    quickDeployMessage: quickDeploy.quickDeployMessage,
    quickDeployLogs: quickDeploy.quickDeployLogs,
    projectSummaries: projectManager.projectSummaries,
    quickDeployOptionsByProject: quickDeploy.quickDeployOptionsByProject,
    environmentCards: environmentManager.environmentCards,
    executionEnvironmentOptions: environmentManager.executionEnvironmentOptions,
    isPresetEnvironment: environmentManager.isPresetEnvironment,
    workspacePanelKey: projectManager.workspacePanelKey,
    copyLogs: logs.copyLogs,
    formatEnvironmentLabel: environmentManager.formatEnvironmentLabel,
    hasQuickDeployOptions: quickDeploy.hasQuickDeployOptions,
    handlePickDirectory: projectManager.handlePickDirectory,
    handleSelectProject,
    openProjectDeleteDialog: projectManager.openProjectDeleteDialog,
    handleBackToProjectList: projectManager.handleBackToProjectList,
    handleSaveProjectConfig: projectManager.handleSaveProjectConfig,
    handleRefreshProjectData,
    handleRefreshServerData,
    handleCheckEnvironment: async () => {
      if (!environmentManager.environmentDraft.value) {
        showToast("请先选择一个项目环境", "warning");
        return;
      }
      if (!environmentManager.environmentDraft.value.serverId) {
        showToast("请先为当前环境绑定服务器", "warning");
        return;
      }
      if (!environmentManager.environmentDraft.value.remotePath.trim()) {
        showToast("请先填写远端部署目录", "warning");
        return;
      }

      const server = serverManager.servers.value.find((item) => item.id === environmentManager.environmentDraft.value?.serverId) ?? null;

      if (!server) {
        showToast("当前环境绑定的服务器不存在，请重新选择", "error");
        return;
      }

      const envLabel = environmentManager.formatEnvironmentLabel(environmentManager.environmentDraft.value.name);
      logs.pushLog("info", `开始检测环境 ${envLabel} 的远端目录权限`);
      environmentManager.isCheckingEnvironment.value = true;

      try {
        const result = await runServerConnectionCheck({
          authType: server.authType,
          host: server.host,
          password: server.password,
          port: server.port,
          privateKeyPath: server.privateKeyPath,
          remotePath: environmentManager.environmentDraft.value.remotePath,
          username: server.username,
        });

        result.steps.forEach((step) => logs.pushLog("info", step));
        logs.pushLog("success", `环境 ${envLabel} 连接与目录检测通过`);
        appStore.setBannerMessage(`${envLabel} 检测通过`);
        showToast(`${envLabel} 检测通过`, "success");
      } catch (error) {
        const message = error instanceof Error ? error.message : "环境连接检测失败";
        logs.pushLog("error", message);
        appStore.setBannerMessage(message);
        showToast(message, "error");
      } finally {
        environmentManager.isCheckingEnvironment.value = false;
      }
    },
    handleCloseEnvironmentEditor: environmentManager.handleCloseEnvironmentEditor,
    handleCreateEnvironment: environmentManager.handleCreateEnvironment,
    handleConfirmDeleteEnvironment: environmentManager.handleConfirmDeleteEnvironment,
    handleConfirmDeleteEnvironmentByName: environmentManager.handleConfirmDeleteEnvironmentByName,
    handleResetEnvironmentDraft: environmentManager.handleResetEnvironmentDraft,
    handleSaveEnvironment: () =>
      environmentManager.handleSaveEnvironment(
        projectManager.projects.value,
        (project: ProjectRecord) => projectManager.handleSaveProjectConfig(project, { silent: true }),
      ),
    handleSelectEnvironment: environmentManager.handleSelectEnvironment,
    handleCheckServer: serverManager.handleCheckServer,
    handleCloseCreateServer: serverManager.handleCloseCreateServer,
    handleCreateServer: serverManager.handleCreateServer,
    handleConfirmDeleteServerById: serverManager.handleConfirmDeleteServerById,
    handleDeleteDeploymentHistoryRecord,
    handleSaveServer: serverManager.handleSaveServer,
    handleSelectServer: serverManager.handleSelectServer,
    startQuickDeploy: quickDeploy.startQuickDeploy,
  };
}
