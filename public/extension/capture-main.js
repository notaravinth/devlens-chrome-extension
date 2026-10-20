(() => {
  if (window.__devlensInstalled) return;
  window.__devlensInstalled = true;

  const MAX_TEXT = 3000;

  function safeText(value) {
    if (value instanceof Error) {
      return `${value.name}: ${value.message}\n${value.stack || ""}`.slice(
        0,
        MAX_TEXT
      );
    }

    if (typeof value === "string") return value.slice(0, MAX_TEXT);

    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value == null
    ) {
      return String(value);
    }

    return Object.prototype.toString.call(value);
  }

  function emit(type, message, details = {}) {
    const record = {
      type,
      message: safeText(message),
      timestamp: Date.now(),
      source: String(details.source || "").slice(0, 1000),
      line: Number(details.line) || 0,
      column: Number(details.column) || 0,
      stack: String(details.stack || "").slice(0, MAX_TEXT),
    };

    window.postMessage(
      { source: "DEVLENS_PAGE", record },
      location.origin
    );
  }

  window.addEventListener("error", (event) => {
    if (!(event instanceof ErrorEvent)) return;

    emit("runtime", event.message || "Unknown JavaScript error", {
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack || "",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;

    emit(
      "promise",
      reason instanceof Error
        ? `${reason.name}: ${reason.message}`
        : safeText(reason),
      {
        stack: reason instanceof Error ? reason.stack || "" : "",
      }
    );
  });

  const originalConsoleError = console.error;

  console.error = function (...args) {
    try {
      emit("console", args.map(safeText).join(" "), {});
    } catch {
      // Do not interfere with the webpage's original console logging.
    }

    return originalConsoleError.apply(this, args);
  };
})();