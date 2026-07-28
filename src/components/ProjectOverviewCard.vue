<template>
  <article class="panel-card overview-card">
    <template v-if="modelValue && project">
      <header class="overview-head">
        <div class="overview-head-main">
          <h3>项目概览</h3>
          <button
            type="button"
            class="overview-advanced-toggle"
            :aria-expanded="showAdvanced"
            :aria-label="showAdvanced ? '收起高级配置' : '展开高级配置'"
            @click="showAdvanced = !showAdvanced"
          >
            <span>高级配置</span>
            <ChevronDown class="h-4 w-4" :class="{ 'rotate-180': showAdvanced }" />
          </button>
        </div>

        <div class="overview-meta" aria-label="项目标识">
          <span>{{ project.projectType || "未知类型" }}</span>
          <span>{{ project.packageManager || "未知包管理器" }}</span>
          <span>{{ scriptCount }} 个脚本</span>
          <span v-if="project.isMonorepo" class="overview-meta-monorepo">Monorepo</span>
        </div>
      </header>

      <section class="overview-summary" aria-label="项目摘要">
        <div class="summary-column">
          <div class="summary-row">
            <span class="summary-label">项目名称</span>
            <div class="summary-field">
              <template v-if="editingField === 'name'">
                <div class="summary-editor">
                  <InputText
                    :model-value="localDraft.name"
                    class="summary-input"
                    placeholder="请输入项目名称"
                    @update:model-value="updateTextField('name', $event)"
                  />
                  <div class="summary-editor-actions">
                    <Button type="button" variant="ghost" size="icon-sm" title="保存" aria-label="保存项目名称" class="summary-action-confirm" @click="commitField">
                      <Check class="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" title="取消" aria-label="取消编辑项目名称" @click="cancelEditing">
                      <X class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </template>
              <template v-else>
                <strong class="summary-value">{{ displayName }}</strong>
                <button
                  type="button"
                  class="summary-action summary-edit-button"
                  title="编辑项目名称"
                  aria-label="编辑项目名称"
                  @click="startEditing('name')"
                >
                  <Pencil class="h-4 w-4" />
                </button>
              </template>
            </div>
          </div>

          <div class="summary-row">
            <span class="summary-label">默认打包命令</span>
            <div class="summary-field">
              <template v-if="editingField === 'defaultBuildCommand'">
                <div class="summary-editor">
                  <InputText
                    :model-value="localDraft.defaultBuildCommand"
                    class="summary-input"
                    @update:model-value="updateTextField('defaultBuildCommand', $event)"
                  />
                  <div class="summary-editor-actions">
                    <Button type="button" variant="ghost" size="icon-sm" title="保存" aria-label="保存默认打包命令" class="summary-action-confirm" @click="commitField">
                      <Check class="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" title="取消" aria-label="取消编辑默认打包命令" @click="cancelEditing">
                      <X class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </template>
              <template v-else>
                <strong class="summary-value">{{ displayBuildCommand }}</strong>
                <button
                  type="button"
                  class="summary-action summary-edit-button"
                  title="编辑默认打包命令"
                  aria-label="编辑默认打包命令"
                  @click="startEditing('defaultBuildCommand')"
                >
                  <Pencil class="h-4 w-4" />
                </button>
              </template>
            </div>
          </div>

          <div class="summary-row">
            <span class="summary-label">默认产物目录</span>
            <div class="summary-field">
              <template v-if="editingField === 'defaultOutputDir'">
                <div class="summary-editor">
                  <InputText
                    :model-value="localDraft.defaultOutputDir"
                    class="summary-input"
                    @update:model-value="updateTextField('defaultOutputDir', $event)"
                  />
                  <div class="summary-editor-actions">
                    <Button type="button" variant="ghost" size="icon-sm" title="保存" aria-label="保存默认产物目录" @click="commitField">
                      <Check class="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" title="取消" aria-label="取消编辑默认产物目录" @click="cancelEditing">
                      <X class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </template>
              <template v-else>
                <strong class="summary-value">{{ displayOutputDir }}</strong>
                <button
                  type="button"
                  class="summary-action summary-edit-button"
                  title="编辑默认产物目录"
                  aria-label="编辑默认产物目录"
                  @click="startEditing('defaultOutputDir')"
                >
                  <Pencil class="h-4 w-4" />
                </button>
              </template>
            </div>
          </div>

          <div class="summary-row summary-row-path">
            <span class="summary-label">本地路径</span>
            <strong class="summary-value summary-path">{{ project.localPath }}</strong>
          </div>

          <div v-if="localDraft.isMonorepo && localDraft.monorepoPackages && localDraft.monorepoPackages.length > 0" class="summary-row">
            <span class="summary-label">子包路径</span>
            <div class="summary-field">
              <Select
                :model-value="localDraft.packagePath || 'root'"
                @update:model-value="handlePackagePathChange"
              >
                <SelectTrigger class="summary-select">
                  <SelectValue placeholder="选择子包（根目录）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">
                    根目录（不指定子包）
                  </SelectItem>
                  <SelectItem
                    v-for="pkg in localDraft.monorepoPackages"
                    :key="pkg.relativePath"
                    :value="pkg.relativePath"
                  >
                    {{ pkg.relativePath }}（{{ pkg.name }}）
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div class="summary-column summary-column-compact">
          <div class="summary-row">
            <span class="summary-label">执行前检查</span>
            <div class="summary-field">
              <strong class="summary-value">{{ localDraft.defaultPrecheckEnabled ? "已启用" : "未启用" }}</strong>
              <button
                type="button"
                class="summary-action summary-edit-button"
                :title="localDraft.defaultPrecheckEnabled ? '关闭执行前检查' : '启用执行前检查'"
                :aria-label="localDraft.defaultPrecheckEnabled ? '关闭执行前检查' : '启用执行前检查'"
                @click="togglePrecheck"
              >
                <Pencil class="h-4 w-4" />
              </button>
            </div>
          </div>

        </div>
      </section>

      <section v-if="showAdvanced" class="overview-advanced" aria-label="项目高级配置">
        <div class="summary-column summary-column-advanced">
          <div class="summary-row">
            <span class="summary-label">检查命令</span>
            <div class="summary-field">
              <template v-if="editingField === 'defaultPrecheckCommand'">
                <div class="summary-editor">
                  <InputText
                    :model-value="localDraft.defaultPrecheckCommand"
                    class="summary-input"
                    @update:model-value="updateTextField('defaultPrecheckCommand', $event)"
                  />
                  <div class="summary-editor-actions">
                    <Button type="button" variant="ghost" size="icon-sm" title="保存" aria-label="保存检查命令" @click="commitField">
                      <Check class="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" title="取消" aria-label="取消编辑检查命令" @click="cancelEditing">
                      <X class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </template>
              <template v-else>
                <strong class="summary-value">{{ displayPrecheckCommand }}</strong>
                <button
                  type="button"
                  class="summary-action summary-edit-button"
                  title="编辑检查命令"
                  aria-label="编辑检查命令"
                  @click="startEditing('defaultPrecheckCommand')"
                >
                  <Pencil class="h-4 w-4" />
                </button>
              </template>
            </div>
          </div>
        </div>
      </section>
    </template>

    <section v-else class="overview-empty" aria-label="空项目概览">
      <div class="overview-empty-icon" aria-hidden="true">
        <Compass class="h-5 w-5" />
      </div>
      <div class="overview-empty-copy">
        <h3>项目概览</h3>
      </div>
    </section>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { Check, ChevronDown, Compass, Pencil, X } from "lucide-vue-next"
import { Input as InputText } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ProjectRecord } from "@/types/task"

type EditableField = "name" | "defaultBuildCommand" | "defaultOutputDir" | "defaultPrecheckCommand"

const props = defineProps<{
  modelValue: ProjectRecord | null
  project: ProjectRecord | null
}>()

const emit = defineEmits<{
  "update:modelValue": [value: ProjectRecord | null]
}>()

const editingField = ref<EditableField | null>(null)
const showAdvanced = ref(false)
const localDraft = ref<ProjectRecord>({
  id: "",
  name: "",
  localPath: "",
  projectType: "unknown",
  packageManager: "unknown",
  packageJsonPath: "",
  scripts: {},
  defaultBuildCommand: "",
  defaultOutputDir: "",
  defaultPrecheckEnabled: false,
  defaultPrecheckCommand: "",
  isMonorepo: false,
  monorepoPackages: [],
  packagePath: "",
  createdAt: "",
  updatedAt: "",
})

watch(
  () => props.modelValue,
  (value) => {
    if (!value) {
      editingField.value = null
      return
    }

    localDraft.value = { ...value }
  },
  { immediate: true, deep: true },
)

const scriptCount = computed(() => Object.keys(props.project?.scripts ?? {}).length)

const displayBuildCommand = computed(() => localDraft.value.defaultBuildCommand?.trim() || props.project?.detectedBuildCommand?.trim() || "未配置")
const displayOutputDir = computed(() => localDraft.value.defaultOutputDir?.trim() || props.project?.detectedOutputDir?.trim() || "未配置")
const displayPrecheckCommand = computed(() => localDraft.value.defaultPrecheckCommand?.trim() || "未配置")
const displayName = computed(() => localDraft.value.name?.trim() || props.project?.name?.trim() || "未命名")

function startEditing(field: EditableField) {
  editingField.value = field

  if (field === "defaultPrecheckCommand") {
    showAdvanced.value = true
  }
}

function cancelEditing() {
  editingField.value = null

  if (props.modelValue) {
    localDraft.value = { ...props.modelValue }
  }
}

function commitField() {
  editingField.value = null
  emit("update:modelValue", { ...localDraft.value })
}

function updateTextField(field: EditableField, value: string | undefined) {
  localDraft.value = {
    ...localDraft.value,
    [field]: value ?? "",
  }
}

function togglePrecheck() {
  localDraft.value = {
    ...localDraft.value,
    defaultPrecheckEnabled: !localDraft.value.defaultPrecheckEnabled,
  }

  emit("update:modelValue", { ...localDraft.value })
}

/**
 * monorepo 子包切换：自动填充该子包的打包命令和产物目录
 * "root" 是为了规避 reka-ui SelectItem 不允许空字符串 value 的限制，
 * 实际持久化时映射回空字符串，表示根目录。
 */
function handlePackagePathChange(relativePath: string | number | undefined) {
  const rawPath = relativePath === undefined ? "" : String(relativePath)
  const actualPath = rawPath === "root" ? "" : rawPath
  const next: ProjectRecord = {
    ...localDraft.value,
    packagePath: actualPath,
  }

  // 选择子包时，自动填充该子包检测到的打包命令和产物目录
  if (actualPath && next.monorepoPackages) {
    const pkg = next.monorepoPackages.find((p) => p.relativePath === actualPath)
    if (pkg) {
      if (pkg.buildCommand.trim()) {
        next.defaultBuildCommand = pkg.buildCommand
      }
      if (pkg.outputDir.trim()) {
        next.defaultOutputDir = pkg.outputDir
      }
    }
  }

  localDraft.value = next
  emit("update:modelValue", { ...next })
}
</script>

<style scoped>
.overview-card {
  grid-column: 1 / -1;
  width: 100%;
  gap: 16px;
  padding: 24px;
}

.overview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.overview-head-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.overview-head h3,
.summary-value,
.overview-empty-copy h3 {
  margin: 0;
}

.summary-label {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: 0;
}

.overview-head h3 {
  color: var(--text-primary);
  font-family: var(--font-heading);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
  letter-spacing: 0;
}

.overview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.overview-meta span {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-hover);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.4;
  white-space: nowrap;
}

.overview-summary {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(240px, 0.7fr);
  gap: 16px;
  min-width: 0;
}

.summary-column {
  display: grid;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
  background: var(--surface);
}

.summary-column-compact {
  background: var(--surface-hover);
}

.summary-column-advanced {
  background: var(--surface-hover);
}

.summary-row {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  height: 60px;
  min-width: 0;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}

.summary-row:last-child {
  border-bottom: 0;
}

.summary-row-path {
  height: auto;
  min-height: 60px;
}

.summary-field {
  display: contents;
}

.summary-value {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.summary-path {
  grid-column: 2 / -1;
  white-space: normal;
  word-break: break-word;
}

.summary-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  grid-column: 2 / -1;
  min-height: 28px;
  min-width: 0;
}

.summary-editor-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.summary-input {
  width: 100%;
  height: 32px;
  min-height: 32px;
  padding-block: 0;
  font-size: 14px;
}

.summary-edit-button {
  border-color: transparent;
  background: transparent;
}

.summary-edit-button:hover {
  border-color: transparent;
  background: transparent;
  color: var(--info);
}

/* monorepo 子包选择器 */
.summary-select {
  width: 100%;
  height: 32px;
  min-height: 32px;
  font-size: 14px;
}

/* Monorepo 标识徽章 */
.overview-meta-monorepo {
  border-color: transparent;
  background: var(--info-tint, color-mix(in srgb, var(--info) 12%, transparent));
  color: var(--info);
  font-weight: 600;
}

.summary-action-confirm {
  color: var(--success);
}

.summary-action-confirm:hover {
  color: var(--success-soft);
}

.overview-advanced {
  display: grid;
}

.overview-advanced-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background-color 140ms ease,
    color 140ms ease,
    border-color 140ms ease;
}

.overview-advanced-toggle:hover {
  border-color: var(--border);
  background: var(--surface-hover);
  color: var(--text-primary);
}

.overview-advanced-toggle svg {
  transition: transform 140ms ease;
}

.overview-empty {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
}

.overview-empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-active);
  color: var(--text-primary);
}

.overview-empty-copy {
  display: grid;
  gap: 6px;
}

.overview-empty-copy h3 {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
}

@media (max-width: 860px) {
  .overview-head,
  .overview-summary {
    grid-template-columns: 1fr;
    display: grid;
  }

  .overview-head-main {
    flex-wrap: wrap;
  }

  .overview-meta {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .overview-card {
    padding: 18px;
  }

  .summary-row {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 0;
    gap: 4px;
  }

  .summary-value {
    white-space: normal;
    word-break: break-word;
  }

  .summary-editor {
    grid-column: auto;
    grid-template-columns: 1fr;
  }

  .summary-path {
    grid-column: auto;
  }
}
</style>
