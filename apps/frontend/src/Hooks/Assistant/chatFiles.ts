import i18n from '../../i18n';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';

export interface Chat_File {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

export const MAX_CHAT_FILES = 5;
const MAX_CHAT_FILE_BYTES = 20 * 1024 * 1024;

export const CHAT_FILE_ACCEPT =
  '.pdf,.docx,.xlsx,.xlsm,.csv,.tsv,.txt,.md,.json,.xml,.log,.ics,.png,.jpg,.jpeg,.gif,.webp';

const ACCEPTED = /\.(pdf|docx|xlsx|xlsm|csv|tsv|txt|md|json|xml|log|ics|html?|ya?ml|png|jpe?g|gif|webp)$/i;
const LEGACY = /\.(doc|xls|ppt)$/i;

export const chatFileProblem = (file: File): string | null => {
  if (LEGACY.test(file.name)) return i18n.t('assistant:files.legacy', { name: file.name });
  if (!ACCEPTED.test(file.name)) return i18n.t('assistant:files.unsupported', { name: file.name });
  if (file.size > MAX_CHAT_FILE_BYTES) return i18n.t('assistant:files.tooBig', { name: file.name });
  return null;
};

export const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const fileExtension = (name: string) => /\.(\w+)$/.exec(name)?.[1].toUpperCase().slice(0, 4) ?? '';

export const openChatFile = async (file: Chat_File) => {
  const response = await http.get<Blob>(End_Points.Assistant_File_Endpoint(file.id), {
    withCredentials: true,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  if (/^(image\/|application\/pdf$)/.test(file.mimeType)) link.target = '_blank';
  else link.download = file.name;
  link.rel = 'noopener';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
