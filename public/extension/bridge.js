(() => {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== location.origin) return;

    const data = event.data;

    if (data?.source !== "DEVLENS_PAGE") return;
    if (!data.record || typeof data.record !== "object") return;

    const {
      type,
      message,
      timestamp,
      source,
      line,
      column,
      stack,
    } = data.record;

    if (!["runtime", "promise", "console"].includes(type)) return;
    if (typeof message !== "string") return;

    chrome.runtime.sendMessage({
      type: "DEVLENS_CAPTURE",
      record: {
        type,
        message: message.slice(0, 3000),
        timestamp: Number(timestamp) || Date.now(),
        source: typeof source === "string" ? source.slice(0, 1000) : "",
        line: Number(line) || 0,
        column: Number(column) || 0,
        stack: typeof stack === "string" ? stack.slice(0, 3000) : "",
      },
    }).catch(() => {});
  });
})();