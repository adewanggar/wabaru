<script setup>
const endpoints = [
  {
    method: "POST",
    path: "/api/devices",
    desc: "Register a new device",
    body: '{ "device_id": "my-device-01" }',
    response:
      '{ "status": "success", "device_id": "my-device-01", "api_key": "uuid..." }',
  },
  {
    method: "GET",
    path: "/api/devices",
    desc: "List all registered devices",
    body: null,
    response:
      '{ "devices": [{ "device_id": "...", "api_key": "...", "status": "...", ... }] }',
  },
  {
    method: "DELETE",
    path: "/api/devices/:deviceId",
    desc: "Remove a device and its session",
    body: null,
    response: '{ "status": "success" }',
  },
  {
    method: "POST",
    path: "/api/devices/:deviceId/connect",
    desc: "Start WhatsApp session (generates QR)",
    body: null,
    response: '{ "status": "success", "message": "Session starting..." }',
  },
  {
    method: "POST",
    path: "/api/devices/:deviceId/disconnect",
    desc: "Stop WhatsApp session",
    body: null,
    response: '{ "status": "success" }',
  },
  {
    method: "GET",
    path: "/api/devices/:deviceId/status",
    desc: "Get connection status + QR code (base64 data URL)",
    body: null,
    response:
      '{ "status": "connected|connecting|disconnected", "qr": "data:image/png;...", "user": {...} }',
  },
  {
    method: "POST",
    path: "/api/send-message",
    desc: "Send message to one or multiple contacts with delay",
    headers: "X-API-KEY: YOUR_DEVICE_API_KEY",
    body: `{
  "targets": ["62812xxxx", "62813xxxx"],
  "message": "Halo, ini pesan otomatis",
  "delay": 5000
}`,
    response: `{
  "status": "queued",
  "total_target": 2,
  "delay": "5s",
  "device": "my-device-01"
}`,
    notes:
      'delay is in ms (min 3000). Max 50 targets. 08xxx automatically converted to 628xxx. Use "number" instead of "targets" for single send.',
  },
  {
    method: "GET",
    path: "/api/queue-status",
    desc: "Get queue statistics for your device",
    headers: "X-API-KEY: YOUR_DEVICE_API_KEY",
    body: null,
    response:
      '{ "stats": { "pending": 3, "processing": 1, "sent": 10, "failed": 0 }, "recent_items": [...] }',
  },
  {
    method: "GET",
    path: "/api/outbox",
    desc: "Get sent message log for your device",
    headers: "X-API-KEY: YOUR_DEVICE_API_KEY",
    body: null,
    response: '{ "messages": [{ "target": "628...", "status": "SENT", ... }] }',
  },
];

const methodColors = {
  GET: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  POST: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  DELETE: "bg-red-500/10 text-red-400 border-red-500/20",
};
</script>

<template>
  <div class="space-y-6 max-w-4xl">
    <!-- Intro -->
    <div
      class="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 backdrop-blur-xl"
    >
      <h2 class="text-white font-bold text-lg mb-2">WhatsApp Gateway API</h2>
      <p class="text-slate-400 text-sm leading-relaxed">
        Multi-device WhatsApp Gateway with API key authentication, message
        queuing, and delay-based sending. Each device gets a unique API key. Use
        the
        <code class="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded"
          >X-API-KEY</code
        >
        header for authenticated endpoints.
      </p>
    </div>

    <!-- Endpoints -->
    <div
      v-for="(ep, i) in endpoints"
      :key="i"
      class="bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden backdrop-blur-xl hover:border-slate-700/50 transition-all"
    >
      <!-- Header -->
      <div
        class="px-6 py-4 border-b border-slate-800/30 flex items-center gap-3"
      >
        <span
          :class="[
            'px-2.5 py-1 rounded-md text-xs font-bold border',
            methodColors[ep.method],
          ]"
        >
          {{ ep.method }}
        </span>
        <code class="text-white text-sm font-mono">{{ ep.path }}</code>
      </div>

      <div class="px-6 py-4 space-y-3">
        <p class="text-slate-400 text-sm">{{ ep.desc }}</p>

        <!-- Headers -->
        <div v-if="ep.headers">
          <p class="text-xs text-slate-500 font-medium mb-1">Headers</p>
          <pre
            class="bg-slate-800/50 rounded-lg p-3 text-xs text-amber-300 font-mono overflow-x-auto"
            >{{ ep.headers }}</pre
          >
        </div>

        <!-- Body -->
        <div v-if="ep.body">
          <p class="text-xs text-slate-500 font-medium mb-1">Request Body</p>
          <pre
            class="bg-slate-800/50 rounded-lg p-3 text-xs text-emerald-300 font-mono overflow-x-auto"
            >{{ ep.body }}</pre
          >
        </div>

        <!-- Response -->
        <div>
          <p class="text-xs text-slate-500 font-medium mb-1">Response</p>
          <pre
            class="bg-slate-800/50 rounded-lg p-3 text-xs text-blue-300 font-mono overflow-x-auto"
            >{{ ep.response }}</pre
          >
        </div>

        <!-- Notes -->
        <p
          v-if="ep.notes"
          class="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2"
        >
          <div class="flex gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mt-0.5 shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
            <span>{{ ep.notes }}</span>
          </div>
        </p>
      </div>
    </div>

    <!-- Rate limit info -->
    <div
      class="bg-slate-900/50 border border-amber-500/20 rounded-2xl p-6 backdrop-blur-xl"
    >
      <h3 class="text-amber-400 font-semibold mb-3 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        Rate Limits & Anti-Ban Rules
      </h3>
      <ul class="space-y-2 text-sm text-slate-400">
        <li>
          • Minimum delay between messages:
          <strong class="text-white">3 seconds</strong>
        </li>
        <li>
          • Maximum targets per request: <strong class="text-white">50</strong>
        </li>
        <li>
          • Recommended delay: <strong class="text-white">5-10 seconds</strong>
        </li>
        <li>• Messages are sent sequentially, not simultaneously</li>
        <li>• Each device has its own independent queue</li>
      </ul>
    </div>
  </div>
</template>
