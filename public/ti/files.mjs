// TI variable file reader. Original program bytes are decoded, never evaluated as JavaScript.
export function variableFile(input) {
  const b = new Uint8Array(input);
  const u16 = i => b[i] | b[i + 1] << 8;
  const signature = String.fromCharCode(...b.slice(0, 8));
  if (b.length < 74 || !['**TI83**', '**TI83F*'].includes(signature)) throw Error('Not a TI-83 variable file');
  const end = 55 + u16(53);
  if (end + 2 !== b.length) throw Error('Truncated calculator file');
  let sum = 0;
  for (const byte of b.slice(55, end)) sum = (sum + byte) & 65535;
  if (sum !== u16(end)) throw Error('Calculator file checksum mismatch');
  const header = u16(55), length = u16(57), offset = 57 + header;
  if (![11, 13].includes(header) || u16(offset) !== length || offset + 2 + length !== end) throw Error('Unsupported variable layout');
  return { type: b[59], data: b.slice(offset + 2, end) };
}

export function decodeProgram(input, table) {
  const { type, data } = variableFile(input);
  if (type !== 5 || (data[0] | data[1] << 8) !== data.length - 2) throw Error('Invalid BASIC program');
  let source = '';
  for (let i = 2; i < data.length; i++) {
    let key = data[i].toString(16).padStart(2, '0');
    if (!(key in table)) key += data[++i]?.toString(16).padStart(2, '0');
    if (!(key in table)) throw Error(`Unsupported TI token ${key}`);
    source += table[key];
  }
  return source;
}

export function decodeList(input) {
  const { type, data } = variableFile(input);
  const count = data[0] | data[1] << 8;
  if (type !== 1 || data.length !== 2 + 9 * count) throw Error('Invalid real list');
  return Array.from({ length: count }, (_, n) => {
    const i = 2 + n * 9;
    let digits = '';
    for (const byte of data.slice(i + 2, i + 9)) {
      if ((byte >> 4) > 9 || (byte & 15) > 9) throw Error('Invalid BCD digit');
      digits += `${byte >> 4}${byte & 15}`;
    }
    return Number(`${data[i] & 128 ? '-' : ''}${digits[0]}.${digits.slice(1)}e${data[i + 1] - 128}`);
  });
}

export function decodePicture(input) {
  const { type, data } = variableFile(input);
  if (type !== 7 || data.length !== 758 || (data[0] | data[1] << 8) !== 756) throw Error('Invalid monochrome picture');
  const pixels = new Uint8Array(96 * 64);
  for (let i = 0; i < 96 * 63; i++) pixels[i] = (data[2 + (i >> 3)] >> (7 - (i & 7))) & 1;
  return pixels;
}
