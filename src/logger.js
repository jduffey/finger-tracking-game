const LOG_ENDPOINT = "/__debug-log";
const FLUSH_INTERVAL_MS = 250;
const MAX_BATCH_SIZE = 80;
const MAX_QUEUE_SIZE = 5000;
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 30;
const MAX_OBJECT_KEYS = 50;
const MAX_STRING_LENGTH = 4000;

const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const isDevRuntime = Boolean(import.meta?.env?.DEV);

let initialized = false;
let sequence = 0;
let queue = [];
let flushTimer = 0;
let isFlushing = false;
let internalConsoleWrite = false;
let listenersBound = false;

const nativeConsole = {
  log: console.log.bind(console),
  info: (console.info ?? console.log).bind(console),
  warn: (console.warn ?? console.log).bind(console),
  error: (console.error ?? console.log).bind(console),
  debug: (console.debug ?? console.log).bind(console),
};

export function initializeLogging() {
  if (initialized) {
    return;
  }
  initialized = true;

  patchConsole();
  bindGlobalErrorHandlers();

  emit("INFO", "logger", "Verbose logging initialized", {
    sessionId,
    endpoint: isDevRuntime ? LOG_ENDPOINT : null,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  });
}

export function createScopedLogger(scope) {
  return {
    debug(message, data = null) {
      emit("DEBUG", scope, message, data);
    },
    info(message, data = null) {
      emit("INFO", scope, message, data);
    },
    warn(message, data = null) {
      emit("WARN", scope, message, data);
    },
    error(message, data = null) {
      emit("ERROR", scope, message, data);
    },
  };
}

function emit(level, scope, message, data) {
  const entry = {
    ts: new Date().toISOString(),
    sessionId,
    seq: sequence,
    level,
    scope,
    message,
    data: sanitize(data),
  };
  sequence += 1;

  enqueue(entry);

  const method = level === "ERROR" ? "error" : level === "WARN" ? "warn" : "debug";
  internalConsoleWrite = true;
  try {
    nativeConsole[method](`[${scope}] ${message}`, entry.data);
  } finally {
    internalConsoleWrite = false;
  }
}

function enqueue(entry) {
  if (!isDevRuntime) {
    return;
  }

  if (queue.length >= MAX_QUEUE_SIZE) {
    queue = queue.slice(-(MAX_QUEUE_SIZE - 1));
  }
  queue.push(entry);

  if (queue.length >= MAX_BATCH_SIZE) {
    void flushQueue();
    return;
  }

  if (flushTimer) {
    return;
  }

  flushTimer = window.setTimeout(() => {
    flushTimer = 0;
    void flushQueue();
  }, FLUSH_INTERVAL_MS);
}

async function flushQueue() {
  if (!isDevRuntime || isFlushing || queue.length === 0) {
    return;
  }

  isFlushing = true;
  const batch = queue.splice(0, MAX_BATCH_SIZE);

  try {
    await fetch(LOG_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "browser",
        sessionId,
        entries: batch,
      }),
      keepalive: true,
    });
  } catch (error) {
    queue = batch.concat(queue).slice(-MAX_QUEUE_SIZE);
    internalConsoleWrite = true;
    try {
      nativeConsole.warn("[logger] failed to flush logs to file", error);
    } finally {
      internalConsoleWrite = false;
    }
  } finally {
    isFlushing = false;
    if (queue.length > 0 && !flushTimer) {
      flushTimer = window.setTimeout(() => {
        flushTimer = 0;
        void flushQueue();
      }, FLUSH_INTERVAL_MS);
    }
  }
}

function patchConsole() {
  const methods = ["log", "info", "warn", "error", "debug"];
  for (const method of methods) {
    const nativeMethod = nativeConsole[method];
    console[method] = (...args) => {
      if (!internalConsoleWrite) {
        enqueue({
          ts: new Date().toISOString(),
          sessionId,
          seq: sequence,
          level: "CONSOLE",
          scope: "console",
          message: `console.${method}`,
          data: { args: sanitize(args) },
        });
        sequence += 1;
      }
      nativeMethod(...args);
    };
  }
}

function bindGlobalErrorHandlers() {
  if (listenersBound || typeof window === "undefined") {
    return;
  }
  listenersBound = true;

  window.addEventListener("error", (event) => {
    emit("ERROR", "window", "Unhandled error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    emit("ERROR", "window", "Unhandled promise rejection", {
      reason: sanitize(event.reason),
    });
  });

  window.addEventListener("beforeunload", () => {
    if (!isDevRuntime || queue.length === 0) {
      return;
    }
    const payload = JSON.stringify({
      source: "browser",
      sessionId,
      entries: queue.slice(-MAX_BATCH_SIZE),
    });
    navigator.sendBeacon(LOG_ENDPOINT, payload);
  });
}

function sanitize(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`
      : value;
  }
  if (typeof value === "bigint") {
    return `${value.toString()}n`;
  }
  if (typeof value === "function") {
    return `[function ${value.name || "anonymous"}]`;
  }
  if (depth >= MAX_DEPTH) {
    return "[max-depth]";
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (typeof HTMLElement !== "undefined" && value instanceof HTMLElement) {
    return {
      tag: value.tagName,
      id: value.id,
      className: value.className,
    };
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return "[circular]";
    }
    seen.add(value);
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitize(item, depth + 1, seen));
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[circular]";
    }
    seen.add(value);
    const output = {};
    const keys = Object.keys(value).slice(0, MAX_OBJECT_KEYS);
    for (const key of keys) {
      output[key] = sanitize(value[key], depth + 1, seen);
    }
    return output;
  }
  return String(value);
}
