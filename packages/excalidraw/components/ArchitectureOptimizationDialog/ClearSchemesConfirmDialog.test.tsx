import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { ClearSchemesConfirmDialog } from "./ClearSchemesConfirmDialog";

describe("ClearSchemesConfirmDialog", () => {
  it("returns null when closed", () => {
    const { container } = render(
      <ClearSchemesConfirmDialog
        isOpen={false}
        options={{ alsoClearSelected: false, alsoClearPool: false }}
        onChangeOptions={() => {}}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("enforces pool-clear implies selected-clear and exposes action callbacks", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const onChangeOptions = vi.fn();

    render(
      <ClearSchemesConfirmDialog
        isOpen
        options={{ alsoClearSelected: false, alsoClearPool: false }}
        onChangeOptions={onChangeOptions}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    const poolCheckbox = screen.getByLabelText("清空建议项目（建议流）");

    fireEvent.click(poolCheckbox);

    expect(onChangeOptions).toHaveBeenCalledTimes(1);

    const updatePool = onChangeOptions.mock.calls[0][0] as (
      prev: { alsoClearSelected: boolean; alsoClearPool: boolean },
    ) => { alsoClearSelected: boolean; alsoClearPool: boolean };

    expect(updatePool({ alsoClearSelected: false, alsoClearPool: false })).toEqual({
      alsoClearSelected: true,
      alsoClearPool: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    fireEvent.click(screen.getByRole("button", { name: "确认清空" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
