<script setup>
import { defineProps, defineEmits } from "vue";

const props = defineProps({
  currentView: String,
});
const emit = defineEmits(["changeView"]);

const navItems = [
  {
    id: "devices",
    label: "Devices",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>`,
  },
  {
    id: "multi-send",
    label: "Multi Send",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>`,
  },
  {
    id: "api-docs",
    label: "API Docs",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>`,
  },
];
</script>

<template>
  <aside
    class="w-64 bg-slate-900/50 border-r border-slate-800/50 flex flex-col backdrop-blur-xl shrink-0"
  >
    <!-- Logo -->
    <div class="p-6 border-b border-slate-800/50">
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/20"
        >
          W
        </div>
        <div>
          <h2 class="text-white font-bold text-sm">WA Gateway</h2>
          <p class="text-xs text-slate-500">Multi-Device v2.0</p>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 p-4 space-y-1">
      <button
        v-for="item in navItems"
        :key="item.id"
        @click="emit('changeView', item.id)"
        :class="[
          'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
          currentView === item.id
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/5'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
        ]"
      >
        <div v-html="item.icon" class="w-6 h-6"></div>
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <!-- Footer -->
    <div class="p-4 border-t border-slate-800/50">
      <p class="text-xs text-slate-600 text-center">© 2026 WA Gateway</p>
    </div>
  </aside>
</template>
