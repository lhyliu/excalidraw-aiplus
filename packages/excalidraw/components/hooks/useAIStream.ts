import { useCallback, useRef, useState } from "react";

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

type RunResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export const useAIStream = () => {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const run = useCallback(
    async <T,>(task: (signal: AbortSignal) => Promise<T>): Promise<RunResult<T>> => {
      if (isStreaming) {
        return { success: false, error: "Request in progress" };
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);

      try {
        const data = await task(controller.signal);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: toErrorMessage(error) };
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming],
  );

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    run,
    abort,
    isStreaming,
  };
};
