import type { Component } from "vue"

import type { ProjectSummary } from "@/types/project"
import type { DeployEnvironmentRecord, ProjectRecord, ServerRecord } from "@/types/task"

export type QuickDeployEnvironmentOption = {
  environment: DeployEnvironmentRecord
  project: ProjectRecord
  server: ServerRecord | null
}

export type WorkspaceEnvironmentCard = {
  configured: boolean
  deletable: boolean
  icon: Component
  label: string
  name: string
  preset: boolean
  remotePathLabel: string
  serverLabel: string
}

export type WorkspaceProjectListItem = ProjectSummary
