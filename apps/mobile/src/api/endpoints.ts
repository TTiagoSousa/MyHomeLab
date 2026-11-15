import { request } from './client';
import type {
  AndroidRelease,
  ChatEntry,
  SessionUser,
  WaterData,
} from './types';

const CHAT_TIMEOUT_MS = 180_000;

export const login = (username: string, password: string) =>
  request<{ message: string }>('POST', '/auth/login', { username, password });

export const me = () => request<SessionUser>('GET', '/auth/me');

export const logout = () => request<{ message: string }>('POST', '/auth/logout');

export const chatHistory = () => request<ChatEntry[]>('GET', '/assistant/history?limit=60');

export const sendChat = (message: string) =>
  request<{ reply: string }>('POST', '/assistant/chat', { message }, CHAT_TIMEOUT_MS);

export const clearChat = () => request<null>('DELETE', '/assistant/history');

export const androidRelease = () => request<AndroidRelease>('GET', '/app/android');

export const water = () => request<WaterData>('GET', '/health/water?days=31');

export const addWater = (ml: number, drankAt: string, timeZone: string) =>
  request<{ id: string }>('POST', '/health/water', { ml, drankAt, timeZone });

export const removeWater = (id: string) => request<{ deleted: boolean }>('DELETE', `/health/water/${id}`);
