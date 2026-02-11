export const adjustInputComposerTextareaHeight = (
  textarea: HTMLTextAreaElement,
  chatPanelHeight: number,
) => {
  const maxHeight =
    chatPanelHeight > 0 ? Math.min(320, Math.floor(chatPanelHeight * 0.5)) : 240;
  const minHeight = 124;

  textarea.style.maxHeight = `${maxHeight}px`;
  textarea.style.height = "auto";

  const nextHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
};
