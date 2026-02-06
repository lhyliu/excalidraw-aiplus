import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { useAIStream } from "./useAIStream";

const TestHarness = ({
  task,
  onResult,
}: {
  task: (signal: AbortSignal) => Promise<string>;
  onResult: (result: unknown) => void;
}) => {
  const { run, abort, isStreaming } = useAIStream();
  return (
    <div>
      <div data-testid="state">{isStreaming ? "streaming" : "idle"}</div>
      <button
        onClick={async () => {
          const result = await run(task);
          onResult(result);
        }}
      >
        run
      </button>
      <button onClick={() => abort()}>abort</button>
    </div>
  );
};

describe("useAIStream", () => {
  it("runs and resolves successfully", async () => {
    const onResult = vi.fn();
    let resolveTask: (value: string) => void = () => {};
    const task = () =>
      new Promise<string>((resolve) => {
        resolveTask = resolve;
      });

    render(<TestHarness task={task} onResult={onResult} />);

    expect(screen.getByTestId("state").textContent).toBe("idle");

    await act(async () => {
      fireEvent.click(screen.getByText("run"));
    });

    expect(screen.getByTestId("state").textContent).toBe("streaming");

    await act(async () => {
      resolveTask("ok");
    });

    expect(screen.getByTestId("state").textContent).toBe("idle");
    expect(onResult).toHaveBeenCalledWith({ success: true, data: "ok" });
  });

  it("returns error when aborted", async () => {
    const onResult = vi.fn();
    const task = (signal: AbortSignal) =>
      new Promise<string>((_, reject) => {
        signal.addEventListener("abort", () =>
          reject(new Error("Request aborted")),
        );
      });

    render(<TestHarness task={task} onResult={onResult} />);

    await act(async () => {
      fireEvent.click(screen.getByText("run"));
    });

    expect(screen.getByTestId("state").textContent).toBe("streaming");

    await act(async () => {
      fireEvent.click(screen.getByText("abort"));
    });

    expect(screen.getByTestId("state").textContent).toBe("idle");
    expect(onResult).toHaveBeenCalledWith({
      success: false,
      error: "Request aborted",
    });
  });
});
