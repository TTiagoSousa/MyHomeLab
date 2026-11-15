/** O XML do WebDAV do Nextcloud (CalDAV, CardDAV), lido sem parser: chega para as propriedades simples. */

export const xmlEscape = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const xmlUnescape = (text: string) =>
  text
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** O texto de uma propriedade do XML (com qualquer prefixo: d:, cal:, …). */
export const tagText = (xml: string, tag: string) => {
  const match = new RegExp(
    `<(?:[a-z0-9-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-z0-9-]+:)?${tag}>`,
    'i',
  ).exec(xml);
  return match ? xmlUnescape(match[1]) : null;
};

/** Cada <d:response> de um multistatus. */
export const davResponses = (xml: string) =>
  xml.split(/<(?:[a-z0-9-]+:)?response[\s>]/i).slice(1);
