import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import type { Ask_Reply } from "./pendingAsk";

interface Saved_Message {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  docsUsed?: { id: string; title: string }[];
}

interface Saved_Conversation {
  id: string;
  createdAt: string;
}

const POLL_MS = 5_000;
const GIVE_UP_MS = 30 * 60_000;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isCutOff = (error: any) => {
  const status = error?.response?.status;
  return !error?.response || status === 502 || status === 503 || status === 504 || error?.code === 'ECONNABORTED';
};

const findConversation = async (askedAt: number) => {
  const response = await http.get<Saved_Conversation[]>(End_Points.Assistant_Conversations_Endpoint(), { withCredentials: true });
  const recent = response.data.find((conversation) => new Date(conversation.createdAt).getTime() >= askedAt - 60_000);
  return recent?.id ?? null;
};

const replyIn = async (conversationId: string, text: string, askedAt: number): Promise<Ask_Reply | null> => {
  const response = await http.get<Saved_Message[]>(End_Points.Assistant_Conversation_Messages_Endpoint(conversationId), { withCredentials: true });
  const messages = response.data;
  const question = messages.findLastIndex(
    (message) => message.role === 'user' && message.content === text && new Date(message.createdAt).getTime() >= askedAt - 60_000,
  );
  const answer = question >= 0 ? messages.slice(question + 1).find((message) => message.role === 'assistant') : undefined;
  return answer ? { reply: answer.content, conversationId, docsUsed: answer.docsUsed } : null;
};

export const awaitReply = async (conversationId: string | null, text: string, askedAt: number): Promise<Ask_Reply> => {
  let target = conversationId;
  while (Date.now() - askedAt < GIVE_UP_MS) {
    await pause(POLL_MS);
    try {
      target = target ?? (await findConversation(askedAt));
      const reply = target ? await replyIn(target, text, askedAt) : null;
      if (reply) return reply;
    } catch (error) {
      if (!isCutOff(error)) throw error;
    }
  }
  throw new Error('timeout');
};
