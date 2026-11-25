/**
 * As origens em que é ele a falar agora: o chat, o terminal e um comentário dele numa
 * tarefa. Nas outras (estudos, instalações, disparos agendados) ninguém escreveu nada:
 * o que o agente leu (um email, uma página) não é o sim dele.
 */
const SPEAKING = new Set(['chat', 'terminal', 'comment']);

export const userIsSpeaking = (source: string | undefined) =>
  !source || SPEAKING.has(source);

/** Ele escreveu uma mensagem nesta volta (no chat ou num comentário): as palavras dele vão com o pedido. */
export const userWroteThisTurn = (source: string | undefined) =>
  source === 'chat' || source === 'comment';
