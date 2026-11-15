/** Para comparar nomes sem maiúsculas, acentos nem espaços a mais ("Serviços" = "servicos"). */
export const normalizeName = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
