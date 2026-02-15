import cors from "cors";
import express from "express";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.AI_PROXY_PORT || 8787);
const TASK_TTL_MS = Number(process.env.AI_TASK_TTL_MS || 10 * 60 * 1000);

/**
 * OpenAI SDK compatible provider config.
 * Volcengine Ark is OpenAI-compatible and works with baseURL + apiKey + model.
 */
const PROVIDER_PRESETS = {
  volcengine: {
    baseURL:
      process.env.VOLCENGINE_BASE_URL ||
      "https://ark.cn-beijing.volces.com/api/v3",
    model: process.env.VOLCENGINE_MODEL || "",
  },
  openai: {
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  },
};

const tasks = new Map();
const ALLOWED_TASK_TYPES = new Set([
  "service_name_fill",
  "business_scope",
  "business_layering",
  "diagram_generate",
]);
const ALLOWED_PAYLOAD_KEYS = new Set([
  "provider",
  "baseURL",
  "apiKey",
  "model",
  "messages",
]);

const now = () => Date.now();
const taskId = () =>
  `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const maskSecret = (value = "") => {
  const raw = String(value);
  if (!raw) {
    return "";
  }
  if (raw.length <= 8) {
    return `${raw.slice(0, 2)}***${raw.slice(-1)}`;
  }
  return `${raw.slice(0, 4)}***${raw.slice(-4)}`;
};
const maskUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return raw.slice(0, 32);
  }
};
const logInfo = (message, meta = {}) => {
  // eslint-disable-next-line no-console
  console.log(`[ai-proxy] ${message}`, meta);
};
const logWarn = (message, meta = {}) => {
  // eslint-disable-next-line no-console
  console.warn(`[ai-proxy] ${message}`, meta);
};
const logError = (message, meta = {}) => {
  // eslint-disable-next-line no-console
  console.error(`[ai-proxy] ${message}`, meta);
};
const sanitizeTaskPayload = (input = {}) => {
  const payload = {};
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_PAYLOAD_KEYS.has(key)) {
      continue;
    }
    payload[key] = value;
  }
  return payload;
};

const emit = (task, event, payload) => {
  if (task.status === "canceled") {
    return;
  }
  task.events.push({ event, payload, ts: now() });
  if (task.events.length > 2000) {
    task.events.splice(0, task.events.length - 2000);
  }
  for (const res of task.listeners) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
};

const pickProviderConfig = (payload = {}) => {
  const provider = payload.provider === "openai" ? "openai" : "volcengine";
  const preset = PROVIDER_PRESETS[provider];
  const baseURL = String(payload.baseURL || preset.baseURL || "").trim();
  const apiKey = String(payload.apiKey || "").trim();
  const model = String(payload.model || preset.model || "").trim();
  if (!baseURL || !apiKey || !model) {
    throw new Error(
      "AI provider config missing: baseURL/apiKey/model are required (OpenAI SDK compatible)",
    );
  }
  return {
    provider,
    baseURL,
    apiKey,
    model,
  };
};

const getMessages = (payload) => {
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  return messages
    .map((m) => ({
      role: ["system", "user", "assistant"].includes(m?.role)
        ? m.role
        : "user",
      content: String(m?.content || "").trim(),
    }))
    .filter((m) => m.content.length > 0);
};

const runTask = async (task) => {
  const { payload, type } = task;
  let heartbeat = null;

  try {
    const cfg = pickProviderConfig(payload);
    logInfo("task started", {
      taskId: task.id,
      type,
      provider: cfg.provider,
      baseURL: maskUrl(cfg.baseURL),
      model: cfg.model,
      apiKey: maskSecret(cfg.apiKey),
    });
    const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });

    const messages = getMessages(payload);
    if (messages.length === 0) {
      throw new Error("task payload.messages is required");
    }

    task.status = "running";
    emit(task, "progress", { current: 0, total: 100, message: `task ${type} started` });

    heartbeat = setInterval(() => {
      emit(task, "heartbeat", { ts: now() });
    }, 2000);

    const stream = await client.chat.completions.create(
      {
        model: cfg.model,
        stream: true,
        messages,
      },
      {
        signal: task.abortController.signal,
      },
    );

    let text = "";
    let chunks = 0;
    for await (const chunk of stream) {
      if (task.status === "canceled") {
        break;
      }
      const delta = chunk?.choices?.[0]?.delta?.content || "";
      if (!delta) {
        continue;
      }
      text += delta;
      chunks += 1;
      emit(task, "partial", { data: delta });
      emit(task, "progress", {
        current: Math.min(95, chunks),
        total: 100,
        message: "streaming",
      });
    }

    if (task.status !== "canceled") {
      task.status = "done";
      task.result = text;
      emit(task, "progress", { current: 100, total: 100, message: "done" });
      emit(task, "done", { result: { text } });
      logInfo("task done", {
        taskId: task.id,
        type,
        chunks,
        outputLength: text.length,
      });
    }
  } catch (error) {
    if (task.status !== "canceled") {
      task.status = "error";
      logError("task failed", {
        taskId: task.id,
        type,
        message: error instanceof Error ? error.message : "Task failed",
      });
      emit(task, "error", {
        code: "TASK_FAILED",
        message: error instanceof Error ? error.message : "Task failed",
      });
    }
  } finally {
    if (heartbeat) {
      clearInterval(heartbeat);
    }
    task.finishedAt = now();
  }
};

app.post("/api/ai/tasks", (req, res) => {
  const type = String(req.body?.type || "").trim();
  if (!ALLOWED_TASK_TYPES.has(type)) {
    return res.status(400).json({ error: "unsupported task type" });
  }
  const payload = sanitizeTaskPayload(req.body?.payload || {});
  if (!type) {
    return res.status(400).json({ error: "type is required" });
  }
  if (!Array.isArray(payload.messages)) {
    return res.status(400).json({ error: "payload.messages is required" });
  }

  const id = taskId();
  const task = {
    id,
    type,
    payload,
    status: "queued",
    listeners: new Set(),
    events: [],
    result: "",
    createdAt: now(),
    finishedAt: null,
    abortController: new AbortController(),
  };
  tasks.set(id, task);
  logInfo("task created", {
    taskId: id,
    type,
    provider: payload.provider || "volcengine",
    baseURL: maskUrl(payload.baseURL),
    model: String(payload.model || ""),
    apiKey: maskSecret(payload.apiKey),
    messageCount: payload.messages.length,
  });
  void runTask(task);
  return res.json({ taskId: id });
});

app.get("/api/ai/tasks/:taskId/stream", (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) {
    res.status(404).setHeader("Content-Type", "text/event-stream");
    res.write("event: error\n");
    res.write(
      `data: ${JSON.stringify({ code: "TASK_NOT_FOUND", message: "task not found" })}\n\n`,
    );
    return res.end();
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  task.listeners.add(res);
  for (const e of task.events) {
    res.write(`event: ${e.event}\n`);
    res.write(`data: ${JSON.stringify(e.payload)}\n\n`);
  }

  const close = () => {
    task.listeners.delete(res);
  };
  req.on("close", close);

  if (task.status === "done") {
    res.write(`event: done\n`);
    res.write(`data: ${JSON.stringify({ result: { text: task.result } })}\n\n`);
    close();
    return res.end();
  }
  if (task.status === "error") {
    res.write("event: error\n");
    res.write(
      `data: ${JSON.stringify({ code: "TASK_FAILED", message: "task failed" })}\n\n`,
    );
    close();
    return res.end();
  }
});

app.post("/api/ai/tasks/:taskId/cancel", (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) {
    return res.status(404).json({ ok: false, error: "task not found" });
  }
  task.status = "canceled";
  task.abortController.abort();
  logWarn("task canceled", {
    taskId: task.id,
    type: task.type,
  });
  emit(task, "error", { code: "TASK_CANCELED", message: "task canceled" });
  return res.json({ ok: true });
});

setInterval(() => {
  const ts = now();
  for (const [id, task] of tasks.entries()) {
    if (task.listeners.size > 0) {
      continue;
    }
    const endTs = task.finishedAt || task.createdAt;
    if (ts - endTs > TASK_TTL_MS) {
      tasks.delete(id);
    }
  }
}, 30_000);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[ai-proxy] listening on :${PORT}`);
});
