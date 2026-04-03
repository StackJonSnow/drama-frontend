<script setup lang="ts">
import { useToast } from '@/composables/useToast';

const { toasts, remove } = useToast();

function iconForType(type: string) {
  switch (type) {
    case 'success': return '✓';
    case 'error': return '✕';
    case 'warning': return '⚠';
    default: return 'ℹ';
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-200 ease-in"
        enter-from-class="opacity-0 translate-x-8"
        enter-to-class="opacity-100 translate-x-0"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 translate-x-8"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl backdrop-blur-xl border shadow-lg cursor-pointer',
            toast.type === 'success' && 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300',
            toast.type === 'error' && 'bg-red-500/10 border-red-500/40 text-red-300',
            toast.type === 'warning' && 'bg-amber-500/10 border-amber-500/40 text-amber-300',
            toast.type === 'info' && 'bg-sky-500/10 border-sky-500/40 text-sky-300',
          ]"
          @click="remove(toast.id)"
        >
          <span class="text-lg leading-none mt-0.5">{{ iconForType(toast.type) }}</span>
          <span class="text-sm leading-snug flex-1">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
