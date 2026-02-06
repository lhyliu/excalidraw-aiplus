import {
  DiagramToCodePlugin,
  exportToBlob,
  getTextFromElements,
  MIME_TYPES,
  TTDDialog,
  callAIStream,
  RequestError,
} from "@excalidraw/excalidraw";
import { getDataURL } from "@excalidraw/excalidraw/data/blob";
import { safelyParseJSON } from "@excalidraw/common";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { TTDIndexedDBAdapter } from "../data/TTDStorage";

export const AIComponents = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  return (
    <>
      <DiagramToCodePlugin
        generate={async ({ frame, children }) => {
          const appState = excalidrawAPI.getAppState();

          const blob = await exportToBlob({
            elements: children,
            appState: {
              ...appState,
              exportBackground: true,
              viewBackgroundColor: appState.viewBackgroundColor,
            },
            exportingFrame: frame,
            files: excalidrawAPI.getFiles(),
            mimeType: MIME_TYPES.jpg,
          });

          const dataURL = await getDataURL(blob);

          const textFromFrameChildren = getTextFromElements(children);

          const response = await fetch(
            `${
              import.meta.env.VITE_APP_AI_BACKEND
            }/v1/ai/diagram-to-code/generate`,
            {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                texts: textFromFrameChildren,
                image: dataURL,
                theme: appState.theme,
              }),
            },
          );

          if (!response.ok) {
            const text = await response.text();
            const errorJSON = safelyParseJSON(text);

            if (!errorJSON) {
              throw new Error(text);
            }

            if (errorJSON.statusCode === 429) {
              return {
                html: `<html>
                <body style="margin: 0; text-align: center">
                <div style="display: flex; align-items: center; justify-content: center; flex-direction: column; height: 100vh; padding: 0 60px">
                <div style="color:red">Too many requests today,</br>please try again tomorrow!</div>
                </br>
                </br>
                  <div>Please try again later.</div>
                </div>
                </body>
                </html>`,
              };
            }

            throw new Error(errorJSON.message || text);
          }

          try {
            const { html } = await response.json();

            if (!html) {
              throw new Error("Generation failed (invalid response)");
            }
            return {
              html,
            };
          } catch (error: any) {
            throw new Error("Generation failed (invalid response)");
          }
        }}
      />

      <TTDDialog
        onTextSubmit={async (props) => {
          const { onChunk, onStreamCreated, signal, messages } = props;

          if (onStreamCreated) {
            onStreamCreated();
          }

          let fullResponse = "";

          const systemMessage = {
            role: "system",
            content:
              "You are a specialized assistant that generates Mermaid diagrams from text. " +
              "You must output ONLY the Mermaid code strictly within a markdown code block. " +
              "Format:\n" +
              "```mermaid\n" +
              "<mermaid code here>\n" +
              "```\n" +
              "Do NOT include any conversational text, explanations, or preambles. " +
              "Do NOT include any text before or after the code block. " +
              "Allowed diagram types: flowchart, sequence, class, state, er, gantt, pie. " +
              "If the user provides code, convert or fix it as a diagram.",
          };

          const result = await callAIStream(
            [systemMessage, ...messages] as any,
            {
              onChunk: (chunk) => {
                fullResponse += chunk;
                if (onChunk) {
                  onChunk(chunk);
                }
              },
            },
            signal,
          );

          if (!result.success) {
            return {
              error: new RequestError({
                message: result.error || "Failed to generate text",
                status: 500,
              }),
            };
          }

          return { generatedResponse: fullResponse, error: null };
        }}
        persistenceAdapter={TTDIndexedDBAdapter}
      />
    </>
  );
};
