export interface Ask_Reply {
  reply: string;
  conversationId: string;
  docsUsed?: { id: string; title: string }[];
}

export interface Pending_Ask {
  conversationId: string | null;
  text: string;
  done: boolean;
  reply?: Ask_Reply;
  error?: unknown;
}

let asks: Pending_Ask[] = [];
const listeners = new Set<(ask: Pending_Ask) => void>();

export const pendingAsks = () => asks;

export const pendingAsk = (conversationId: string | null) => asks.find((ask) => ask.conversationId === conversationId) ?? null;

export const clearPendingAsk = (ask: Pending_Ask) => {
  asks = asks.filter((item) => item !== ask);
};

export const startPendingAsk = (conversationId: string | null, text: string, request: Promise<Ask_Reply>) => {
  const ask: Pending_Ask = { conversationId, text, done: false };
  asks = [...asks.filter((item) => item.conversationId !== conversationId), ask];
  listeners.forEach((listener) => listener(ask));
  request
    .then((reply) => {
      ask.reply = reply;
    })
    .catch((error) => {
      ask.error = error;
    })
    .finally(() => {
      ask.done = true;
      listeners.forEach((listener) => listener(ask));
    });
  return ask;
};

export const listenPendingAsks = (listener: (ask: Pending_Ask) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
