import type { AIMessage } from "./aiService";
import { getAISettings, runAIStream } from "./aiService";

export type AITaskType =
  | "service_name_fill"
  | "business_scope"
  | "business_layering"
  | "diagram_generate";

export type AITaskEventMap = {
  progress: { current: number; total: number; message?: string };
  partial: { data: string };
  done: { result: { text: string } };
  error: { code: string; message: string };
  heartbeat: { ts: number };
};

export type AITaskPayload = {
  messages: AIMessage[];
  provider?: "volcengine" | "openai";
  baseURL?: string;
  apiKey?: string;
  model?: string;
};

export type AITaskHandlers = {
  onProgress?: (payload: AITaskEventMap["progress"]) => void;
  onPartial?: (payload: AITaskEventMap["partial"]) => void;
  onDone?: (payload: AITaskEventMap["done"]) => void;
  onError?: (payload: AITaskEventMap["error"]) => void;
  onHeartbeat?: (payload: AITaskEventMap["heartbeat"]) => void;
};

export type AITaskRuntimeStatus =
  | "queued"
  | "running"
  | "success"
  | "error"
  | "canceled"
  | "stalled";

export type AITaskStatusSnapshot = {
  taskId: string;
  mode: "remote" | "local";
  type?: AITaskType;
  status: AITaskRuntimeStatus;
  current?: number;
  total?: number;
  updatedAt: number;
  lastEvent?:
    | keyof AITaskEventMap
    | "created"
    | "subscribed"
    | "canceled"
    | "stall";
  message?: string;
};

type LocalTask = {
  type: AITaskType;
  payload: AITaskPayload;
  controller: AbortController;
  started: boolean;
  canceled: boolean;
  listeners: Set<AITaskHandlers>;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
};

type TaskMeta =
  | { mode: "remote"; taskId: string }
  | { mode: "local"; taskId: string };

const localTasks = new Map<string, LocalTask>();
const remoteTaskIds = new Set<string>();
const taskMetaById = new Map<string, TaskMeta>();
const taskStatusById = new Map<string, AITaskStatusSnapshot>();
const taskStatusListeners = new Set<(status: AITaskStatusSnapshot) => void>();

const API_TASKS_BASE =
  (
    typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: Record<string, string> }).env
      ?.VITE_AI_TASKS_BASE
  ) ||
  "/api/ai/tasks";

const buildTaskId = () =>
  `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const emitToListeners = <K extends keyof AITaskEventMap>(
  listeners: Set<AITaskHandlers>,
  event: K,
  payload: AITaskEventMap[K],
) => {
  listeners.forEach((handlers) => {
    if (event === "progress") {
      handlers.onProgress?.(payload as AITaskEventMap["progress"]);
    }
    if (event === "partial") {
      handlers.onPartial?.(payload as AITaskEventMap["partial"]);
    }
    if (event === "done") {
      handlers.onDone?.(payload as AITaskEventMap["done"]);
    }
    if (event === "error") {
      handlers.onError?.(payload as AITaskEventMap["error"]);
    }
    if (event === "heartbeat") {
      handlers.onHeartbeat?.(payload as AITaskEventMap["heartbeat"]);
    }
  });
};

const setTaskStatus = (
  taskId: string,
  patch: Partial<AITaskStatusSnapshot> & Pick<AITaskStatusSnapshot, "status">,
) => {
  const taskMeta = taskMetaById.get(taskId);
  const mode = patch.mode ?? taskMeta?.mode ?? "remote";
  const prev = taskStatusById.get(taskId);
  const nextStatus: AITaskStatusSnapshot = {
    taskId,
    mode,
    type: patch.type ?? prev?.type,
    status: patch.status,
    current: patch.current ?? prev?.current,
    total: patch.total ?? prev?.total,
    updatedAt: Date.now(),
    lastEvent: patch.lastEvent ?? prev?.lastEvent,
    message: patch.message ?? prev?.message,
  };
  taskStatusById.set(taskId, nextStatus);
  taskStatusListeners.forEach((listener) => {
    listener(nextStatus);
  });
};

const tryCreateRemoteTask = async (
  type: AITaskType,
  payload: AITaskPayload,
): Promise<string | null> => {
  const settings = getAISettings();
  const apiUrl = settings?.apiUrl?.trim() || "";
  const payloadWithProvider: AITaskPayload = {
    ...payload,
    provider:
      payload.provider ??
      (/volces|volcengine|ark/i.test(apiUrl) ? "volcengine" : "openai"),
    baseURL: payload.baseURL ?? apiUrl,
    apiKey: payload.apiKey ?? settings?.apiKey ?? "",
    model: payload.model ?? settings?.model ?? "",
  };

  try {
    const response = await fetch(API_TASKS_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type, payload: payloadWithProvider }),
    });
    if (!response.ok) {
      return null;
    }
    const json = (await response.json()) as { taskId?: string };
    return typeof json.taskId === "string" && json.taskId.trim()
      ? json.taskId
      : null;
  } catch {
    return null;
  }
};

const startLocalTask = (taskId: string) => {
  const task = localTasks.get(taskId);
  if (!task || task.started) {
    return;
  }
  task.started = true;
  setTaskStatus(taskId, {
    status: "running",
    mode: "local",
    lastEvent: "subscribed",
  });

  task.heartbeatTimer = setInterval(() => {
    emitToListeners(task.listeners, "heartbeat", { ts: Date.now() });
  }, 2000);

  void (async () => {
    let full = "";
    let chunkCount = 0;
    emitToListeners(task.listeners, "progress", {
      current: 0,
      total: 100,
      message: "任务已启动",
    });
    try {
      await runAIStream(
        task.payload.messages,
        {
          onChunk: (chunk) => {
            if (task.canceled) {
              return;
            }
            full += chunk;
            chunkCount += 1;
            emitToListeners(task.listeners, "partial", { data: chunk });
            emitToListeners(task.listeners, "progress", {
              current: Math.min(95, chunkCount),
              total: 100,
              message: "流式返回中",
            });
          },
        },
        task.controller.signal,
      );
      if (!task.canceled) {
        emitToListeners(task.listeners, "progress", {
          current: 100,
          total: 100,
          message: "任务完成",
        });
        emitToListeners(task.listeners, "done", { result: { text: full } });
        setTaskStatus(taskId, {
          status: "success",
          mode: "local",
          lastEvent: "done",
        });
      }
    } catch (error) {
      if (!task.canceled) {
        emitToListeners(task.listeners, "error", {
          code: "LOCAL_TASK_FAILED",
          message: error instanceof Error ? error.message : "任务失败",
        });
        setTaskStatus(taskId, {
          status: "error",
          mode: "local",
          lastEvent: "error",
          message: error instanceof Error ? error.message : "任务失败",
        });
      }
    } finally {
      if (task.heartbeatTimer) {
        clearInterval(task.heartbeatTimer);
      }
      localTasks.delete(taskId);
      taskMetaById.delete(taskId);
    }
  })();
};

export const createAiTask = async (
  type: AITaskType,
  payload: AITaskPayload,
): Promise<{ taskId: string }> => {
  const remoteTaskId = await tryCreateRemoteTask(type, payload);
  if (remoteTaskId) {
    remoteTaskIds.add(remoteTaskId);
    taskMetaById.set(remoteTaskId, { mode: "remote", taskId: remoteTaskId });
    setTaskStatus(remoteTaskId, {
      status: "queued",
      mode: "remote",
      type,
      lastEvent: "created",
    });
    return { taskId: remoteTaskId };
  }

  const taskId = buildTaskId();
  localTasks.set(taskId, {
    type,
    payload,
    controller: new AbortController(),
    started: false,
    canceled: false,
    listeners: new Set(),
    heartbeatTimer: null,
  });
  taskMetaById.set(taskId, { mode: "local", taskId });
  setTaskStatus(taskId, {
    status: "queued",
    mode: "local",
    type,
    lastEvent: "created",
  });
  return { taskId };
};

export const subscribeAiTask = (
  taskId: string,
  handlers: AITaskHandlers,
): (() => void) => {
  const taskMeta = taskMetaById.get(taskId);
  if (!taskMeta) {
    handlers.onError?.({ code: "TASK_NOT_FOUND", message: "任务不存在" });
    return () => {};
  }

  if (taskMeta.mode === "remote") {
    setTaskStatus(taskId, { status: "running", lastEvent: "subscribed" });
    const source = new EventSource(`${API_TASKS_BASE}/${taskId}/stream`);

    source.addEventListener("progress", (event) => {
      try {
        const payload = JSON.parse(
          (event as MessageEvent).data,
        ) as AITaskEventMap["progress"];
        handlers.onProgress?.(
          payload,
        );
        setTaskStatus(taskId, {
          status: "running",
          lastEvent: "progress",
          current: payload.current,
          total: payload.total,
          message: payload.message,
        });
      } catch {
        // noop
      }
    });
    source.addEventListener("partial", (event) => {
      try {
        handlers.onPartial?.(
          JSON.parse((event as MessageEvent).data) as AITaskEventMap["partial"],
        );
        setTaskStatus(taskId, {
          status: "running",
          lastEvent: "partial",
        });
      } catch {
        // noop
      }
    });
    source.addEventListener("done", (event) => {
      try {
        handlers.onDone?.(
          JSON.parse((event as MessageEvent).data) as AITaskEventMap["done"],
        );
        setTaskStatus(taskId, {
          status: "success",
          lastEvent: "done",
        });
      } finally {
        source.close();
        remoteTaskIds.delete(taskId);
        taskMetaById.delete(taskId);
      }
    });
    source.addEventListener("error", (event) => {
      try {
        const payload = JSON.parse(
          (event as MessageEvent).data || "{}",
        ) as AITaskEventMap["error"];
        handlers.onError?.({
          code: payload.code || "TASK_STREAM_ERROR",
          message: payload.message || "任务流异常",
        });
        setTaskStatus(taskId, {
          status: payload.code === "TASK_STALLED" ? "stalled" : "error",
          lastEvent: "error",
          message: payload.message || "任务流异常",
        });
      } catch {
        handlers.onError?.({
          code: "TASK_STREAM_ERROR",
          message: "任务流异常",
        });
        setTaskStatus(taskId, {
          status: "error",
          lastEvent: "error",
          message: "任务流异常",
        });
      } finally {
        source.close();
        remoteTaskIds.delete(taskId);
        taskMetaById.delete(taskId);
      }
    });
    source.addEventListener("heartbeat", (event) => {
      try {
        handlers.onHeartbeat?.(
          JSON.parse((event as MessageEvent).data) as AITaskEventMap["heartbeat"],
        );
        setTaskStatus(taskId, {
          status: "running",
          lastEvent: "heartbeat",
        });
      } catch {
        // noop
      }
    });

    return () => {
      source.close();
    };
  }

  const task = localTasks.get(taskId);
  if (!task) {
    handlers.onError?.({ code: "TASK_NOT_FOUND", message: "任务不存在" });
    return () => {};
  }
  task.listeners.add(handlers);
  setTaskStatus(taskId, {
    status: "running",
    mode: "local",
    lastEvent: "subscribed",
  });
  startLocalTask(taskId);

  return () => {
    task.listeners.delete(handlers);
  };
};

export const cancelAiTask = async (taskId: string): Promise<void> => {
  const taskMeta = taskMetaById.get(taskId);
  if (!taskMeta) {
    return;
  }

  if (taskMeta.mode === "remote") {
    try {
      await fetch(`${API_TASKS_BASE}/${taskId}/cancel`, {
        method: "POST",
      });
    } catch {
      // noop
    } finally {
      setTaskStatus(taskId, {
        status: "canceled",
        lastEvent: "canceled",
      });
      remoteTaskIds.delete(taskId);
      taskMetaById.delete(taskId);
    }
    return;
  }

  const task = localTasks.get(taskId);
  if (!task) {
    taskMetaById.delete(taskId);
    return;
  }
  task.canceled = true;
  task.controller.abort();
  setTaskStatus(taskId, {
    status: "canceled",
    mode: "local",
    lastEvent: "canceled",
  });
  if (task.heartbeatTimer) {
    clearInterval(task.heartbeatTimer);
  }
  localTasks.delete(taskId);
  taskMetaById.delete(taskId);
};

export const getTaskLastStatus = (taskId: string): AITaskStatusSnapshot | null =>
  taskStatusById.get(taskId) ?? null;

export const listTaskStatuses = (): AITaskStatusSnapshot[] =>
  Array.from(taskStatusById.values()).sort((a, b) => b.updatedAt - a.updatedAt);

export const subscribeAllTaskStatuses = (
  onEvent: (status: AITaskStatusSnapshot) => void,
): (() => void) => {
  taskStatusListeners.add(onEvent);
  return () => {
    taskStatusListeners.delete(onEvent);
  };
};

export const subscribeTaskStatus = (
  taskId: string,
  onEvent: (status: AITaskStatusSnapshot) => void,
): (() => void) => {
  const current = getTaskLastStatus(taskId);
  if (current) {
    onEvent(current);
  }

  return subscribeAiTask(taskId, {
    onProgress: (payload) => {
      setTaskStatus(taskId, {
        status: "running",
        lastEvent: "progress",
        current: payload.current,
        total: payload.total,
        message: payload.message,
      });
      const next = getTaskLastStatus(taskId);
      if (next) {
        onEvent(next);
      }
    },
    onPartial: () => {
      setTaskStatus(taskId, {
        status: "running",
        lastEvent: "partial",
      });
      const next = getTaskLastStatus(taskId);
      if (next) {
        onEvent(next);
      }
    },
    onHeartbeat: () => {
      setTaskStatus(taskId, {
        status: "running",
        lastEvent: "heartbeat",
      });
      const next = getTaskLastStatus(taskId);
      if (next) {
        onEvent(next);
      }
    },
    onDone: () => {
      setTaskStatus(taskId, {
        status: "success",
        lastEvent: "done",
      });
      const next = getTaskLastStatus(taskId);
      if (next) {
        onEvent(next);
      }
    },
    onError: (payload) => {
      setTaskStatus(taskId, {
        status: payload.code === "TASK_STALLED" ? "stalled" : "error",
        lastEvent: payload.code === "TASK_STALLED" ? "stall" : "error",
        message: payload.message,
      });
      const next = getTaskLastStatus(taskId);
      if (next) {
        onEvent(next);
      }
    },
  });
};
