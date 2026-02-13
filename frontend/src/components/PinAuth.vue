<script setup>
import { ref } from "vue";

const emit = defineEmits(["authenticated"]);

const pin = ref("");
const error = ref("");
const loading = ref(false);

const handleLogin = () => {
  loading.value = true;
  error.value = "";

  // Simulate a small delay for better UX
  setTimeout(() => {
    if (pin.value === "0606") {
      emit("authenticated");
    } else {
      error.value = "Incorrect PIN";
      pin.value = "";
    }
    loading.value = false;
  }, 500);
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
    <div class="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 mb-4">
          <span class="material-icons-round text-3xl">lock</span>
        </div>
        <h1 class="text-2xl font-bold">Access Required</h1>
        <p class="text-slate-400 mt-2 text-sm">Please enter the security PIN to continue.</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <input
            v-model="pin"
            type="password"
            placeholder="Enter PIN"
            maxlength="4"
            class="w-full text-center text-3xl tracking-[1em] py-4 bg-slate-900 border border-slate-600 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors font-mono placeholder:tracking-normal placeholder:text-lg placeholder:text-slate-600"
            autofocus
          />
        </div>

        <div v-if="error" class="text-center text-red-400 text-sm font-medium animate-pulse">
          {{ error }}
        </div>

        <button
          type="submit"
          :disabled="loading || pin.length < 4"
          class="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <span v-if="loading" class="material-icons-round animate-spin text-lg">refresh</span>
          <span>{{ loading ? "Verifying..." : "Unlock Access" }}</span>
        </button>
      </form>
      
      <p class="text-center text-slate-600 text-xs mt-8">
        Protected System &bull; Authorized Personnel Only
      </p>
    </div>
  </div>
</template>
