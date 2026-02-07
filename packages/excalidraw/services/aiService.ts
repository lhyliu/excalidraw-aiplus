/**
 * AI Service Layer
 * Manages API settings and streaming API calls for architecture optimization
 */

// Types
export interface AISettings {
  apiUrl: string;
  apiKey: string;
  model: string;
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onReasoning?: (chunk: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  includeReasoning?: boolean;
}

export type AIMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

// Constants
const AI_SETTINGS_KEY = "excalidraw_ai_settings";
const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Get AI settings from localStorage
 */
export const getAISettings = (): AISettings | null => {
  try {
    const saved = localStorage.getItem(AI_SETTINGS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load AI settings:", e);
  }
  return null;
};

/**
 * Save AI settings to localStorage
 */
export const setAISettings = (settings: AISettings): void => {
  try {
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save AI settings:", e);
  }
};

/**
 * Check if AI is configured
 */
export const isAIConfigured = (): boolean => {
  const settings = getAISettings();
  return !!(settings?.apiUrl && settings?.apiKey);
};

/**
 * Normalize API URL to ensure it ends with /chat/completions
 * Supports both domain-only input and full endpoint URLs
 *
 * Examples:
 * - "https://api.openai.com" -> "https://api.openai.com/v1/chat/completions"
 * - "https://api.openai.com/v1" -> "https://api.openai.com/v1/chat/completions"
 * - "https://api.openai.com/v1/chat/completions" -> "https://api.openai.com/v1/chat/completions" (unchanged)
 */
const normalizeApiUrl = (url: string, preferResponses = false): string => {
  let normalized = url.trim();

  // Remove trailing slash
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  // Case 1: Already a complete endpoint URL - use as-is
  if (
    normalized.endsWith("/chat/completions") ||
    normalized.endsWith("/responses")
  ) {
    return normalized;
  }

  // Case 2: URL has version path (e.g., /v1, /v2) or /api/ prefix
  // These are base URLs that need the endpoint path appended
  if (/\/v\d+(?:\/|$)/i.test(normalized) || normalized.includes("/api/")) {
    if (preferResponses) {
      return normalized + "/responses";
    }
    return normalized + "/chat/completions";
  }

  // Case 3: Domain-only or simple base URL (e.g., https://api.openai.com)
  // Add standard OpenAI-style version and endpoint path
  if (preferResponses) {
    return normalized + "/v1/responses";
  }
  return normalized + "/v1/chat/completions";
};

/**
 * Call AI API with streaming support
 */
export const callAIStream = async (
  messages: AIMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  customSettings?: AISettings,
): Promise<{ success: boolean; error?: string }> => {
  const settings = customSettings || getAISettings();

  if (!settings?.apiUrl || !settings?.apiKey) {
    const error = new Error("AI settings not configured");
    callbacks.onError?.(error);
    return { success: false, error: error.message };
  }

  const apiUrl = normalizeApiUrl(settings.apiUrl, !!callbacks.includeReasoning);
  const model = settings.model || DEFAULT_MODEL;

  // Construct payload based on endpoint type
  let payload: any = {
    model,
    stream: true,
  };

  // Volcengine /responses endpoint uses "input" instead of "messages"
  if (apiUrl.endsWith("/responses")) {
    payload.input = messages.map((msg) => ({
      role: msg.role,
      content: [
        {
          type: "input_text",
          text: msg.content,
        },
      ],
    }));
    if (callbacks.includeReasoning) {
      payload.thinking = { type: "enabled" };
    }
  } else {
    // Standard OpenAI format
    payload.messages = messages;
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }
      throw new Error(errorMessage);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") {
          continue;
        }
        // Skip event type lines (Volcengine format)
        if (trimmed.startsWith("event:")) {
          continue;
        }
        if (!trimmed.startsWith("data:")) {
          continue;
        }

        try {
          const json = JSON.parse(trimmed.replace(/^data:\s?/, ""));
          let content: string | undefined;
          let reasoning: string | undefined;

          // Try OpenAI format first
          content = json.choices?.[0]?.delta?.content;
          if (callbacks.includeReasoning) {
            reasoning =
              json.choices?.[0]?.delta?.reasoning ||
              json.choices?.[0]?.delta?.reasoning_content ||
              json.choices?.[0]?.delta?.reasoning_summary;
          }

          // Volcengine /responses format
          // IMPORTANT: Skip reasoning_summary events - only capture output_text
          if (json.type) {
            // Only accept actual output text, not reasoning
            if (json.type === "response.output_text.delta" && json.delta) {
              content = json.delta;
            }
            // Also accept content_part delta
            if (
              json.type === "response.content_part.delta" &&
              json.delta?.text
            ) {
              content = json.delta.text;
            }
            if (callbacks.includeReasoning) {
              if (
                json.type === "response.reasoning_summary_text.delta" ||
                json.type === "response.reasoning_text.delta"
              ) {
                reasoning = json.delta || json.delta?.text;
              } else if (
                json.type === "response.reasoning_summary_part.added"
              ) {
                reasoning = json.part?.text || json.part?.summary_text;
              } else if (
                json.type === "response.reasoning_summary_text.done" ||
                json.type === "response.reasoning_text.done"
              ) {
                reasoning = json.text;
              } else if (
                typeof json.type === "string" &&
                json.type.includes("reasoning")
              ) {
                reasoning =
                  json.delta ||
                  json.delta?.text ||
                  json.text ||
                  json.part?.text ||
                  json.part?.summary_text;
              }
            }
            // Skip these event types:
            // - response.reasoning_summary_text.delta (chain of thought)
            // - response.reasoning_summary_text.done
            // - response.in_progress
            // - response.created
          }

          // Another fallback for content_block_delta (Anthropic format)
          if (
            !content &&
            json.delta?.text &&
            json.type === "content_block_delta"
          ) {
            content = json.delta.text;
          }

          if (content) {
            callbacks.onChunk(content);
          }
          if (reasoning) {
            callbacks.onReasoning?.(reasoning);
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }

    callbacks.onComplete?.();
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return { success: false, error: "Request aborted" };
      }
      if (
        error.name === "TypeError" &&
        (error.message === "Failed to fetch" ||
          error.message.includes("NetworkError"))
      ) {
        const wrapped = new Error(
          "连接失败 (Failed to fetch)。可能是因为：\n1. API地址不正确\n2. 网络问题\n3. 跨域限制 (CORS)\n请检查控制台(F12)获取详细错误信息。",
        );
        callbacks.onError?.(wrapped);
        return {
          success: false,
          error: wrapped.message,
        };
      }
      callbacks.onError?.(error);
      return { success: false, error: error.message };
    }
    return { success: false, error: "Unknown error" };
  }
};

/**
 * Run AI stream and throw on failure for consistent error handling.
 */
export const runAIStream = async (
  messages: AIMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  customSettings?: AISettings,
): Promise<void> => {
  const result = await callAIStream(
    messages,
    callbacks,
    signal,
    customSettings,
  );
  if (!result.success) {
    throw new Error(result.error || "Unknown error");
  }
};

/**
 * Extract diagram information for AI analysis
 */
export const extractDiagramInfo = (elements: readonly any[]): string => {
  const typeCount: Record<string, number> = {};
  const labels: string[] = [];
  const connections: Array<{ from: string; to: string }> = [];

  // Build element ID to label map
  const idToLabel: Record<string, string> = {};

  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }

    // Count types
    typeCount[el.type] = (typeCount[el.type] || 0) + 1;

    // Extract labels from text elements
    if (el.type === "text" && el.text) {
      labels.push(el.text);
      idToLabel[el.id] = el.text;
    }

    // Extract labels from shapes with text
    if (el.boundElements) {
      for (const bound of el.boundElements) {
        if (bound.type === "text") {
          const textEl = elements.find((e) => e.id === bound.id);
          if (textEl?.text) {
            idToLabel[el.id] = textEl.text;
          }
        }
      }
    }
  }

  // Extract connections from arrows
  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }
    if (el.type === "arrow" && el.startBinding && el.endBinding) {
      const from = idToLabel[el.startBinding.elementId] || "Unknown";
      const to = idToLabel[el.endBinding.elementId] || "Unknown";
      connections.push({ from, to });
    }
  }

  // Build info string
  let info = "## 图表元素统计\n";
  for (const [type, count] of Object.entries(typeCount)) {
    info += `- ${type}: ${count}个\n`;
  }

  if (labels.length > 0) {
    info += "\n## 文本标签\n";
    for (const label of labels.slice(0, 20)) {
      info += `- ${label}\n`;
    }
    if (labels.length > 20) {
      info += `- ... 及其他${labels.length - 20}个\n`;
    }
  }

  if (connections.length > 0) {
    info += "\n## 连接关系\n";
    for (const conn of connections.slice(0, 20)) {
      info += `- ${conn.from} → ${conn.to}\n`;
    }
    if (connections.length > 20) {
      info += `- ... 及其他${connections.length - 20}条连接\n`;
    }
  }

  return info;
};

/**
 * Generate system prompt for architecture analysis
 */
export const getArchitectureAnalysisPrompt = (diagramInfo: string): string => {
  return `你是一个专业的系统架构师。请分析以下架构图并提供优化建议。

<图表信息>
${diagramInfo}
</图表信息>

请从以下方面分析：
1. 组件划分是否合理
2. 组件间耦合度
3. 可扩展性考虑
4. 潜在的性能瓶颈
5. 安全性建议
6. 推荐的优化方向

请用中文回答，使用清晰的结构和要点。`;
};

/**
 * Generate system prompt for architecture optimization plan
 */
export const getOptimizationPlanPrompt = (
  diagramInfo: string,
  chatHistory: string,
): string => {
  return `你是一个专业的系统架构师。根据当前架构图信息和我们的对话记录，生成一个优化方案。

<当前架构图信息>
${diagramInfo}
</当前架构图信息>

<对话历史>
${chatHistory}
</对话历史>

你的任务是：
1. 总结对话中讨论的优化建议
2. 生成一个有效的Mermaid图表代码，表示优化后的新架构

【重要】输出格式要求：
你必须严格按照以下格式输出，不要添加任何其他内容：

## 变更总结
- [变更1]
- [变更2]
- [变更3]

\`\`\`mermaid
graph TD
    A[组件1] --> B[组件2]
    B --> C[组件3]
\`\`\`

注意事项：
- Mermaid代码必须是有效的flowchart/graph语法
- 必须包含完整的架构，而不仅仅是变更部分
- 使用中文标签
- 确保代码在三个反引号内，并标记为mermaid`;
};

/**
 * Generate optimization plan (summary + new diagram)
 */
export const generateOptimizationPlan = async (
  messages: AIMessage[],
  diagramInfo: string,
  onChunk: (data: {
    summary?: string;
    mermaid?: string;
    reasoning?: string;
  }) => void,
  signal?: AbortSignal,
): Promise<{ summary: string; mermaid: string }> => {
  const chatHistory = messages
    .filter((m) => m.content && !m.content.includes("base64")) // Filter out large payloads if any
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const systemPrompt = getOptimizationPlanPrompt(diagramInfo, chatHistory);

  let fullResponse = "";

  await runAIStream(
    [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          "请根据以上对话内容，生成优化后的架构方案。必须包含变更总结和Mermaid代码块。",
      },
    ],
    {
      onChunk: (chunk) => {
        fullResponse += chunk;
        onChunk({ summary: fullResponse });
      },
      onReasoning: (chunk) => {
        onChunk({ reasoning: chunk });
      },
      includeReasoning: true,
    },
    signal,
  );

  // Parse result - try multiple patterns
  let mermaidMatch = fullResponse.match(/```mermaid\s*([\s\S]*?)```/);
  if (!mermaidMatch) {
    // Try without mermaid tag
    mermaidMatch = fullResponse.match(
      /```\s*(graph\s+(?:TD|LR|TB|RL|BT)[\s\S]*?)```/,
    );
  }
  if (!mermaidMatch) {
    // Try flowchart syntax
    mermaidMatch = fullResponse.match(
      /```\s*(flowchart\s+(?:TD|LR|TB|RL|BT)[\s\S]*?)```/,
    );
  }

  const mermaid = mermaidMatch ? mermaidMatch[1].trim() : "";

  // Summary is everything before the mermaid block
  const summaryPart = mermaidMatch
    ? fullResponse.substring(0, mermaidMatch.index).trim()
    : fullResponse;

  // Clean up summary markdown headers if present
  const summary = summaryPart
    .replace(/^## 变更总结\s*/i, "")
    .replace(/^## Summary\s*/i, "")
    .trim();

  return { summary, mermaid };
};
