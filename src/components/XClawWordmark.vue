<template>
  <button type="button" class="fastdeploy-wordmark" :style="wordmarkStyle" :aria-label="text" @click="$emit('click')">
    <span class="fastdeploy-wordmark-copy">
      <span class="fastdeploy-wordmark-accent">Fast</span><span>Deploy</span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    accentColor?: string;
    fontSize?: string;
    text?: string;
  }>(),
  {
    accentColor: "#0057c2",
    fontSize: "1.5rem",
    text: "FastDeploy",
  },
);

defineEmits<{
  click: [];
}>();

const wordmarkStyle = computed(() => ({
  "--animation-color": props.accentColor,
  "--fs-size": props.fontSize,
}));
</script>

<style scoped>
.fastdeploy-wordmark {
  margin: 0;
  display: inline-flex;
  align-items: baseline;
  min-width: 0;
  height: auto;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-family: var(--font-sans);
  line-height: 1;
  text-align: left;
  transition: opacity 140ms ease;
}

.fastdeploy-wordmark:hover {
  opacity: 0.82;
}

.dark .fastdeploy-wordmark {
  color: var(--text-primary);
}

.fastdeploy-wordmark:focus-visible {
  outline: 1px solid var(--border);
  outline-offset: 4px;
}

.fastdeploy-wordmark-copy {
  display: inline-flex;
  align-items: baseline;
  min-width: 0;
  color: var(--text-primary);
  font-size: var(--fs-size);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.045em;
  white-space: nowrap;
}

.dark .fastdeploy-wordmark-copy {
  color: var(--text-primary);
}

.fastdeploy-wordmark-accent {
  color: var(--animation-color);
  letter-spacing: -0.04em;
}
</style>
