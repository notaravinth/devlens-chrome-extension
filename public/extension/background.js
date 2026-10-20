const ORIGINS = ["http://*/*", "https://*/*"];
const BRIDGE_ID = "devlens-bridge";
const CAPTURE_ID = "devlens-capture";
const MAX_ERRORS = 200;

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });

  const data = await chrome.storage.local.get([
    "monitoringEnabled",
    "errors",
  ]);

  await chrome.storage.local.set({
    monitoringEnabled: data.monitoringEnabled ?? false,
    errors: Array.isArray(data.errors) ? data.errors : [],
  });

  console.log("DevLens installed.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("DevLens message:", message?.type);

  if (message?.type === "DEVLENS_PING") {
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "DEVLENS_ENABLE") {
    enableMonitoring()
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({ ok: false, error: error.message })
      );
    return true;
  }

  if (message?.type === "DEVLENS_DISABLE") {
    disableMonitoring()
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({ ok: false, error: error.message })
      );
    return true;
  }

  if (message?.type === "DEVLENS_CLEAR") {
    chrome.storage.local.set({ errors: [] })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === "DEVLENS_CAPTURE") {
    saveError(message.record, sender)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error("DevLens save failed:", error);
        sendResponse({ ok: false });
      });
    return true;
  }
});

console.log("DevLens background listener registered.");

async function enableMonitoring() {
  const hasPermission = await chrome.permissions.contains({
    origins: ORIGINS,
  });

  if (!hasPermission) {
    throw new Error("Website access permission has not been granted.");
  }

  await chrome.scripting.unregisterContentScripts({
    ids: [BRIDGE_ID, CAPTURE_ID],
  }).catch(() => {});

  await chrome.scripting.registerContentScripts([
    {
      id: BRIDGE_ID,
      matches: ORIGINS,
      js: ["extension/bridge.js"],
      runAt: "document_start",
      world: "ISOLATED",
      persistAcrossSessions: true,
    },
    {
      id: CAPTURE_ID,
      matches: ORIGINS,
      js: ["extension/capture-main.js"],
      runAt: "document_start",
      world: "MAIN",
      persistAcrossSessions: true,
    },
  ]);

  await chrome.storage.local.set({ monitoringEnabled: true });
}

async function disableMonitoring() {
  await chrome.scripting.unregisterContentScripts({
    ids: [BRIDGE_ID, CAPTURE_ID],
  }).catch(() => {});

  await chrome.storage.local.set({ monitoringEnabled: false });
}

async function saveError(record, sender) {
  if (!sender.tab || !sender.url) return;

  const data = await chrome.storage.local.get([
    "monitoringEnabled",
    "errors",
  ]);

  if (data.monitoringEnabled !== true) return;

  let pageUrl;

  try {
    pageUrl = new URL(sender.url);
    if (!["http:", "https:"].includes(pageUrl.protocol)) return;
  } catch {
    return;
  }

  if (!record || !["runtime", "promise", "console"].includes(record.type)) {
    return;
  }

  if (typeof record.message !== "string") return;

  const origin = pageUrl.origin;
  const message = record.message.slice(0, 3000);
  const source = sanitizeSource(record.source);
  const line = Number(record.line) || 0;

  const fingerprint = [
    origin,
    record.type,
    message,
    source,
    line,
  ].join("|");

  const errors = Array.isArray(data.errors) ? data.errors : [];
  const now = Date.now();

  const existing = errors.find(
    (item) => item.fingerprint === fingerprint
  );

  let updated;

  if (existing) {
    updated = errors.map((item) =>
      item.fingerprint === fingerprint
        ? {
            ...item,
            count: (Number(item.count) || 1) + 1,
            lastSeen: now,
          }
        : item
    );
  } else {
    updated = [
      {
        id: crypto.randomUUID(),
        fingerprint,
        origin,
        type: record.type,
        message,
        source,
        line,
        column: Number(record.column) || 0,
        stack:
          typeof record.stack === "string"
            ? record.stack.slice(0, 3000)
            : "",
        firstSeen: Number(record.timestamp) || now,
        lastSeen: now,
        count: 1,
      },
      ...errors,
    ];
  }

  await chrome.storage.local.set({
    errors: updated.slice(0, MAX_ERRORS),
  });
}

function sanitizeSource(value) {
  if (typeof value !== "string" || !value) return "";

  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, 1000);
  } catch {
    return value.split("?")[0].split("#")[0].slice(0, 1000);
  }
}