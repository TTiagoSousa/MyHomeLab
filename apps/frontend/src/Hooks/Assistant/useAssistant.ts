import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import { aiErrorMessage } from "../Ai/useAiProviders";
import { awaitReply, isCutOff } from "./awaitReply";
import { clearPendingAsk, listenPendingAsks, pendingAsk, startPendingAsk, type Ask_Reply, type Pending_Ask } from "./pendingAsk";
import type { Chat_File } from "./chatFiles";

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  docsUsed?: { id: string; title: string }[];
  files?: Chat_File[];
}

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  docsUsed?: { id: string; title: string }[];
  files?: Chat_File[];
}

const userMessage = (text: string, files?: Chat_File[]): AssistantMessage => ({ id: crypto.randomUUID(), role: 'user', text, files });

const localFiles = (files: File[]): Chat_File[] =>
  files.map((file) => ({ id: '', name: file.name, mimeType: file.type, size: file.size }));

const chatBody = (conversationId: string | null, text: string, files: File[]) => {
  if (!files.length) return conversationId ? { message: text, conversationId } : { message: text, newConversation: true };
  const form = new FormData();
  form.append('message', text);
  if (conversationId) form.append('conversationId', conversationId);
  else form.append('newConversation', 'true');
  files.forEach((file) => form.append('files', file, file.name));
  return form;
};

export const useAssistant = (conversationId: string | null, onConversation: (id: string) => void) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const { setAlert } = useAlert();

  const showError = (error: any) => setAlert({ open: true, message: aiErrorMessage(error), type: 'error' });

  const fetchMessages = async (pendingText?: string) => {
    if (!conversationId) {
      setMessages(pendingText ? [userMessage(pendingText)] : []);
      return;
    }
    try {
      const response = await http.get<ChatEntry[]>(End_Points.Assistant_Conversation_Messages_Endpoint(conversationId), {
        withCredentials: true,
      });
      const saved = response.data.map((entry): AssistantMessage => ({ id: entry.id, role: entry.role, text: entry.content, docsUsed: entry.docsUsed, files: entry.files }));
      setMessages(pendingText ? [...saved, userMessage(pendingText)] : saved);
    } catch (error: any) {
      showError(error);
    }
  };

  const finishAsk = (ask: Pending_Ask) => {
    clearPendingAsk(ask);
    setLoading(false);
    if (ask.error || !ask.reply) {
      showError(ask.error);
      fetchMessages();
      return;
    }
    const reply = ask.reply;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: reply.reply, docsUsed: reply.docsUsed }]);
    onConversation(reply.conversationId);
  };

  useEffect(
    () =>
      listenPendingAsks((ask) => {
        if (ask.done && ask.conversationId === conversationId) finishAsk(ask);
      }),
    [conversationId],
  );

  useEffect(() => {
    const ask = pendingAsk(conversationId);
    if (ask && !ask.done) {
      setLoading(true);
      fetchMessages(ask.text);
      return;
    }
    setLoading(false);
    if (ask) {
      clearPendingAsk(ask);
      if (ask.error) showError(ask.error);
      if (ask.reply && !conversationId) {
        onConversation(ask.reply.conversationId);
        return;
      }
    }
    fetchMessages();
  }, [conversationId]);

  const sendMessage = async (text: string, files: File[] = []) => {
    if (!text.trim() && !files.length) return;

    setMessages((prev) => [...prev, userMessage(text, files.length ? localFiles(files) : undefined)]);
    setLoading(true);
    const askedAt = Date.now();

    const request = http
      .post<Ask_Reply>(End_Points.Assistant_Chat_Endpoint(), chatBody(conversationId, text, files), { withCredentials: true })
      .then((response) => response.data)
      .catch((error) => (isCutOff(error) ? awaitReply(conversationId, text, askedAt) : Promise.reject(error)));
    startPendingAsk(conversationId, text, request);
  };

  return { messages, loading, sendMessage };
};
