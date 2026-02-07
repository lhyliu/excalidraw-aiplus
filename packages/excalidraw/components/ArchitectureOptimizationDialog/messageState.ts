export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: string;
  isGenerating?: boolean;
  error?: string;
}

export type MessagesAction =
  | { type: "add"; messages: Message[] }
  | { type: "update"; id: string; patch: Partial<Message> }
  | { type: "append"; id: string; chunk: string }
  | {
      type: "updateLast";
      patch: Partial<Message>;
      predicate?: (m: Message) => boolean;
    }
  | { type: "remove"; id: string }
  | { type: "replace"; messages: Message[] };

export const messagesReducer = (
  state: Message[],
  action: MessagesAction,
): Message[] => {
  switch (action.type) {
    case "add":
      return [...state, ...action.messages];
    case "update":
      return state.map((msg) =>
        msg.id === action.id ? { ...msg, ...action.patch } : msg,
      );
    case "append":
      return state.map((msg) =>
        msg.id === action.id
          ? { ...msg, content: (msg.content || "") + action.chunk }
          : msg,
      );
    case "updateLast": {
      const index = [...state]
        .reverse()
        .findIndex((m) => (action.predicate ? action.predicate(m) : true));
      if (index === -1) {
        return state;
      }
      const targetIndex = state.length - 1 - index;
      return state.map((msg, i) =>
        i === targetIndex ? { ...msg, ...action.patch } : msg,
      );
    }
    case "remove":
      return state.filter((msg) => msg.id !== action.id);
    case "replace":
      return action.messages;
    default:
      return state;
  }
};
