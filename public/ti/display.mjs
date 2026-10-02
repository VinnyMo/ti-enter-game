import { formatNumber } from './runtime.mjs';

// Hand-drawn small glyphs; proportional metrics follow the TI Text() display.
// These are an approximation pending comparison with a physical calculator/ROM.
const SMALL_ROWS = {
  A:'010/101/111/101/101',B:'110/101/110/101/110',C:'011/100/100/100/011',D:'110/101/101/101/110',
  E:'111/100/110/100/111',F:'111/100/110/100/100',G:'011/100/101/101/011',H:'101/101/111/101/101',
  I:'1/1/1/1/1',J:'001/001/001/101/010',K:'101/101/110/101/101',L:'100/100/100/100/111',
  M:'10001/11011/10101/10001/10001',N:'1001/1101/1011/1001/1001',O:'010/101/101/101/010',
  P:'110/101/110/100/100',Q:'010/101/101/011/001',R:'110/101/110/101/101',S:'011/100/010/001/110',
  T:'111/010/010/010/010',U:'101/101/101/101/111',V:'101/101/101/101/010',W:'10001/10001/10101/11011/10001',
  X:'101/101/010/101/101',Y:'101/101/010/010/010',Z:'111/001/010/100/111',
  '0':'111/101/101/101/111','1':'010/110/010/010/111','2':'110/001/010/100/111',
  '3':'110/001/010/001/110','4':'101/101/111/001/001','5':'111/100/110/001/110',
  '6':'011/100/111/101/111','7':'111/001/010/010/010','8':'111/101/111/101/111','9':'111/101/111/001/110',
  ' ':'0/0/0/0/0','.':'0/0/0/0/1',',':'0/0/0/1/1',':':'0/1/0/1/0','!':'1/1/1/0/1',
  '?':'110/001/010/000/010','=':'000/111/000/111/000','-':'000/000/111/000/000','⁻':'111/000/000/000/000',
  '+':'000/010/111/010/000','*':'000/101/010/101/000','/':'001/001/010/100/100',
  '(':'01/10/10/10/01',')':'10/01/01/01/10',"'":'1/1/0/0/0','>':'100/010/001/010/100','<':'001/010/100/010/001'
};
const SMALL = Object.fromEntries(Object.entries(SMALL_ROWS).map(([c, rows]) => [c, rows.split('/')]));
const asText = value => typeof value === 'number' ? formatNumber(value) : String(value);

export class Display {
  constructor(font, pictures) {
    this.font = {};
    for (const [c, encoded] of Object.entries(font)) {
      const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      this.font[c] = Array.from({ length: 35 }, (_, i) => (bytes[4 + (i >> 3)] >> (7 - (i & 7))) & 1);
    }
    this.pictures = pictures;
    this.graph = new Uint8Array(96 * 64); this.home = new Uint8Array(96 * 64);
    this.mode = 'home'; this.cursor = 0; this.homeLines = Array(8).fill(''); this.graphText = [];
    this.dirty = true;
  }
  get pixels() { return this.mode === 'graph' ? this.graph : this.home; }
  setPixel(buffer, x, y, value) { if (x >= 0 && x < 96 && y >= 0 && y < 64) buffer[y * 96 + x] = value; }
  clearHome() { this.home.fill(0); this.cursor = 0; this.homeLines.fill(''); this.mode = 'home'; this.dirty = true; }
  clearGraph() { this.graph.fill(0); this.graphText = []; this.mode = 'graph'; this.dirty = true; }
  pixel(row, column, on) {
    if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || row > 62 || column < 0 || column > 94) throw Error('ERR:DOMAIN (pixel)');
    this.graph[row * 96 + column] = on; this.mode = 'graph'; this.dirty = true;
  }
  recall(number) {
    const pic = this.pictures[number];
    if (!pic) throw Error('ERR:UNDEFINED (picture)');
    for (let i = 0; i < this.graph.length; i++) this.graph[i] |= pic[i];
    this.mode = 'graph'; this.dirty = true;
  }
  text(row, column, ...values) {
    if (row < 0 || row > 57 || column < 0 || column > 94) throw Error('ERR:DOMAIN (text)');
    const text = values.map(asText).join('');
    let x = Math.trunc(column); row = Math.trunc(row);
    for (const c of text) {
      const glyph = SMALL[c] ?? SMALL[c.toUpperCase()] ?? SMALL['?'];
      const width = glyph[0].length;
      for (let y = 0; y < 6; y++) for (let dx = 0; dx <= width; dx++) this.setPixel(this.graph, x + dx, row + y, y < 5 && glyph[y][dx] === '1' ? 1 : 0);
      x += width + 1;
      if (x >= 96) break;
    }
    this.graphText = this.graphText.filter(item => item.row !== row || item.column !== column);
    if (text.trim()) this.graphText.push({ row, column, text });
    this.mode = 'graph'; this.dirty = true;
  }
  largeText(row, col, text, inverse = false) {
    for (const character of text) {
      if (col >= 16) { col = 0; row++; }
      if (row >= 8) break;
      const bits = this.font[character === '⁻' ? '~' : character] ?? this.font['?'];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) {
        const on = y < 7 && x < 5 ? bits[y * 5 + x] : 0;
        this.setPixel(this.home, col * 6 + x, row * 8 + y, inverse ? 1 - on : on);
      }
      const line = this.homeLines[row].padEnd(16, ' ');
      this.homeLines[row] = line.slice(0, col) + character + line.slice(col + 1);
      col++;
    }
  }
  output(row, col, value) {
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 1 || row > 8 || col < 1 || col > 16) throw Error('ERR:DOMAIN (Output)');
    this.largeText(row - 1, col - 1, asText(value)); this.mode = 'home'; this.dirty = true;
  }
  disp(...values) {
    this.mode = 'home';
    for (const value of values) {
      const text = asText(value);
      const lines = text.match(/.{1,16}/g) ?? [''];
      for (const line of lines) {
        if (this.cursor >= 8) {
          this.home.copyWithin(0, 96 * 8); this.home.fill(0, 96 * 56);
          this.homeLines.shift(); this.homeLines.push(''); this.cursor = 7;
        }
        this.largeText(this.cursor, 0, ' '.repeat(16));
        this.largeText(this.cursor++, typeof value === 'number' ? Math.max(0, 16 - line.length) : 0, line);
      }
    }
    this.dirty = true;
  }
  menu(menu) {
    this.clearHome(); this.largeText(0, 0, menu.title.slice(0, 16));
    menu.items.forEach((item, index) => {
      this.largeText(index + 1, 0, String(index + 1), index === menu.selected);
      this.largeText(index + 1, 1, ':' + item.text.slice(0, 14));
    });
    this.dirty = true;
  }
  line(x1, y1, x2, y2) {
    // ZStandard: graphing coordinates span 95 by 63 addressable pixels.
    let x = Math.round((x1 + 10) * 94 / 20), y = Math.round((10 - y1) * 62 / 20);
    const endX = Math.round((x2 + 10) * 94 / 20), endY = Math.round((10 - y2) * 62 / 20);
    const dx = Math.abs(endX - x), dy = -Math.abs(endY - y), sx = x < endX ? 1 : -1, sy = y < endY ? 1 : -1;
    let error = dx + dy;
    for (let guard = 0; guard < 1000; guard++) {
      this.setPixel(this.graph, x, y, 1);
      if (x === endX && y === endY) break;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x += sx; }
      if (twice <= dx) { error += dx; y += sy; }
    }
    this.mode = 'graph'; this.dirty = true;
  }
  description() {
    return this.mode === 'home' ? this.homeLines.map(l => l.trimEnd()).join('\n') : this.graphText.map(l => l.text).join('\n');
  }
  snapshot() {
    return { graph: Array.from(this.graph), home: Array.from(this.home), mode: this.mode, cursor: this.cursor, homeLines: [...this.homeLines], graphText: structuredClone(this.graphText) };
  }
  restore(state) {
    const pixels = a => Array.isArray(a) && a.length === 6144 && a.every(x => x === 0 || x === 1);
    if (!state || !pixels(state.graph) || !pixels(state.home) || !['home', 'graph'].includes(state.mode) || !Number.isInteger(state.cursor) || state.cursor < 0 || state.cursor > 8) throw Error('Invalid saved display');
    if (!Array.isArray(state.homeLines) || state.homeLines.length !== 8 || !state.homeLines.every(s => typeof s === 'string' && s.length <= 16)) throw Error('Invalid saved home screen');
    if (!Array.isArray(state.graphText) || state.graphText.length > 500 || !state.graphText.every(s => typeof s.text === 'string' && s.text.length <= 1000 && Number.isFinite(s.row) && Number.isFinite(s.column))) throw Error('Invalid saved text');
    this.graph.set(state.graph); this.home.set(state.home); this.mode = state.mode; this.cursor = state.cursor;
    this.homeLines = [...state.homeLines]; this.graphText = structuredClone(state.graphText); this.dirty = true;
  }
}
