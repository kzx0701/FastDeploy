import { loadProjects, saveProjects } from '@/services/storage/projects'
import type { ProjectRecord, ProjectScanResult } from '@/types/task'

function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `project_${Date.now()}`
}

function sortProjects(projects: ProjectRecord[]) {
  return [...projects].sort((left, right) => {
    const leftTime = left.createdAt ?? left.updatedAt
    const rightTime = right.createdAt ?? right.updatedAt

    return new Date(rightTime).getTime() - new Date(leftTime).getTime()
  })
}

export async function getProjects() {
  const projects = await loadProjects()
  return sortProjects(projects)
}

export async function upsertProject(scanResult: ProjectScanResult) {
  const projects = await loadProjects()
  const now = new Date().toISOString()
  const existing = projects.find((project) => project.localPath === scanResult.localPath)

  if (existing) {
    // monorepo 子包自动选择：如果只有一个可部署子包，自动设置 packagePath
    const monorepoPackages = scanResult.monorepoPackages
    const autoPackagePath =
      scanResult.isMonorepo && monorepoPackages.length === 1
        ? monorepoPackages[0].relativePath
        : ''

    // 如果已有 packagePath 且在新的子包列表中存在，保留用户选择
    const preservedPackagePath =
      existing.packagePath && monorepoPackages.some((p) => p.relativePath === existing.packagePath)
        ? existing.packagePath
        : autoPackagePath

    // 如果自动选择了子包，同时填充该子包的打包命令和产物目录
    let defaultBuildCommand = scanResult.defaultBuildCommand
    let defaultOutputDir = scanResult.defaultOutputDir
    if (preservedPackagePath) {
      const pkg = monorepoPackages.find((p) => p.relativePath === preservedPackagePath)
      if (pkg) {
        if (pkg.buildCommand.trim()) defaultBuildCommand = pkg.buildCommand
        if (pkg.outputDir.trim()) defaultOutputDir = pkg.outputDir
      }
    }

    const updated: ProjectRecord = {
      ...existing,
      // 保留用户自定义的项目名，不覆盖为扫描得到的目录名
      name: existing.name,
      packageJsonPath: scanResult.packageJsonPath,
      projectType: scanResult.projectType,
      packageManager: scanResult.packageManager,
      scripts: scanResult.scripts,
      detectedBuildCommand: scanResult.detectedBuildCommand,
      detectedOutputDir: scanResult.detectedOutputDir,
      defaultBuildCommand,
      defaultOutputDir,
      isMonorepo: scanResult.isMonorepo,
      monorepoPackages,
      packagePath: preservedPackagePath,
      updatedAt: now,
      lastUsedAt: now,
    }

    const nextProjects = projects.map((project) => (project.id === existing.id ? updated : project))
    await saveProjects(sortProjects(nextProjects))
    return updated
  }

  // monorepo 子包自动选择：如果只有一个可部署子包，自动设置 packagePath
  const monorepoPackages = scanResult.monorepoPackages
  const autoPackagePath =
    scanResult.isMonorepo && monorepoPackages.length === 1
      ? monorepoPackages[0].relativePath
      : ''

  let defaultBuildCommand = scanResult.defaultBuildCommand
  let defaultOutputDir = scanResult.defaultOutputDir
  if (autoPackagePath) {
    const pkg = monorepoPackages.find((p) => p.relativePath === autoPackagePath)
    if (pkg) {
      if (pkg.buildCommand.trim()) defaultBuildCommand = pkg.buildCommand
      if (pkg.outputDir.trim()) defaultOutputDir = pkg.outputDir
    }
  }

  const created: ProjectRecord = {
    id: generateId(),
    name: scanResult.name,
    localPath: scanResult.localPath,
    packageJsonPath: scanResult.packageJsonPath,
    projectType: scanResult.projectType,
    packageManager: scanResult.packageManager,
    scripts: scanResult.scripts,
    detectedBuildCommand: scanResult.detectedBuildCommand,
    detectedOutputDir: scanResult.detectedOutputDir,
    defaultBuildCommand,
    defaultOutputDir,
    defaultPrecheckEnabled: false,
    defaultPrecheckCommand: '',
    defaultDeployServerIdByEnv: {},
    isMonorepo: scanResult.isMonorepo,
    monorepoPackages,
    packagePath: autoPackagePath,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
  }

  const nextProjects = sortProjects([created, ...projects])
  await saveProjects(nextProjects)
  return created
}

export async function markProjectAsUsed(projectId: string) {
  const projects = await loadProjects()
  const now = new Date().toISOString()
  const nextProjects = projects.map((project) =>
    project.id === projectId
      ? {
          ...project,
          lastUsedAt: now,
          updatedAt: now,
        }
      : project,
  )

  await saveProjects(sortProjects(nextProjects))
  return sortProjects(nextProjects)
}

export async function deleteProject(projectId: string) {
  const projects = await loadProjects()
  const nextProjects = projects.filter((project) => project.id !== projectId)

  await saveProjects(sortProjects(nextProjects))
  return sortProjects(nextProjects)
}

export async function updateProjectConfig(project: ProjectRecord) {
  const projects = await loadProjects()
  const now = new Date().toISOString()
  const nextProjects = projects.map((item) =>
    item.id === project.id
      ? {
          ...project,
          updatedAt: now,
        }
      : item,
  )

  await saveProjects(sortProjects(nextProjects))
  return sortProjects(nextProjects)
}
