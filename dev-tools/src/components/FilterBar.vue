<script setup lang="ts">
import FilterSelect from './FilterSelect.vue'

const props = defineProps<{
  query: string
  type: string
  status: string
  agent: string
  onlyErrors: boolean
  total: number
  count: number
}>()
const emit = defineEmits<{
  'update:query': [value: string]
  'update:type': [value: string]
  'update:status': [value: string]
  'update:agent': [value: string]
  'toggleErrors': []
}>()

const typeOptions = ['all', 'Trace', 'Agent', 'LLM', 'Tool']
const statusOptions = ['all', 'success', 'running', 'failed', 'cancelled']
const agentOptions = [
  'all',
  'orchestrator',
  'planner',
  'researcher',
  'writer',
  'reviewer',
]
function fallbackValue(value: string, options: string[]) {
  return options.includes(value) ? value : 'all'
}
function updateQuery(event: Event) {
  const target = event.target
  if (target instanceof HTMLInputElement)
    emit('update:query', target.value)
}
const typeSelectOptions = typeOptions.map(value => ({ value, label: value === 'all' ? 'All types' : value }))
const statusSelectOptions = statusOptions.map(value => ({ value, label: value === 'all' ? 'All statuses' : value[0].toUpperCase() + value.slice(1) }))
const agentSelectOptions = agentOptions.map(value => ({ value, label: value === 'all' ? 'All agents' : value }))
</script>

<template>
  <section
    class="filter-bar flex h-full min-w-0 items-center gap-1 border-b-0 px-2"
  >
    <span class="toolbar-divider" aria-hidden="true" />
    <input
      :value="query"
      type="search"
      placeholder="Search name or ID…"
      class="w-44 rounded border border-(--control-border) bg-(--input-bg) px-1.5 py-0.5 outline-none focus:border-(--accent)"
      @input="updateQuery"
    >
    <FilterSelect
      :model-value="fallbackValue(props.type, typeOptions)"
      :options="typeSelectOptions"
      @update:model-value="emit('update:type', $event)"
    />
    <FilterSelect
      :model-value="fallbackValue(props.status, statusOptions)"
      :options="statusSelectOptions"
      @update:model-value="emit('update:status', $event)"
    />
    <FilterSelect
      :model-value="fallbackValue(props.agent, agentOptions)"
      :options="agentSelectOptions"
      @update:model-value="emit('update:agent', $event)"
    />
    <button
      type="button"
      class="h-full min-h-0 rounded border border-(--control-border) bg-(--control-bg) px-1.5 py-0"
      :class="onlyErrors ? 'border-red-400 text-red-300' : ''"
      @click="emit('toggleErrors')"
    >
      Only errors
    </button>
    <span class="toolbar-divider" aria-hidden="true" />
    <span class="ml-auto text-slate-500">{{ count }} of {{ total }}</span>
  </section>
</template>
