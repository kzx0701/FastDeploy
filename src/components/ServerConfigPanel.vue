<template>
  <div class="server-page">
    <article class="server-list-page">
      <WorkspaceToolbarPanel>
        <template #search>
          <div class="server-search-field">
            <Search class="server-search-icon h-4 w-4" />
            <InputText
              :model-value="searchKeyword"
              class="pl-[38px]"
              placeholder="搜索服务器名称、主机或用户名..."
              @update:model-value="searchKeyword = String($event ?? '')"
            />
          </div>
        </template>

        <template #actions>
          <Button variant="secondary" @click="$emit('create-server')">
            <Plus class="h-4 w-4" />
            <span>新增服务器</span>
          </Button>
        </template>
      </WorkspaceToolbarPanel>

      <section v-if="servers.length > 0" class="server-library-section">
        <header class="server-section-header">
          <h2>服务器</h2>
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

        <div v-if="filteredServers.length > 0" class="server-card-list">
          <ResourceCard
            v-for="server in filteredServers"
            :key="server.id"
            :description="`${server.host}:${server.port}，${server.username}`"
            :title="server.name"
            @select="$emit('select-server', server.id)"
          >
            <template #icon>
              <Server class="h-5 w-5" aria-hidden="true" />
            </template>

            <template #meta>
              <Badge variant="outline" class="server-auth-badge" :data-auth-type="server.authType">
                <KeyRound v-if="server.authType === 'password'" class="h-3 w-3" aria-hidden="true" />
                <ShieldCheck v-else class="h-3 w-3" aria-hidden="true" />
                {{ server.authType === "password" ? "密码认证" : "私钥认证" }}
              </Badge>
            </template>

            <template #actions>
              <Button
                variant="ghost"
                size="icon-sm"
                title="删除服务器"
                aria-label="删除服务器"
                class="delete-server-button"
                @click.stop="$emit('delete-server-card', server.id)"
              >
                <Trash2 class="h-4 w-4" aria-hidden="true" />
              </Button>
            </template>
          </ResourceCard>
        </div>

        <div v-else class="server-search-empty">
          <p>没有匹配的服务器</p>
          <small>试试搜索名称、主机地址或用户名。</small>
        </div>
      </section>

      <Empty v-else class="server-empty-state border-0">
        <EmptyMedia>
          <Server class="server-empty-icon" :size="48" />
        </EmptyMedia>
        <EmptyContent>
          <EmptyTitle class="server-empty-title">暂无服务器</EmptyTitle>
          <EmptyDescription class="server-empty-desc">点击上方「新增服务器」开始使用</EmptyDescription>
        </EmptyContent>
      </Empty>
    </article>

    <Drawer :open="isCreating" direction="right" dismissible modal @update:open="handleDrawerOpenChange">
      <DrawerContent
        class="create-drawer server-create-drawer border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-none"
      >
        <DrawerHeader class="server-create-header">
          <div class="server-create-head-copy">
            <p class="drawer-eyebrow">{{ editorMode === "edit" ? "编辑服务器" : "新增服务器" }}</p>
            <DrawerTitle>{{ editorMode === "edit" ? "编辑服务器配置" : "填写服务器配置" }}</DrawerTitle>
          </div>
        </DrawerHeader>

        <div class="server-create-scroll">
          <section class="server-create-section">
            <div class="server-create-section-head">
              <span class="server-create-section-index">01</span>
              <h4>基础信息</h4>
            </div>

            <div class="server-create-section-card">
              <div class="create-form-grid">
                <Field class="server-create-field">
                  <FieldLabel class="server-create-field-label">服务器名称</FieldLabel>
                  <FieldContent class="server-create-field-content">
                    <InputText
                      :model-value="modelValue.name"
                      class="w-full"
                      placeholder="例如：生产服务器"
                      @update:model-value="updateText('name', $event)"
                    />
                  </FieldContent>
                </Field>

                <div class="create-form-row">
                  <Field class="server-create-field">
                    <FieldLabel class="server-create-field-label">认证方式</FieldLabel>
                    <FieldContent class="server-create-field-content">
                      <Select :model-value="modelValue.authType" @update:model-value="updateText('authType', $event)">
                        <SelectTrigger class="w-full">
                          <SelectValue placeholder="请选择认证方式" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem v-for="option in authTypeOptions" :key="option.value" :value="option.value">
                            {{ option.label }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldContent>
                  </Field>

                  <Field class="server-create-field server-create-field-compact">
                    <FieldLabel class="server-create-field-label">SSH 端口</FieldLabel>
                    <FieldContent class="server-create-field-content">
                      <InputText
                        :model-value="String(modelValue.port || 22)"
                        class="w-full"
                        inputmode="numeric"
                        @update:model-value="updatePort($event)"
                      />
                    </FieldContent>
                  </Field>
                </div>

                <Field class="server-create-field">
                  <FieldLabel class="server-create-field-label">SSH 主机</FieldLabel>
                  <FieldContent class="server-create-field-content">
                    <InputText
                      :model-value="modelValue.host"
                      class="w-full"
                      placeholder="例如：192.168.1.20"
                      @update:model-value="updateText('host', $event)"
                    />
                  </FieldContent>
                </Field>
              </div>
            </div>
          </section>

          <section class="server-create-section">
            <div class="server-create-section-head">
              <span class="server-create-section-index">02</span>
              <h4>登录凭据</h4>
            </div>

            <div class="server-create-section-card">
              <div class="create-form-grid">
                <Field class="server-create-field">
                  <FieldLabel class="server-create-field-label">用户名</FieldLabel>
                  <FieldContent class="server-create-field-content">
                    <InputText
                      :model-value="modelValue.username"
                      class="w-full"
                      placeholder="例如：root"
                      @update:model-value="updateText('username', $event)"
                    />
                  </FieldContent>
                </Field>

                <Field v-if="modelValue.authType === 'password'" class="server-create-field">
                  <FieldLabel class="server-create-field-label">密码</FieldLabel>
                  <FieldContent class="server-create-field-content">
                    <div class="password-field">
                      <InputText
                        :model-value="modelValue.password"
                        :type="showPassword ? 'text' : 'password'"
                        class="w-full pr-11"
                        placeholder="输入服务器密码"
                        @update:model-value="updateText('password', $event)"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="password-toggle"
                        :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                        @click="showPassword = !showPassword"
                      >
                        <EyeOff v-if="showPassword" class="h-4 w-4" />
                        <Eye v-else class="h-4 w-4" />
                      </Button>
                    </div>
                  </FieldContent>
                </Field>

                <Field v-else class="server-create-field">
                  <FieldLabel class="server-create-field-label">私钥路径</FieldLabel>
                  <FieldContent class="server-create-field-content">
                    <InputText
                      :model-value="modelValue.privateKeyPath"
                      class="w-full"
                      placeholder="例如：~/.ssh/id_rsa"
                      @update:model-value="updateText('privateKeyPath', $event)"
                    />
                  </FieldContent>
                </Field>
              </div>
            </div>
          </section>
        </div>

        <div class="drawer-actions server-create-actions">
          <Button variant="secondary" @click="$emit('check-server')">
            <Wifi class="h-4 w-4" />
            <span>测试连接</span>
          </Button>
          <Button class="app-primary-button" @click="$emit('save-server')">
            <Save class="h-4 w-4" />
            <span>保存配置</span>
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { Eye, EyeOff, KeyRound, Plus, RefreshCw, Save, Search, Server, ShieldCheck, Trash2, Wifi } from "lucide-vue-next";

import serverBackground from "@/assets/images/server-bg.png";
import ResourceCard from "@/components/ResourceCard.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input as InputText } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import WorkspaceToolbarPanel from "@/components/workspace-header/WorkspaceToolbarPanel.vue";

import type { AuthType, ServerFormValue, ServerRecord } from "@/types/task";

const authTypeOptions: Array<{ label: string; value: AuthType }> = [
  { label: "密码认证", value: "password" },
  { label: "私钥认证", value: "privateKey" },
];

const emit = defineEmits<{
  "check-server": [];
  "close-create": [];
  "create-server": [];
  "delete-server-card": [serverId: string];
  "refresh": [];
  "save-server": [];
  "select-server": [serverId: string];
  "update:modelValue": [value: ServerFormValue];
}>();

const props = defineProps<{
  isCreating: boolean;
  modelValue: ServerFormValue;
  selectedServerId: string | null;
  servers: ServerRecord[];
}>();

const showPassword = ref(false);
const searchKeyword = ref("");
const isRefreshing = ref(false);

const editorMode = computed(() => (props.selectedServerId ? "edit" : "create"));
const filteredServers = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();

  if (!keyword) {
    return props.servers;
  }

  return props.servers.filter((server) => {
    return [server.name, server.host, server.username].some((field) => field.toLowerCase().includes(keyword));
  });
});

function updateText(field: keyof ServerFormValue, value: string | AuthType | undefined) {
  emit("update:modelValue", {
    ...props.modelValue,
    [field]: value ?? "",
  });
}

function updateNumber(field: keyof ServerFormValue, value: number | null | undefined) {
  emit("update:modelValue", {
    ...props.modelValue,
    [field]: value ?? 22,
  });
}

function updatePort(value: string | undefined) {
  const digitsOnly = (value ?? "").replace(/\D+/g, "");
  const nextPort = digitsOnly ? Math.min(Math.max(Number(digitsOnly), 1), 65535) : 22;

  updateNumber("port", Number.isNaN(nextPort) ? 22 : nextPort);
}

function handleDrawerOpenChange(nextOpen: boolean) {
  if (!nextOpen) {
    emit("close-create");
  }
}

/** 点击标题行刷新按钮：同步最新服务器数据 */
async function handleRefresh() {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  try {
    emit("refresh");
  } finally {
    setTimeout(() => {
      isRefreshing.value = false;
    }, 600);
  }
}
</script>

<style scoped>
.server-page {
  grid-column: 1 / -1;
  position: relative;
}

.server-list-page {
  grid-column: 1 / -1;
  display: grid;
  gap: 18px;
}

.server-search-field {
  position: relative;
  width: 100%;
}

.server-search-icon {
  position: absolute;
  top: 50%;
  left: 14px;
  color: var(--text-muted);
  transform: translateY(-50%);
  pointer-events: none;
}

.server-library-section {
  display: grid;
  gap: 14px;
}

.server-section-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
}

.server-section-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
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

.server-card-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  max-width: 864px;
}

.server-search-empty {
  display: grid;
  gap: 6px;
  padding: 18px 16px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-hover);
}

.server-search-empty p,
.server-search-empty small {
  margin: 0;
}

.server-search-empty p {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
}

.server-search-empty small {
  color: var(--text-muted);
  line-height: 1.6;
}

.server-auth-badge {
  gap: 5px;
  justify-self: start;
  font-size: 12px;
}

.server-auth-badge[data-auth-type="password"] {
  background: var(--warning-tint);
  color: var(--warning-soft);
}

.server-auth-badge[data-auth-type="privateKey"] {
  background: var(--success-tint);
  color: var(--success-soft);
}

.delete-server-button {
  color: var(--danger-soft);
}

.delete-server-button:hover {
  background: var(--danger-tint);
  color: var(--danger-soft);
}

.server-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 400px;
  padding: 40px;
}

.server-empty-icon {
  color: var(--text-muted);
}

.server-empty-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
}

.server-empty-desc {
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
}

.password-field {
  position: relative;
}

.password-toggle {
  position: absolute;
  top: 50%;
  right: 4px;
  height: 28px;
  width: 28px;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.password-toggle:hover {
  color: var(--text-primary);
}

.drawer-eyebrow {
  margin: 0 0 10px;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0;
}

.drawer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 6px;
}

.server-create-drawer {
  display: flex;
  flex-direction: column;
  width: min(680px, 94vw);
  max-width: min(680px, 94vw);
  height: 100vh;
  padding: 0;
  overflow: hidden;
}

.server-create-header {
  padding: 22px 24px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-hover);
}

.server-create-head-copy {
  display: grid;
  gap: 6px;
}

.server-create-header :deep(h2) {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
}

.server-create-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: grid;
  align-content: start;
  gap: 18px;
  padding: 18px 10px 20px;
}

.server-create-section {
  display: grid;
  gap: 10px;
  padding: 0;
  border: 0;
  background: transparent;
}

.server-create-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 6px;
}

.server-create-section-head h4 {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
}

.server-create-section-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-hover);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.server-create-section-card {
  display: grid;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
}

.create-form-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 132px;
  gap: 10px;
  align-items: end;
}

.create-form-grid {
  display: grid;
  gap: 14px;
}

.server-create-field {
  gap: 8px;
}

.server-create-field-label {
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
}

.server-create-field-content {
  gap: 0;
}

.server-create-field-compact {
  min-width: 0;
}

.server-create-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
  justify-content: stretch;
  padding: 16px 24px 18px;
  border-top: 1px solid var(--border);
  background: var(--surface-hover);
}

.server-create-actions :deep(button) {
  height: 36px;
  min-height: 36px;
  width: 100%;
  min-width: 0;
  padding-inline: 14px;
  justify-content: center;
}

/* Dark Mode Overrides for Drawer */
.dark .server-create-drawer { background: var(--surface) !important; color: var(--text-primary) !important; }
.dark .server-create-header { background: var(--surface-hover) !important; border-color: var(--card-border) !important; }
.dark .server-create-header :deep(h2) { color: var(--text-primary) !important; }
.dark .server-create-head-copy p { color: var(--text-secondary) !important; }
.dark .server-create-section-head h4 { color: var(--text-primary) !important; }
.dark .server-create-section-index { background: var(--surface-hover); border-color: var(--card-border); color: var(--text-secondary); }
.dark .server-create-section-card { background: var(--surface-hover) !important; border-color: var(--card-border) !important; }
.dark .server-create-field-label { color: var(--text-primary) !important; }
.dark .server-create-actions { background: var(--surface-hover) !important; border-color: var(--card-border) !important; }

@media (max-width: 680px) {
  .server-card-list {
    grid-template-columns: 1fr;
  }

  .create-form-row {
    grid-template-columns: 1fr;
  }

  .server-create-actions {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .server-create-header {
    padding: 20px 18px 16px;
  }

  .server-create-scroll {
    padding: 16px 18px 18px;
  }

  .server-create-section-head {
    padding-inline: 0;
  }

  .server-create-actions {
    padding: 14px 18px 18px;
  }
}
</style>
