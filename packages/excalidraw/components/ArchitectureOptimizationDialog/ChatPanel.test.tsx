import React from "react";
import { render, screen } from "@testing-library/react";

import { ChatPanel } from "./ChatPanel";

describe("ChatPanel", () => {
  it("shows a collapsed expandable execution record for assistant messages", () => {
    render(
      <ChatPanel
        messages={[
          {
            id: "m1",
            role: "assistant",
            content: "这是最终输出",
            reasoning: "这是执行过程记录",
            isGenerating: false,
          },
        ]}
        inputValue=""
        isStreaming={false}
        messagesEndRef={{ current: null }}
        inputTextareaRef={{ current: null }}
        onSetInputValue={() => {}}
        onKeyDown={() => {}}
        onStartAnalysis={() => {}}
        onSendPresetQuestion={() => {}}
        onClearHistory={() => {}}
        onUploadImage={() => {}}
        onAbort={() => {}}
        onSendMessage={() => {}}
        canReactivateLastSuggestions={false}
        lastConclusionPreview=""
        onReactivateLastSuggestions={() => {}}
      />,
    );

    expect(screen.getByText("执行记录（点击展开）")).toBeInTheDocument();
    const details = document.querySelector(
      ".architecture-optimization-dialog__message-reasoning",
    ) as HTMLDetailsElement | null;
    expect(details?.open).toBe(false);
    expect(screen.getByText("过程记录")).toBeInTheDocument();
    expect(screen.getByText("输出结果")).toBeInTheDocument();
    expect(screen.getByText("这是执行过程记录")).toBeInTheDocument();
  });

  it("keeps execution record expanded while generating", () => {
    render(
      <ChatPanel
        messages={[
          {
            id: "m2",
            role: "assistant",
            content: "流式输出中",
            reasoning: "思考中",
            isGenerating: true,
          },
        ]}
        inputValue=""
        isStreaming={true}
        messagesEndRef={{ current: null }}
        inputTextareaRef={{ current: null }}
        onSetInputValue={() => {}}
        onKeyDown={() => {}}
        onStartAnalysis={() => {}}
        onSendPresetQuestion={() => {}}
        onClearHistory={() => {}}
        onUploadImage={() => {}}
        onAbort={() => {}}
        onSendMessage={() => {}}
        canReactivateLastSuggestions={false}
        lastConclusionPreview=""
        onReactivateLastSuggestions={() => {}}
      />,
    );

    const details = document.querySelector(
      ".architecture-optimization-dialog__message-reasoning",
    ) as HTMLDetailsElement | null;
    expect(details?.open).toBe(true);
    expect(screen.getByText("执行记录（生成中，点击展开）")).toBeInTheDocument();
  });
});
