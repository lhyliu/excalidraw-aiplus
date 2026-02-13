/**
 * Chat-related atoms for ArchitectureOptimizationDialog
 */
import { atom } from "../../../editor-jotai";

import type { Message, MessagesAction } from "../messageState";
import { messagesReducer } from "../messageState";

/** Chat messages — uses reducer semantics via a writable atom */
export const aoMessagesAtom = atom<Message[]>([]);

/** Writable dispatch atom for messages reducer */
export const aoDispatchMessagesAtom = atom(
    null,
    (get, set, action: MessagesAction) => {
        const current = get(aoMessagesAtom);
        set(aoMessagesAtom, messagesReducer(current, action));
    },
);

/** Draft input value in the chat composer */
export const aoInputValueAtom = atom("");
