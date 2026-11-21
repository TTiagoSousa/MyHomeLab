import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
} from 'crypto';

/*
 * A criptografia da página de gestão dos routers TP-Link (Archer), portada da biblioteca
 * tplinkrouterc6u (GPL-3.0, github.com/AlexandrErohin/TP-Link-Archer-C6U). O router dá
 * chaves RSA pequenas (512 a 2048 bits) que o OpenSSL pode recusar, por isso o RSA é feito
 * à mão com BigInt: PKCS#1 v1.5, OAEP (SHA-1) e sem padding, como a página do router.
 */

const modPow = (base: bigint, exponent: bigint, modulus: bigint) => {
  let result = 1n;
  let b = base % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    e >>= 1n;
    b = (b * b) % modulus;
  }
  return result;
};

interface RsaKey {
  n: bigint;
  e: bigint;
  /** O tamanho da chave em bytes. */
  size: number;
}

export function rsaKey(nHex: string, eHex: string): RsaKey {
  const n = BigInt(`0x${nHex}`);
  return {
    n,
    e: BigInt(`0x${eHex}`),
    size: Math.ceil(n.toString(16).length / 2),
  };
}

/** RSA "cru" de um bloco já do tamanho da chave; o resultado em hex, com zeros à esquerda. */
function rsaRaw(block: Buffer, key: RsaKey): string {
  const message = BigInt(`0x${block.toString('hex') || '0'}`);
  return modPow(message, key.e, key.n)
    .toString(16)
    .padStart(key.size * 2, '0');
}

/** Bytes aleatórios sem nenhum zero (o enchimento do PKCS#1 v1.5). */
function nonZeroRandom(length: number): Buffer {
  const bytes = randomBytes(length);
  for (let index = 0; index < length; index += 1) {
    while (bytes[index] === 0) bytes[index] = randomBytes(1)[0];
  }
  return bytes;
}

/** RSA com PKCS#1 v1.5 (a palavra-passe e a assinatura clássica). */
export function rsaPkcs1(data: string, nHex: string, eHex: string): string {
  const key = rsaKey(nHex, eHex);
  const message = Buffer.from(data, 'utf8');
  if (message.length > key.size - 11) {
    throw new Error('Texto grande demais para a chave RSA do router.');
  }
  const block = Buffer.concat([
    Buffer.from([0, 2]),
    nonZeroRandom(key.size - 3 - message.length),
    Buffer.from([0]),
    message,
  ]);
  return rsaRaw(block, key);
}

/** RSA sem padding: o bloco é o texto com zeros à direita até ao tamanho da chave. */
export function rsaNoPadding(data: string, nHex: string, eHex: string): string {
  const key = rsaKey(nHex, eHex);
  const message = Buffer.from(data, 'utf8');
  if (message.length > key.size) {
    throw new Error('Texto grande demais para a chave RSA do router.');
  }
  return rsaRaw(
    Buffer.concat([message, Buffer.alloc(key.size - message.length)]),
    key,
  );
}

const sha1 = (data: Buffer) => createHash('sha1').update(data).digest();

function mgf1(seed: Buffer, length: number): Buffer {
  const parts: Buffer[] = [];
  for (let counter = 0; Buffer.concat(parts).length < length; counter += 1) {
    const c = Buffer.alloc(4);
    c.writeUInt32BE(counter);
    parts.push(sha1(Buffer.concat([seed, c])));
  }
  return Buffer.concat(parts).subarray(0, length);
}

const xor = (a: Buffer, b: Buffer) =>
  Buffer.from(a.map((byte, i) => byte ^ b[i]));

/** RSA com OAEP e SHA-1 (a assinatura do login nos routers "SG", ex.: Archer BE3600). */
export function rsaOaep(data: string, nHex: string, eHex: string): string {
  const key = rsaKey(nHex, eHex);
  const message = Buffer.from(data, 'utf8');
  const hashLength = 20;
  if (message.length > key.size - 2 * hashLength - 2) {
    throw new Error('Texto grande demais para a chave RSA do router.');
  }
  const db = Buffer.concat([
    sha1(Buffer.alloc(0)),
    Buffer.alloc(key.size - message.length - 2 * hashLength - 2),
    Buffer.from([1]),
    message,
  ]);
  const seed = randomBytes(hashLength);
  const maskedDb = xor(db, mgf1(seed, db.length));
  const maskedSeed = xor(seed, mgf1(maskedDb, hashLength));
  return rsaRaw(Buffer.concat([Buffer.from([0]), maskedSeed, maskedDb]), key);
}

/** AES-128-CBC com PKCS#7; a chave e o IV são texto (16 caracteres), como na página do router. */
export function aesEncrypt(plain: string, key: string, iv: string): string {
  const cipher = createCipheriv(
    'aes-128-cbc',
    Buffer.from(key),
    Buffer.from(iv),
  );
  return Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]).toString(
    'base64',
  );
}

/** O inverso; tira o enchimento à mão (alguns routers mandam bytes estranhos nos nomes). */
export function aesDecrypt(encrypted: string, key: string, iv: string): string {
  const decipher = createDecipheriv(
    'aes-128-cbc',
    Buffer.from(key),
    Buffer.from(iv),
  );
  decipher.setAutoPadding(false);
  const data = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]);
  const pad = data[data.length - 1];
  const plain =
    pad >= 1 && pad <= 16 ? data.subarray(0, data.length - pad) : data;
  return plain.toString('utf8');
}

export const md5Hex = (text: string) =>
  createHash('md5').update(text).digest('hex');

export const sha256Hex = (text: string) =>
  createHash('sha256').update(text).digest('hex');

export const hmacSha256Hex = (key: string, text: string) =>
  createHmac('sha256', key).update(text).digest('hex');

/** A chave e o IV clássicos: 8 bytes aleatórios em hex (16 caracteres). */
export const randomHexKey = () => randomBytes(8).toString('hex');

/** A chave e o IV dos routers "SG": 16 algarismos ao calhas. */
export const randomDigits = (length = 16) =>
  Array.from({ length }, () => String(randomInt(0, 10))).join('');

/** Divide um texto em pedaços de `size` caracteres. */
export function chunks(text: string, size: number): string[] {
  const parts: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    parts.push(text.slice(index, index + size));
  }
  return parts;
}
