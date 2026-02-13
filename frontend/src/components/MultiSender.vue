<script setup>
import { ref, computed, onMounted } from "vue";
import axios from "axios";
import { API_BASE_URL } from "../config";

const devices = ref([]);
const selectedDevice = ref(null);
const message = ref("");
const numbersText = ref("");
const delaySeconds = ref(5);
const sending = ref(false);
const result = ref(null);
const error = ref("");

// AI Generation
const showAiModal = ref(false);
const aiPrompt = ref("");
const generatingAi = ref(false);
const selectedProvider = ref('gemini');

const generateAiMessage = async () => {
  if (!aiPrompt.value.trim()) return;

  generatingAi.value = true;
  try {
    let payload = {
      prompt: aiPrompt.value,
      provider: 'gemini'
    };

    if (selectedProvider.value === 'llama3') {
      payload.provider = 'ollama';
      payload.model = 'llama3:8b';
    } else if (selectedProvider.value === 'mistral') {
      payload.provider = 'ollama';
      payload.model = 'mistral';
    } else {
      payload.provider = 'gemini';
    }

    const res = await axios.post(`${API_BASE_URL}/api/genai/generate-message`, payload);
    message.value = res.data.text;
    showAiModal.value = false;
    aiPrompt.value = "";
  } catch (err) {
    console.error("AI Generation failed:", err);
    alert("Failed to generate message. Check if backend is running and model is available.");
  } finally {
    generatingAi.value = false;
  }
};

// Queue status
const queueStats = ref(null);
const queueItems = ref([]);
const showQueue = ref(false);

const parsedNumbers = computed(() => {
  return numbersText.value
    .split(/[,\n]+/)
    .map((n) => n.trim().replace(/[^0-9]/g, ""))
    .filter((n) => n.length >= 10)
    .map((n) => (n.startsWith("08") ? "628" + n.slice(2) : n));
});

const fetchDevices = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/devices`);
    devices.value = res.data.devices.filter(
      (d) => d.live_status === "connected",
    );
    if (devices.value.length > 0 && !selectedDevice.value) {
      selectedDevice.value = devices.value[0];
    }
  } catch (err) {
    console.error("Failed to fetch devices:", err);
  }
};

const sendMessages = async () => {
  if (
    !selectedDevice.value ||
    !message.value.trim() ||
    parsedNumbers.value.length === 0
  )
    return;

  error.value = "";
  result.value = null;
  sending.value = true;

  try {
    const res = await axios.post(
      `${API_BASE_URL}/api/send-message`,
      {
        targets: parsedNumbers.value,
        message: message.value,
        delay: delaySeconds.value * 1000,
      },
      {
        headers: { "X-API-KEY": selectedDevice.value.api_key },
      },
    );
    result.value = res.data;
    showQueue.value = true;
    pollQueue();
  } catch (err) {
    error.value = err.response?.data?.error || "Failed to send messages";
  } finally {
    sending.value = false;
  }
};

const estimatedTime = ref(0);
let countdownInterval = null;

const formatDuration = (seconds) => {
  if (seconds <= 0) return "Complete";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
};

const pollQueue = async () => {
  if (!selectedDevice.value) return;
  try {
    const res = await axios.get(`${API_BASE_URL}/api/queue-status`, {
      headers: { "X-API-KEY": selectedDevice.value.api_key },
    });
    queueStats.value = res.data.stats;
    queueItems.value = res.data.recent_items;

    // Update estimate
    if (queueStats.value.pending > 0 && queueItems.value.length > 0) {
      // Find delay from a pending item or use current slider
      const pendingItem = queueItems.value.find((i) => i.status === "pending");
      const delayMs = pendingItem
        ? pendingItem.delay_ms
        : delaySeconds.value * 1000;
      estimatedTime.value = queueStats.value.pending * (delayMs / 1000);

      // Start countdown if not running
      if (!countdownInterval) {
        countdownInterval = setInterval(() => {
          if (estimatedTime.value > 0) estimatedTime.value -= 1;
        }, 1000);
      }
    } else {
      estimatedTime.value = 0;
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
    }
  } catch (err) {
    console.error("Queue poll error:", err);
  }
};

// ... existing code ...

let queuePollInterval = null;

const startQueuePolling = () => {
  if (queuePollInterval) clearInterval(queuePollInterval);
  pollQueue(); // Immediate poll
  queuePollInterval = setInterval(pollQueue, 2000);
};

onMounted(() => {
  fetchDevices();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Send Form -->
    <div
      class="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 backdrop-blur-xl"
    >
      <h2 class="text-white font-semibold text-lg mb-6">Compose Message</h2>

      <!-- Device Selector -->
      <div class="mb-5">
        <label class="block text-sm font-medium text-slate-400 mb-2"
          >Select Device</label
        >
        <select
          v-model="selectedDevice"
          class="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
        >
          <option :value="null" disabled>-- Choose connected device --</option>
          <option v-for="d in devices" :key="d.device_id" :value="d">
            {{ d.device_id }} {{ d.phone_number ? `(+${d.phone_number})` : "" }}
          </option>
        </select>
        <p v-if="devices.length === 0" class="text-amber-400 text-xs mt-1">
          No connected devices. Connect a device first.
        </p>
      </div>

      <!-- Phone Numbers -->
      <div class="mb-5">
        <label class="block text-sm font-medium text-slate-400 mb-2">
          Phone Numbers
          <span class="text-slate-600 font-normal"
            >(comma or newline separated, max 50 | 08xxx supported)</span
          >
        </label>
        <textarea
          v-model="numbersText"
          rows="4"
          placeholder="62812xxxx&#10;62813xxxx&#10;62895xxxx"
          class="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none font-mono"
        ></textarea>
        <p
          class="text-xs mt-1"
          :class="parsedNumbers.length > 50 ? 'text-red-400' : 'text-slate-500'"
        >
          {{ parsedNumbers.length }} number(s) detected
          <span
            v-if="parsedNumbers.length > 50"
            class="text-red-400 font-medium"
          >
            — Maximum 50!</span
          >
        </p>
      </div>

      <!-- Message -->
      <div class="mb-5">
        <div class="flex justify-between items-center mb-2">
          <label class="block text-sm font-medium text-slate-400"
            >Message</label
          >
          <button
            @click="showAiModal = true"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 hover:from-violet-500/30 hover:to-fuchsia-500/30 transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-3.5 h-3.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
              />
            </svg>
            Write with AI
          </button>
        </div>
        <textarea
          v-model="message"
          rows="5"
          placeholder="Halo, ini pesan otomatis..."
          class="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none"
        ></textarea>
      </div>

      <!-- Delay -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-slate-400 mb-2">
          Delay between messages
          <span class="text-slate-600 font-normal">(seconds, min 3)</span>
        </label>
        <div class="flex items-center gap-3">
          <input
            v-model.number="delaySeconds"
            type="range"
            min="3"
            max="30"
            class="flex-1 accent-emerald-500"
          />
          <div
            class="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-white text-sm font-mono min-w-[60px] text-center"
          >
            {{ delaySeconds }}s
          </div>
        </div>
      </div>

      <!-- Send Button -->
      <button
        @click="
          sendMessages();
          startQueuePolling();
        "
        :disabled="
          sending ||
          !selectedDevice ||
          parsedNumbers.length === 0 ||
          parsedNumbers.length > 50 ||
          !message.trim()
        "
        class="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white transition-all duration-200 shadow-lg shadow-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {{
          sending
            ? "Sending..."
            : `Kirim Bertahap (${parsedNumbers.length} nomor, delay ${delaySeconds}s)`
        }}
      </button>

      <!-- Error -->
      <p v-if="error" class="text-red-400 text-sm mt-3 text-center">
        {{ error }}
      </p>
    </div>

    <!-- Result / Queue Status -->
    <transition name="fade">
      <div
        v-if="result"
        class="bg-slate-900/50 border border-emerald-500/20 rounded-2xl p-6 backdrop-blur-xl"
      >
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 rounded-full bg-emerald-500/10 text-emerald-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-6 h-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h3 class="text-emerald-400 font-semibold">Messages Queued!</h3>
            <p class="text-slate-400 text-sm">{{ result.message }}</p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4 mb-4">
          <div class="bg-slate-800/30 rounded-xl p-3 text-center">
            <p class="text-2xl font-bold text-white">
              {{ result.total_target }}
            </p>
            <p class="text-xs text-slate-500">Targets</p>
          </div>
          <div class="bg-slate-800/30 rounded-xl p-3 text-center">
            <p class="text-2xl font-bold text-white">{{ result.delay }}</p>
            <p class="text-xs text-slate-500">Delay</p>
          </div>
          <div class="bg-slate-800/30 rounded-xl p-3 text-center">
            <p class="text-2xl font-bold text-white">{{ result.device }}</p>
            <p class="text-xs text-slate-500">Device</p>
          </div>
        </div>

        <!-- Progress Bar -->
        <div v-if="queueStats" class="mb-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-slate-400">Progress</span>
            <span class="text-sm font-mono text-white"
              >{{ totalProgress }}%</span
            >
          </div>
          <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
              :style="{ width: totalProgress + '%' }"
            ></div>
          </div>
          <div class="flex justify-between mt-2 text-xs text-slate-500">
            <span>Pending: {{ queueStats.pending }}</span>
            <span>Processing: {{ queueStats.processing }}</span>
            <span class="text-emerald-400">Sent: {{ queueStats.sent }}</span>
            <span class="text-red-400">Failed: {{ queueStats.failed }}</span>
          </div>
          <div
            v-if="estimatedTime > 0"
            class="mt-3 text-center bg-slate-800/50 rounded-lg py-2 border border-slate-700/50"
          >
            <span class="text-xs text-slate-400">Estimated Time Remaining</span>
            <p
              class="text-emerald-400 font-mono font-bold text-lg animate-pulse"
            >
              {{ formatDuration(estimatedTime) }}
            </p>
          </div>
        </div>

        <!-- Recent Queue Items -->
        <button
          @click="showQueue = !showQueue"
          class="text-sm text-slate-400 hover:text-white transition-colors"
        >
          <div class="flex items-center gap-2">
            <svg
              v-if="!showQueue"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-4 h-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-4 h-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
            Queue Details
          </div>
        </button>
        <div
          v-if="showQueue && queueItems.length > 0"
          class="mt-3 max-h-60 overflow-y-auto custom-scrollbar"
        >
          <table class="w-full text-xs">
            <thead>
              <tr class="text-slate-500 border-b border-slate-800">
                <th class="text-left py-2 px-2">Target</th>
                <th class="text-left py-2 px-2">Status</th>
                <th class="text-left py-2 px-2">Time</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in queueItems"
                :key="item.id"
                class="border-b border-slate-800/30"
              >
                <td class="py-1.5 px-2 font-mono text-slate-300">
                  {{ item.target }}
                </td>
                <td class="py-1.5 px-2">
                  <span
                    :class="[
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      item.status === 'sent'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : item.status === 'failed'
                          ? 'bg-red-500/10 text-red-400'
                          : item.status === 'processing'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-slate-700/30 text-slate-400',
                    ]"
                    >{{ item.status }}</span
                  >
                </td>
                <td class="py-1.5 px-2 text-slate-500">
                  {{ item.sent_at || "-" }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </transition>

    <!-- AI Modal -->
    <transition name="fade">
      <div
        v-if="showAiModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <div
          class="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
        >
          <button
            @click="showAiModal = false"
            class="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-6 h-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <div class="mb-4">
            <div
              class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-fuchsia-400 mb-3 border border-fuchsia-500/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="w-6 h-6"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                />
              </svg>
            </div>
            <h3 class="text-white text-lg font-bold">Write with AI</h3>
            <p class="text-slate-400 text-sm">Choose your model and describe what you want.</p>
          </div>

          <!-- Provider Selection -->
          <div class="grid grid-cols-3 gap-3 mb-4">
            <button
              @click="selectedProvider = 'gemini'"
              class="flex flex-col items-center justify-center p-3 rounded-xl border transition-all"
              :class="selectedProvider === 'gemini' ? 'bg-fuchsia-500/10 border-fuchsia-500/50 text-fuchsia-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:bg-slate-800'"
            >
              <span class="text-sm font-semibold">Gemini</span>
              <span class="text-[10px] opacity-75">Google AI</span>
            </button>
            <button
              @click="selectedProvider = 'llama3'"
              class="flex flex-col items-center justify-center p-3 rounded-xl border transition-all"
              :class="selectedProvider === 'llama3' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:bg-slate-800'"
            >
              <span class="text-sm font-semibold">Llama 3</span>
              <span class="text-[10px] opacity-75">Ollama</span>
            </button>
            <button
              @click="selectedProvider = 'mistral'"
              class="flex flex-col items-center justify-center p-3 rounded-xl border transition-all"
              :class="selectedProvider === 'mistral' ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:bg-slate-800'"
            >
              <span class="text-sm font-semibold">Mistral</span>
              <span class="text-[10px] opacity-75">Ollama</span>
            </button>
          </div>

          <textarea
            v-model="aiPrompt"
            rows="3"
            placeholder="e.g. Write a friendly reminder for payment due tomorrow..."
            class="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition-all resize-none mb-4"
          ></textarea>

          <button
            @click="generateAiMessage"
            :disabled="generatingAi || !aiPrompt.trim()"
            class="w-full py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white transition-all shadow-lg shadow-fuchsia-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg
              v-if="generatingAi"
              class="animate-spin w-4 h-4 text-white"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
                class="opacity-25"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            {{ generatingAi ? "Generating..." : "Generate Magic ✨" }}
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

