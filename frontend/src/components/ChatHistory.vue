<script setup>
import { ref, onMounted, computed, watch, nextTick } from "vue";
import axios from "axios";
import { API_BASE_URL } from "../config";

const devices = ref([]);
const selectedDeviceId = ref(null);
const chats = ref([]);
const selectedChat = ref(null);
const messages = ref([]);
const loadingChats = ref(false);
const loadingMessages = ref(false);
const searchQuery = ref("");
const messagesContainer = ref(null);

// Contact info cache
const contactCache = ref({});

const fetchDevices = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/devices`);
    devices.value = res.data.devices.filter(
      (d) => d.live_status === "connected",
    );

    if (devices.value.length > 0 && !selectedDeviceId.value) {
      selectedDeviceId.value = devices.value[0].device_id;
    }
  } catch (err) {
    console.error("Failed to fetch devices:", err);
  }
};

const fetchChats = async () => {
  if (!selectedDeviceId.value) return;
  loadingChats.value = true;
  try {
    const res = await axios.get(
      `${API_BASE_URL}/api/history/${selectedDeviceId.value}/chats`,
    );
    chats.value = res.data.chats;
  } catch (err) {
    console.error("Failed to fetch chats:", err);
  } finally {
    loadingChats.value = false;
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

const fetchMessages = async (chat) => {
  selectedChat.value = chat;
  loadingMessages.value = true;
  messages.value = []; // Clear previous
  try {
    const res = await axios.get(
      `${API_BASE_URL}/api/history/${selectedDeviceId.value}/messages/${chat.id}`,
    );
    messages.value = res.data.messages; // Keep original order (Oldest -> Newest)
    scrollToBottom();

    // Fetch contact info if not cached
    if (!contactCache.value[chat.id]) {
      fetchContactInfo(chat.id);
    }
  } catch (err) {
    console.error("Failed to fetch messages:", err);
  } finally {
    loadingMessages.value = false;
  }
};

const fetchContactInfo = async (jid) => {
  try {
    const res = await axios.get(
      `${API_BASE_URL}/api/history/${selectedDeviceId.value}/contacts/${jid}`,
    );
    contactCache.value[jid] = res.data;
  } catch (err) {
    console.error("Failed to fetch contact:", err);
  }
};

const filteredChats = computed(() => {
  if (!searchQuery.value) return chats.value;
  const lower = searchQuery.value.toLowerCase();
  return chats.value.filter((c) => c.name.toLowerCase().includes(lower));
});

const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString();
};

const getProfilePic = (jid) => {
  return contactCache.value[jid]?.profilePictureUrl || null;
};

watch(selectedDeviceId, () => {
  chats.value = [];
  selectedChat.value = null;
  messages.value = [];
  fetchChats();
});

onMounted(() => {
  fetchDevices();
});
</script>

<template>
  <div class="h-[calc(100vh-140px)]">
    <!-- Device Selector if multiple -->
    <div v-if="devices.length > 1" class="mb-4">
      <select
        v-model="selectedDeviceId"
        class="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
      >
        <option v-for="d in devices" :key="d.device_id" :value="d.device_id">
          {{ d.device_id }}
        </option>
      </select>
    </div>

    <div v-if="devices.length === 0" class="text-center p-10 text-slate-500">
      <span class="material-symbols-outlined text-4xl mb-2">mobile_off</span>
      <p>No connected devices found. Please connect a device first.</p>
    </div>

    <div v-else class="grid grid-cols-12 gap-8 h-full">
      <!-- Chat List -->
      <div
        class="col-span-12 lg:col-span-5 2xl:col-span-4 flex flex-col bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden custom-shadow md:h-full h-[300px]"
      >
        <div class="p-4 border-b border-slate-200 dark:border-slate-800">
          <div class="relative">
            <span
              class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              >search</span
            >
            <input
              v-model="searchQuery"
              class="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
              placeholder="Search conversations..."
              type="text"
            />
          </div>
        </div>

        <div class="flex-1 overflow-y-auto custom-scrollbar">
          <div v-if="loadingChats" class="p-4 text-center text-slate-400">
            <span class="material-symbols-outlined animate-spin">refresh</span>
            <p class="text-xs mt-1">Loading chats...</p>
          </div>

          <div v-else class="p-2 space-y-1">
            <div
              v-for="chat in filteredChats"
              :key="chat.id"
              @click="fetchMessages(chat)"
              :class="[
                'flex items-center space-x-4 p-4 rounded-xl cursor-pointer transition-colors border-l-4',
                selectedChat?.id === chat.id
                  ? 'bg-emerald-500/10 border-emerald-500'
                  : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50',
              ]"
            >
              <div
                class="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 shrink-0 overflow-hidden"
              >
                <img
                  v-if="getProfilePic(chat.id)"
                  :src="getProfilePic(chat.id)"
                  class="w-full h-full object-cover"
                />
                <span v-else class="material-symbols-outlined">person</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-center mb-1">
                  <h4
                    class="font-bold truncate text-slate-800 dark:text-slate-200"
                  >
                    {{ chat.name }}
                  </h4>
                  <span
                    class="text-[10px] font-semibold"
                    :class="
                      selectedChat?.id === chat.id
                        ? 'text-emerald-500'
                        : 'text-slate-400'
                    "
                  >
                    {{ formatDate(chat.timestamp) }}
                  </span>
                </div>
                <div class="flex justify-between items-center">
                  <p
                    class="text-sm text-slate-500 dark:text-slate-400 truncate w-3/4"
                  >
                    Click to view messages
                  </p>
                  <span
                    v-if="chat.unread > 0"
                    class="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  >
                    {{ chat.unread }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat View (iPhone Frame) -->
      <div
        class="col-span-12 lg:col-span-7 2xl:col-span-8 flex items-center justify-center p-4"
      >
        <div v-if="!selectedChat" class="text-center text-slate-400">
          <span class="material-symbols-outlined text-6xl mb-4 opacity-50"
            >chat</span
          >
          <p>Select a conversation to view history</p>
        </div>

        <div
          v-else
          class="iphone-frame w-[360px] md:w-[400px] h-[700px] max-h-full flex flex-col rounded-[2.2rem] overflow-hidden bg-[#e5ddd5] dark:bg-[#0b141a]"
        >
          <div class="iphone-notch"></div>

          <!-- Header -->
          <div
            class="bg-[#075e54] dark:bg-[#202c33] p-4 pt-10 flex items-center space-x-3 text-white shrink-0 z-20 shadow-sm"
          >
            <button @click="selectedChat = null" class="lg:hidden">
              <span class="material-symbols-outlined text-sm">arrow_back</span>
            </button>
            <div
              class="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center shrink-0 overflow-hidden"
            >
              <img
                v-if="getProfilePic(selectedChat.id)"
                :src="getProfilePic(selectedChat.id)"
                class="w-full h-full object-cover"
              />
              <span v-else class="material-symbols-outlined text-xs"
                >person</span
              >
            </div>
            <div class="flex-1 min-w-0">
              <h5 class="text-sm font-semibold truncate">
                {{ selectedChat.name }}
              </h5>
              <p class="text-[10px] opacity-70 truncate">
                {{ contactCache[selectedChat.id]?.status || "online" }}
              </p>
            </div>
            <div class="flex space-x-3">
              <span class="material-symbols-outlined text-sm">videocam</span>
              <span class="material-symbols-outlined text-sm">call</span>
              <span class="material-symbols-outlined text-sm">more_vert</span>
            </div>
          </div>

          <!-- Messages Area -->
          <div
            ref="messagesContainer"
            class="flex-1 p-4 space-y-3 overflow-y-auto custom-scrollbar text-xs bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] dark:bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat"
          >
            <div v-if="loadingMessages" class="text-center py-4">
              <span
                class="material-symbols-outlined animate-spin text-slate-500"
                >refresh</span
              >
            </div>

            <template v-else v-for="msg in messages" :key="msg.key.id">
              <div
                :class="['flex', msg.fromMe ? 'justify-end' : 'justify-start']"
              >
                <div
                  :class="[
                    'max-w-[80%] p-2 rounded-lg shadow-sm relative',
                    msg.fromMe
                      ? 'bg-[#dcf8c6] dark:bg-[#005c4b] rounded-tr-none'
                      : 'bg-white dark:bg-[#202c33] rounded-tl-none',
                  ]"
                >
                  <p
                    class="text-slate-800 dark:text-slate-100 break-words leading-relaxed"
                  >
                    {{
                      msg.message?.conversation ||
                      msg.message?.extendedTextMessage?.text ||
                      "Example message content"
                    }}
                  </p>
                  <div
                    :class="[
                      'flex items-center mt-1 space-x-1',
                      msg.fromMe ? 'justify-end' : 'justify-end',
                    ]"
                  >
                    <span
                      :class="[
                        'text-[9px]',
                        msg.fromMe
                          ? 'text-emerald-800/60 dark:text-emerald-200/60'
                          : 'text-slate-400',
                      ]"
                    >
                      {{ formatTime(msg.timestamp) }}
                    </span>
                    <span
                      v-if="msg.fromMe"
                      class="material-symbols-outlined text-[11px] text-blue-400"
                      >done_all</span
                    >
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Input Area (Visual Only) -->
          <div
            class="p-3 bg-slate-50 dark:bg-[#202c33] flex items-center space-x-2 shrink-0 z-20"
          >
            <span class="material-symbols-outlined text-slate-400 text-lg"
              >mood</span
            >
            <div
              class="flex-1 bg-white dark:bg-[#2a3942] rounded-full px-4 py-2 text-[11px] text-slate-400"
            >
              Type a message
            </div>
            <div
              class="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white"
            >
              <span class="material-symbols-outlined text-sm">mic</span>
            </div>
          </div>

          <div
            class="h-6 bg-slate-50 dark:bg-[#202c33] flex justify-center items-start shrink-0"
          >
            <div
              class="w-32 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mt-2"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-shadow {
  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.1);
}
.iphone-frame {
  border: 12px solid #1e293b;
  border-radius: 3rem;
  position: relative;
  box-shadow:
    0 0 0 2px #334155,
    0 20px 50px -10px rgba(0, 0, 0, 0.5);
}
.iphone-notch {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40%;
  height: 25px;
  background: #1e293b;
  border-bottom-left-radius: 1rem;
  border-bottom-right-radius: 1rem;
  z-index: 50;
  pointer-events: none;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.2);
  border-radius: 2px;
}
</style>
