<script setup lang="ts">
import type { DetailTab } from '../types'

defineProps<{ tabs: DetailTab[], active: DetailTab }>()
const emit = defineEmits<{ 'update:active': [tab: DetailTab] }>()
</script>

<template>
  <nav class="details-tabs" aria-label="Detail views" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab"
      type="button"
      role="tab"
      :aria-selected="active === tab"
      class="details-tab"
      @click="emit('update:active', tab)"
    >
      {{ tab }}
    </button>
  </nav>
</template>
