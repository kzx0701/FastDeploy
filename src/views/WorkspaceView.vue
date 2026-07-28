<template>
  <AppShell :content-class="workspaceContentClass">
    <PageTransition :transition-key="workspace.workspacePanelKey">
      <WorkspaceProjectListSection
        v-if="workspace.appStore.activePanel === 'config' && !workspace.selectedProjectId"
        :import-error="workspace.importError"
        :is-importing="workspace.isImporting"
        :projects="projectListItems"
        :quick-deploy-options="workspace.quickDeployOptionsByProject"
        :deploying-project-id="workspace.quickDeployProjectId"
        :deploying-environment-name="workspace.quickDeployEnvironmentName"
        :deploy-stage="workspace.quickDeployStage"
        @delete-project="workspace.openProjectDeleteDialog"
        @pick-directory="workspace.handlePickDirectory"
        @select-project="workspace.handleSelectProject"
        @start-quick-deploy="workspace.startQuickDeploy"
        @refresh="workspace.handleRefreshProjectData"
      />

      <WorkspaceProjectDetailSection
        v-else-if="workspace.appStore.activePanel === 'config'"
        :environment-cards="workspace.environmentCards"
        :environment-draft="workspace.environmentDraft"
        :environment-editor-mode="workspace.environmentEditorMode"
        :import-error="workspace.importError"
        :is-checking-environment="workspace.isCheckingEnvironment"
        :is-environment-editor-visible="workspace.isEnvironmentEditorVisible"
        :is-preset-environment="workspace.isPresetEnvironment"
        :project="workspace.latestScannedProject"
        :project-draft="workspace.projectDraft"
        :project-id="workspace.selectedProjectId"
        :servers="workspace.servers"
        @back-to-project-list="workspace.handleBackToProjectList"
        @check-environment="workspace.handleCheckEnvironment"
        @close-environment-editor="workspace.handleCloseEnvironmentEditor"
        @confirm-delete-environment="workspace.handleConfirmDeleteEnvironment"
        @confirm-delete-environment-by-name="workspace.handleConfirmDeleteEnvironmentByName"
        @delete-project="workspace.openProjectDeleteDialog"
        @create-environment="workspace.handleCreateEnvironment"
        @reset-environment-draft="workspace.handleResetEnvironmentDraft"
        @save-environment="workspace.handleSaveEnvironment"
        @save-project-config="workspace.handleSaveProjectConfig"
        @select-environment="workspace.handleSelectEnvironment"
        @update:environment-draft="workspace.environmentDraft = $event"
        @update:project-draft="workspace.projectDraft = $event"
      />

      <section v-else-if="workspace.appStore.activePanel === 'servers'" class="panel-grid">
        <ServerConfigPanel
          :is-creating="workspace.isCreatingServer"
          v-model="workspace.serverDraft"
          :selected-server-id="workspace.selectedServerId"
          :servers="workspace.servers"
          @check-server="workspace.handleCheckServer"
          @close-create="workspace.handleCloseCreateServer"
          @create-server="workspace.handleCreateServer"
          @delete-server-card="workspace.handleConfirmDeleteServerById"
          @refresh="workspace.handleRefreshServerData"
          @save-server="workspace.handleSaveServer"
          @select-server="workspace.handleSelectServer"
        />
      </section>

      <WorkspaceDeploymentLogsSection
        v-else-if="workspace.appStore.activePanel === 'deployLogs'"
        :records="workspace.deploymentHistoryRecords"
        :projects="projectListItems"
        :filter="workspace.deployLogFilter"
        :filtered-records="workspace.filteredDeploymentRecords"
        :has-active-filter="workspace.hasActiveDeployLogFilter"
        @delete-record="workspace.handleDeleteDeploymentHistoryRecord"
        @reset-filter="workspace.resetDeployLogFilter"
        @update:filter-project="workspace.updateFilterProject"
        @update:filter-environment="workspace.updateFilterEnvironment"
        @update:filter-status="workspace.updateFilterStatus"
      />

      <WorkspaceSettingsSection v-else />
    </PageTransition>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, proxyRefs } from "vue"

import ServerConfigPanel from "@/components/ServerConfigPanel.vue"
import AppShell from "@/layouts/AppShell.vue"
import PageTransition from "@/components/PageTransition.vue"

import WorkspaceDeploymentLogsSection from "./workspace/WorkspaceDeploymentLogsSection.vue"
import WorkspaceProjectDetailSection from "./workspace/WorkspaceProjectDetailSection.vue"
import WorkspaceProjectListSection from "./workspace/WorkspaceProjectListSection.vue"
import WorkspaceSettingsSection from "./workspace/WorkspaceSettingsSection.vue"
import { useWorkspaceController } from "./workspace/useWorkspaceController"

const workspace = proxyRefs(useWorkspaceController())

const workspaceContentClass = computed(() => {
  return `px-8 pt-0 pb-6 bg-background`
})

const projectListItems = computed(() =>
  workspace.projectSummaries.map((project) => ({
    ...project,
  })),
)
</script>
