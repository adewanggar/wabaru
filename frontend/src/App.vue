<script setup>
import { ref, onMounted } from "vue";
import DeviceManager from "./components/DeviceManager.vue";
import MultiSender from "./components/MultiSender.vue";
import ApiDocs from "./components/ApiDocs.vue";
import ChatHistory from "./components/ChatHistory.vue";

const currentView = ref("devices");
const isDark = ref(true);

const toggleDarkMode = () => {
  isDark.value = !isDark.value;
  if (isDark.value) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};

onMounted(() => {
  // Check system preference or default to dark
  document.documentElement.classList.add("dark");
});
</script>

<template>
  <div
    class="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 font-display"
  >
    <!-- Sidebar -->
    <aside
      class="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col fixed h-full z-20"
    >
      <div class="p-6 flex items-center space-x-3">
        <div
          class="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20"
        >
          <span class="text-white font-bold text-xl">W</span>
        </div>
        <div>
          <h1 class="font-bold text-lg leading-tight">WA Gateway</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Multi-Device v2.0
          </p>
        </div>
      </div>

      <nav class="flex-1 px-4 space-y-1 mt-4">
        <a
          href="#"
          @click.prevent="currentView = 'devices'"
          :class="
            currentView === 'devices'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
          "
          class="flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium"
        >
          <span class="material-icons-round text-xl">devices</span>
          <span>Devices</span>
        </a>
        <a
          href="#"
          @click.prevent="currentView = 'history'"
          :class="
            currentView === 'history'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
          "
          class="flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium"
        >
          <span class="material-symbols-outlined text-xl">history</span>
          <span>Chat History</span>
        </a>
        <a
          href="#"
          @click.prevent="currentView = 'multi-send'"
          :class="
            currentView === 'multi-send'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
          "
          class="flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium"
        >
          <span class="material-icons-round text-xl">send</span>
          <span>Multi Send</span>
        </a>
        <a
          href="#"
          @click.prevent="currentView = 'api-docs'"
          :class="
            currentView === 'api-docs'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
          "
          class="flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium"
        >
          <span class="material-icons-round text-xl">api</span>
          <span>API Docs</span>
        </a>
      </nav>

      <div class="p-6 border-t border-slate-200 dark:border-slate-800">
        <p class="text-xs text-slate-400 dark:text-slate-500">
          © 2024 WA Gateway
        </p>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 ml-64 p-8">
      <header class="flex justify-between items-start mb-10">
        <div>
          <h2 class="text-3xl font-bold tracking-tight">
            {{
              currentView === "devices"
                ? "Device Manager"
                : currentView === "multi-send"
                  ? "Multi-Contact Sender"
                  : currentView === "history"
                    ? "Chat History"
                    : "API Documentation"
            }}
          </h2>
          <p class="text-slate-500 dark:text-slate-400 mt-1">
            {{
              currentView === "devices"
                ? "Manage WhatsApp devices & automated sessions"
                : currentView === "multi-send"
                  ? "Send messages to multiple contacts with delay"
                  : currentView === "history"
                    ? "Review and manage conversation logs across devices"
                    : "Developer API reference & endpoints"
            }}
          </p>
        </div>
        <div
          class="flex items-center space-x-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-500/20"
        >
          <span
            class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"
          ></span>
          <span class="text-xs font-semibold uppercase tracking-wider"
            >System Online</span
          >
        </div>
      </header>

      <!-- Components -->
      <div>
        <DeviceManager v-if="currentView === 'devices'" />
        <MultiSender v-else-if="currentView === 'multi-send'" />
        <ChatHistory v-else-if="currentView === 'history'" />
        <ApiDocs v-else-if="currentView === 'api-docs'" />
      </div>
    </main>

    <!-- Dark Mode Toggle -->
    <button
      class="fixed bottom-6 right-6 w-12 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform z-50 text-slate-800 dark:text-white"
      @click="toggleDarkMode"
    >
      <span class="material-icons-round">{{
        isDark ? "light_mode" : "dark_mode"
      }}</span>
    </button>
  </div>
</template>
