export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'unknown'
export type ProjectType =
  | 'vite-vue'
  | 'vite-react'
  | 'vue-cli'
  | 'react'
  | 'next'
  | 'nuxt'
  | 'astro'
  | 'sveltekit'
  | 'static-generator'
  | 'unknown'
export type AuthType = 'password' | 'privateKey'
export type UploadStrategy = 'overwrite' | 'clear-and-upload'
export type ExecutionMode = 'build' | 'deploy' | 'build-and-deploy'
export type ExecutionStatus = 'idle' | 'running' | 'success' | 'error'
export type TaskHistoryStatus = 'success' | 'error' | 'canceled'

export interface MonorepoPackage {
  name: string
  relativePath: string
  projectType: ProjectType
  buildCommand: string
  outputDir: string
}

export interface ProjectRecord {
  id: string
  name: string
  localPath: string
  projectType: ProjectType
  packageManager: PackageManager
  packageJsonPath: string
  scripts: Record<string, string>
  detectedBuildCommand?: string
  detectedOutputDir?: string
  defaultBuildCommand: string
  defaultOutputDir: string
  defaultPrecheckEnabled: boolean
  defaultPrecheckCommand: string
  defaultDeployServerIdByEnv?: Record<string, string>
  isMonorepo?: boolean
  monorepoPackages?: MonorepoPackage[]
  /** monorepo 子包相对路径（如 "apps/admin"），为空表示在根目录打包 */
  packagePath?: string
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
}

export interface ProjectScanResult {
  name: string
  localPath: string
  packageJsonPath: string
  projectType: ProjectType
  packageManager: PackageManager
  scripts: Record<string, string>
  detectedBuildCommand: string
  detectedOutputDir: string
  defaultBuildCommand: string
  defaultOutputDir: string
  isMonorepo: boolean
  monorepoPackages: MonorepoPackage[]
}

export interface ProjectAiContextFile {
  content: string
  path: string
}

export interface ProjectAiContext {
  files: ProjectAiContextFile[]
  packageJson: string
  projectPath: string
}

export interface ProjectAiRecommendation {
  confidence: 'high' | 'medium' | 'low'
  reason: string
  recommendedBuildCommand: string
  recommendedOutputDir: string
  alternatives: string[]
}

export interface DeployEnvironmentRecord {
  id: string
  projectId: string
  name: 'dev' | 'test' | 'prod' | string
  serverId: string
  remotePath: string
  deployMode: Extract<ExecutionMode, 'deploy' | 'build-and-deploy'>
  uploadStrategy: UploadStrategy
  postDeployCommand: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface EnvironmentFormValue {
  name: string
  serverId: string
  remotePath: string
  deployMode: Extract<ExecutionMode, 'deploy' | 'build-and-deploy'>
  uploadStrategy: UploadStrategy
  postDeployCommand: string
  enabled: boolean
}

export interface ServerRecord {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: AuthType
  password: string
  privateKeyPath: string
  createdAt: string
  updatedAt: string
}

export interface ServerFormValue {
  name: string
  host: string
  port: number
  username: string
  authType: AuthType
  password: string
  privateKeyPath: string
}

export interface ExecutionDraft {
  environmentName: string
  mode: ExecutionMode
  overrideBuildCommand: string
  overrideOutputDir: string
  runPrecheck: boolean
}

export interface ExecutionSummaryItem {
  label: string
  value: string
}

export interface TaskHistoryRecord {
  id: string
  projectId: string
  projectName: string
  environmentName: string
  mode: ExecutionMode
  status: TaskHistoryStatus
  buildCommand: string
  outputDir: string
  outputPath?: string
  serverName?: string
  serverHost?: string
  remotePath?: string
  startedAt: string
  finishedAt: string
  durationMs: number
  summary: string
  errorMessage?: string
  logs: string[]
}

export interface LocalBuildRequest {
  projectPath: string
  buildCommand: string
  outputDir: string
  precheckCommand: string
  runPrecheck: boolean
  buildTimeout: number
  taskId?: string
  packagePath?: string
}

export interface LocalBuildResult {
  buildCommand: string
  outputDir: string
  outputPath: string
  artifactVerified: boolean
  artifactResolvedBy: string
  artifactCandidates: string[]
  artifactMessage: string
  precheckCommand: string
  precheckOutput: string
  precheckRan: boolean
  precheckSuccess: boolean
  buildOutput: string
  success: boolean
  aborted?: boolean
}

export interface DeployExecutionContext {
  environmentName: string
  outputPath: string
  postDeployCommand: string
  projectName: string
  remotePath: string
  server: ServerRecord
  uploadStrategy: UploadStrategy
  sshTimeout: number
  deployTimeout: number
}

export interface ServerConnectionCheckRequest {
  authType: AuthType
  host: string
  password: string
  port: number
  privateKeyPath: string
  remotePath?: string
  username: string
}

export interface ServerConnectionCheckResult {
  success: boolean
  steps: string[]
}
