import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { SchemeUndoToast } from "./SchemeUndoToast";

describe("SchemeUndoToast", () => {
  it("renders message, actions and progress duration", () => {
    const onUndo = vi.fn();
    const onDismiss = vi.fn();

    const { container } = render(
      <SchemeUndoToast
        deletedCount={3}
        timeoutMs={12000}
        onUndo={onUndo}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText("已删除 3 个方案")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    fireEvent.click(screen.getByRole("button", { name: "✕" }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    const progress = container.querySelector(".scheme-undo-toast__progress");
    expect(progress).toBeTruthy();
    expect(progress).toHaveStyle({ animationDuration: "12000ms" });
  });
});
