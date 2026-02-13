<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import axios from "axios";
import { API_BASE_URL } from "../config";

const devices = ref([]);
const newDeviceId = ref("");
const showAddForm = ref(false);
const loading = ref(false);
const error = ref("");
const copiedKey = ref("");

// Auto Reply State
const showPromptModal = ref(false);
const editingDevice = ref(null);
const promptText = ref("");
const savingPrompt = ref(false);

let pollInterval = null;

const fetchDevices = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/devices`);
    devices.value = res.data.devices;
  } catch (err) {
    console.error("Failed to fetch devices:", err);
  }
};

const addDevice = async () => {
  if (!newDeviceId.value.trim()) return;
  error.value = "";
  loading.value = true;
  try {
    await axios.post(`${API_BASE_URL}/api/devices`, {
      device_id: newDeviceId.value.trim(),
    });
    newDeviceId.value = "";
    showAddForm.value = false;
    await fetchDevices();
  } catch (err) {
    error.value = err.response?.data?.error || "Failed to add device";
  } finally {
    loading.value = false;
  }
};

const removeDevice = async (deviceId) => {
  if (!confirm(`Remove device "${deviceId}"? This deletes the session.`))
    return;
  try {
    await axios.delete(`${API_BASE_URL}/api/devices/${deviceId}`);
    await fetchDevices();
  } catch (err) {
    alert("Failed to remove device");
  }
};

const connectDevice = async (deviceId) => {
  try {
    await axios.post(`${API_BASE_URL}/api/devices/${deviceId}/connect`);
    await fetchDevices();
  } catch (err) {
    alert("Failed to connect device");
  }
};

const disconnectDevice = async (deviceId) => {
  try {
    await axios.post(`${API_BASE_URL}/api/devices/${deviceId}/disconnect`);
    await fetchDevices();
  } catch (err) {
    alert("Failed to disconnect device");
  }
};

const logoutDevice = async (deviceId) => {
  if (!confirm(`Logout "${deviceId}"? This clears the session.`)) return;
  try {
    await axios.post(`${API_BASE_URL}/api/devices/${deviceId}/logout`);
    await fetchDevices();
  } catch (err) {
    alert("Failed to logout device");
  }
};

// QR code for a specific device
const activeQrDevice = ref(null);
const qrDataUrl = ref(null);

const showQr = async (deviceId) => {
  activeQrDevice.value = deviceId;
  await pollDeviceStatus(deviceId);
};

const pollDeviceStatus = async (deviceId) => {
  try {
    const res = await axios.get(
      `${API_BASE_URL}/api/devices/${deviceId}/status`,
    );
    if (res.data.qr) {
      qrDataUrl.value = res.data.qr;
    } else {
      qrDataUrl.value = null;
    }
    if (res.data.status === "connected") {
      activeQrDevice.value = null;
      await fetchDevices();
    }
  } catch (err) {
    console.error("Status poll error:", err);
  }
};

const openPromptModal = (device) => {
  editingDevice.value = {
    ...device,
    ai_provider: device.ai_provider || "gemini",
    ai_model: device.ai_model || "mistral",
    gemini_api_key: device.gemini_api_key || "",
  }; // Clone and default
  promptText.value = device.auto_reply_prompt || "";
  showPromptModal.value = true;
};

const savePrompt = async () => {
  if (!editingDevice.value) return;
  savingPrompt.value = true;
  try {
    await axios.put(
      `${API_BASE_URL}/api/devices/${editingDevice.value.device_id}/auto-reply`,
      {
        auto_reply: editingDevice.value.auto_reply,
        auto_reply_prompt: promptText.value,
        ai_provider: editingDevice.value.ai_provider,
        ai_model: editingDevice.value.ai_model,
        gemini_api_key: editingDevice.value.gemini_api_key,
      },
    );
    // Update local state
    const dev = devices.value.find(
      (d) => d.device_id === editingDevice.value.device_id,
    );
    if (dev) {
      dev.auto_reply = editingDevice.value.auto_reply;
      dev.auto_reply_prompt = promptText.value;
      dev.ai_provider = editingDevice.value.ai_provider;
      dev.ai_model = editingDevice.value.ai_model;
      dev.gemini_api_key = editingDevice.value.gemini_api_key;
    }
    showPromptModal.value = false;
  } catch (err) {
    console.error("Failed to save prompt:", err);
    alert("Failed to save prompt");
  } finally {
    savingPrompt.value = false;
  }
};

const flushMemory = async () => {
  if (!editingDevice.value) return;
  if (
    !confirm(
      "Are you sure you want to clear the AI memory for this device? It will forget previous conversations.",
    )
  )
    return;

  try {
    await axios.post(
      `${API_BASE_URL}/api/devices/${editingDevice.value.device_id}/flush-memory`,
    );
    alert("AI Memory Cleared!");
  } catch (err) {
    console.error("Failed to flush memory:", err);
    alert("Failed to clear memory");
  }
};

const toggleAutoReply = async (device) => {
  const originalState = device.auto_reply;
  device.auto_reply = !device.auto_reply;

  try {
    await axios.put(
      `${API_BASE_URL}/api/devices/${device.device_id}/auto-reply`,
      {
        auto_reply: device.auto_reply,
        auto_reply_prompt: device.auto_reply_prompt,
        ai_provider: device.ai_provider,
        ai_model: device.ai_model,
        gemini_api_key: device.gemini_api_key,
      },
    );
  } catch (err) {
    console.error("Failed to toggle auto-reply:", err);
    device.auto_reply = originalState;
    alert("Failed to update auto-reply setting");
  }
};

const copyApiKey = (key) => {
  navigator.clipboard.writeText(key);
  copiedKey.value = key;
  setTimeout(() => {
    copiedKey.value = "";
  }, 2000);
};

onMounted(() => {
  fetchDevices();
  pollInterval = setInterval(() => {
    fetchDevices();
    if (activeQrDevice.value) {
      pollDeviceStatus(activeQrDevice.value);
    }
  }, 3000);
});

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
});
</script>

<template>
  <div class="space-y-6">
    <!-- Action Bar -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-white">Registered Devices</h2>
      <button
        @click="showAddForm = !showAddForm"
        class="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-white transition-all duration-200 shadow-lg shadow-emerald-500/25"
      >
        + Add Device
      </button>
    </div>

    <!-- Add Device Form -->
    <transition name="fade">
      <div
        v-if="showAddForm"
        class="bg-slate-900 border border-slate-800 rounded-2xl p-6"
      >
        <h3 class="text-white font-semibold mb-4">Add New Device</h3>
        <div class="flex gap-3">
          <input
            v-model="newDeviceId"
            @keyup.enter="addDevice"
            placeholder="e.g. device-sales-01"
            class="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
          />
          <button
            @click="addDevice"
            :disabled="loading"
            class="px-6 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-white transition-all disabled:opacity-50"
          >
            {{ loading ? "Adding..." : "Add" }}
          </button>
        </div>
        <p v-if="error" class="text-red-400 text-sm mt-2">{{ error }}</p>
        <p class="text-slate-500 text-xs mt-2">
          Use alphanumeric characters, hyphens, or underscores only.
        </p>
      </div>
    </transition>

    <!-- Devices Grid -->
    <div
      v-if="devices.length === 0"
      class="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center"
    >
      <div
        class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4 text-slate-500"
      >
        <span class="material-icons-round text-3xl">devices_other</span>
      </div>
      <p class="text-slate-400">No devices registered yet</p>
      <p class="text-slate-600 text-sm mt-1">
        Click "Add Device" to get started
      </p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="device in devices"
        :key="device.device_id"
        class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm hover:border-slate-700 transition-all duration-200"
      >
        <!-- Header -->
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="text-white font-semibold text-lg">
              {{ device.device_id }}
            </h3>
            <p v-if="device.phone_number" class="text-slate-400 text-sm mt-0.5">
              +{{ device.phone_number }}
            </p>
          </div>
          <span
            :class="[
              'px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider',
              device.live_status === 'connected'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : device.live_status === 'connecting'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-slate-700/30 text-slate-500 border border-slate-600/20',
            ]"
          >
            {{ device.live_status }}
          </span>
        </div>

        <!-- API Key -->
        <div class="mb-5">
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5"
          >
            API Key
          </p>
          <div
            class="flex items-center bg-slate-800 rounded-lg p-2 border border-slate-700/50"
          >
            <code
              class="flex-1 text-xs text-slate-400 truncate font-mono px-2"
              >{{ device.api_key }}</code
            >
            <button
              @click="copyApiKey(device.api_key)"
              class="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
            >
              <span
                class="material-icons-round text-sm"
                v-if="copiedKey !== device.api_key"
                >content_copy</span
              >
              <span class="material-icons-round text-sm text-emerald-400" v-else
                >check</span
              >
            </button>
          </div>
        </div>

        <!-- QR Code Display -->
        <div
          v-if="activeQrDevice === device.device_id && qrDataUrl"
          class="mb-5 flex justify-center bg-white p-2 rounded-xl"
        >
          <img :src="qrDataUrl" alt="QR Code" class="w-48 h-48" />
        </div>
        <div
          v-if="activeQrDevice === device.device_id && !qrDataUrl"
          class="mb-5 text-center py-4"
        >
          <div
            class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 text-xs"
          >
            <span class="material-icons-round animate-spin text-sm"
              >refresh</span
            >
            Waiting for QR code...
          </div>
        </div>

        <!-- Auto Reply & Actions -->
        <div class="space-y-4">
          <!-- Auto Reply Row -->
          <div
            class="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50"
          >
            <div class="flex items-center gap-3">
              <span
                class="material-icons-round text-slate-400"
                :class="{ 'text-emerald-500': device.auto_reply }"
                >smart_toy</span
              >
              <div>
                <span class="text-sm font-medium text-slate-200 block"
                  >Auto Reply</span
                >
                <span class="text-[10px] text-slate-500 block">{{
                  device.ai_provider === "ollama" ? `Local AI (${device.ai_model || 'mistral'})` : "Gemini"
                }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="openPromptModal(device)"
                class="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-transparent hover:border-slate-600"
                title="AI Settings"
              >
                <span class="material-icons-round text-lg">settings</span>
              </button>
              <button
                @click="toggleAutoReply(device)"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
                :class="device.auto_reply ? 'bg-emerald-500' : 'bg-slate-700'"
              >
                <span
                  class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                  :class="device.auto_reply ? 'translate-x-6' : 'translate-x-1'"
                />
              </button>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-2">
            <template v-if="device.live_status === 'disconnected'">
              <button
                @click="
                  connectDevice(device.device_id);
                  showQr(device.device_id);
                "
                class="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
              >
                Connect
              </button>
              <button
                @click="removeDevice(device.device_id)"
                class="px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-red-400 hover:bg-red-500/10 hover:text-red-500 border border-slate-700 transition-all"
                title="Delete Device"
              >
                <span class="material-icons-round text-lg">delete</span>
              </button>
            </template>

            <template v-else-if="device.live_status === 'connecting'">
              <button
                @click="
                  disconnectDevice(device.device_id);
                  activeQrDevice = null;
                "
                class="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-all"
              >
                Cancel
              </button>
            </template>

            <template v-else>
              <button
                @click="disconnectDevice(device.device_id)"
                class="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-all"
              >
                Disconnect
              </button>
              <button
                @click="logoutDevice(device.device_id)"
                class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20 transition-all"
              >
                Logout
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Prompt Settings Modal -->
    <transition name="fade">
      <div
        v-if="showPromptModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      >
        <div
          class="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative"
        >
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-white font-bold text-xl">Auto Reply Settings</h3>
            <button
              @click="showPromptModal = false"
              class="text-slate-400 hover:text-white"
            >
              <span class="material-icons-round">close</span>
            </button>
          </div>

          <div class="space-y-6">
            <div>
              <label
                class="block text-xs text-slate-500 mb-2 uppercase font-bold tracking-wider"
                >AI Provider</label
              >
              <div class="grid grid-cols-2 gap-4">
                <button
                  @click="editingDevice.ai_provider = 'gemini'"
                  class="flex flex-col items-center justify-center p-4 rounded-xl border transition-all"
                  :class="
                    editingDevice.ai_provider === 'gemini'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  "
                >
                  <span class="material-icons-round mb-2">cloud_queue</span>
                  <span class="font-medium text-sm">Google Gemini</span>
                  <span class="text-[10px] opacity-70 mt-1">Cloud API</span>
                </button>
                <button
                  @click="editingDevice.ai_provider = 'ollama'"
                  class="flex flex-col items-center justify-center p-4 rounded-xl border transition-all"
                  :class="
                    editingDevice.ai_provider === 'ollama'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  "
                >
                  <span class="material-icons-round mb-2">dns</span>
                  <span class="font-medium text-sm">Ollama (Local)</span>
                  <span class="text-[10px] opacity-70 mt-1"
                    >Private & Local</span
                  >
                </button>
              </div>
              
              <!-- Gemini API Key Input -->
              <div v-if="editingDevice.ai_provider === 'gemini'" class="mt-4">
                 <label class="block text-xs text-slate-500 mb-2 uppercase font-bold tracking-wider">Custom Gemini API Key</label>
                 <input 
                    v-model="editingDevice.gemini_api_key" 
                    type="password" 
                    placeholder="Leave empty to use default key"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono"
                 />
                 <p class="text-[10px] text-slate-500 mt-1">Override the global API Key for this device only.</p>
              </div>
              <p
                v-if="editingDevice.ai_provider === 'ollama'"
                class="text-amber-500 text-xs mt-2 flex items-center gap-1.5"
              >
                <span class="material-icons-round text-sm">warning_amber</span>
                Make sure Ollama is running locally (mistral model)
              </p>

              <!-- Model Selection (Ollama Only) -->
              <div v-if="editingDevice.ai_provider === 'ollama'" class="mt-4">
                 <label class="block text-xs text-slate-500 mb-2 uppercase font-bold tracking-wider">Model</label>
                 <select v-model="editingDevice.ai_model" class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all">
                    <option value="mistral">Mistral (Lightweight)</option>
                    <option value="llama3:8b">Llama 3 (8B)</option>
                 </select>
              </div>
            </div>

            <div>
              <label
                class="block text-xs text-slate-500 mb-2 uppercase font-bold tracking-wider"
                >System Prompt</label
              >
              <textarea
                v-model="promptText"
                rows="6"
                placeholder="e.g. You are a helpful assistant..."
                class="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none font-mono"
              ></textarea>
            </div>
          </div>

          <div
            class="flex gap-3 justify-end items-center mt-8 pt-6 border-t border-slate-800"
          >
            <button
              @click="flushMemory"
              class="mr-auto text-red-400 hover:text-red-300 text-sm font-medium flex items-center gap-2"
            >
              <span class="material-icons-round text-lg">delete_sweep</span>
              Flush Memory
            </button>
            <button
              @click="showPromptModal = false"
              class="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
            <button
              @click="savePrompt"
              :disabled="savingPrompt"
              class="px-6 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-white transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              {{ savingPrompt ? "Saving..." : "Save Changes" }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>
