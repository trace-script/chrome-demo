<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  modelValue: string
  options: Array<{ value: string, label: string }>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function updateValue(event: Event) {
  const target = event.target
  if (target instanceof HTMLSelectElement)
    emit('update:modelValue', target.value)
}
</script>

<template>
  <label class="relative inline-flex h-full min-w-0 shrink-0">
    <select
      :value="modelValue"
      class="h-full min-w-0 shrink-0 appearance-none rounded border border-(--control-border) bg-(--control-bg) px-1.5 py-0 pr-6"
      @change="updateValue"
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
    <Icon
      class="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2"
      icon="mdi:chevron-down"
      width="16"
      height="16"
      aria-hidden="true"
    />
  </label>
</template>
