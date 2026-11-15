import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import * as api from '../api/endpoints';
import { errorText } from '../api/errorText';
import type { ChatEntry } from '../api/types';
import i18n from '../i18n';

const chatErrorText = (error: unknown) =>
  error instanceof ApiError && error.status === 412 ? i18n.t('assistant.keyMissing') : errorText(error);

export const useChat = () => {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      setMessages(await api.chatHistory());
      setError(null);
    } catch (fetchError) {
      setError(chatErrorText(fetchError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || thinking) return;
    const pending: ChatEntry = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, pending]);
    setThinking(true);
    setError(null);
    try {
      const { reply } = await api.sendChat(message);
      setMessages((current) => [
        ...current,
        { id: `reply-${Date.now()}`, role: 'assistant', content: reply, createdAt: new Date().toISOString() },
      ]);
    } catch (sendError) {
      setMessages((current) => current.filter((entry) => entry.id !== pending.id));
      setError(chatErrorText(sendError));
    } finally {
      setThinking(false);
    }
  };

  const reset = async () => {
    try {
      await api.clearChat();
      setMessages([]);
      setError(null);
    } catch (resetError) {
      setError(chatErrorText(resetError));
    }
  };

  return { messages, loading, thinking, error, clearError: () => setError(null), send, reset };
};
