// A deliberately scoped TI-BASIC interpreter for the recovered GAME and PQ programs.
// No game rules live here. Unsupported instructions fail visibly rather than being ignored.
export const numeric = n => {
  if (!Number.isFinite(n) || Math.abs(n) >= 1e100) throw Error('ERR:OVERFLOW');
  return Number(n.toPrecision(14));
};
export const formatNumber = n => String(Number(n.toPrecision(10))).replace('-', '⁻');

export function splitStatements(source) {
  const statements = [];
  let text = '', quoted = false, line = 1, startLine = 1;
  const flush = () => { if (text.trim()) statements.push({ text: text.trim(), line: startLine }); text = ''; };
  for (const c of source) {
    if (c === '\n' || (c === ':' && !quoted)) {
      flush();
      if (c === '\n') { quoted = false; line++; }
      startLine = line;
    } else { text += c; if (c === '"') quoted = !quoted; }
  }
  flush();
  return statements;
}

const precedence = { and: 1, '=': 2, '≠': 2, '<': 2, '>': 2, '≤': 2, '≥': 2, '+': 3, '-': 3, '*': 4, '/': 4 };
function lex(source) {
  const tokens = [];
  for (let i = 0; i < source.length;) {
    if (/\s/.test(source[i])) { i++; continue; }
    if (source[i] === '"') {
      const end = source.indexOf('"', i + 1);
      tokens.push({ string: source.slice(i + 1, end < 0 ? source.length : end) });
      i = end < 0 ? source.length : end + 1;
      continue;
    }
    const match = source.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+|ʟ[A-Z][A-Z0-9]*|iPart|and|[A-Zθ]|[()+*/⁻\-<>=≤≥≠,→])/);
    if (!match) throw Error(`Unsupported expression: ${source.slice(i)}`);
    tokens.push(match[0]); i += match[0].length;
  }
  return tokens;
}

class Parser {
  constructor(source) { this.tokens = lex(source); this.i = 0; }
  peek() { return this.tokens[this.i]; }
  take() { return this.tokens[this.i++]; }
  close() { if (this.peek() === ')') this.take(); else if (this.peek() !== undefined && this.peek() !== '→') throw Error('ERR:SYNTAX (parenthesis)'); }
  read(min = 0) {
    const t = this.take();
    let left;
    if (t && typeof t === 'object') left = { kind: 'string', value: t.string };
    else if (typeof t === 'string' && /^(?:\d|\.)/.test(t)) left = { kind: 'number', value: Number(t) };
    else if (t === '(') { left = this.read(); this.close(); }
    else if (t === '⁻' || t === '-') left = { kind: 'negate', value: this.read(5) };
    else if (t === 'iPart') {
      if (this.take() !== '(') throw Error('ERR:SYNTAX (iPart)');
      left = { kind: 'integer', value: this.read() }; this.close();
    } else if (typeof t === 'string' && t.startsWith('ʟ')) {
      if (this.take() !== '(') throw Error('ERR:SYNTAX (list)');
      left = { kind: 'list', name: t.slice(1), index: this.read() }; this.close();
    } else if (typeof t === 'string' && /^[A-Zθ]$/.test(t)) left = { kind: 'variable', name: t };
    else throw Error(`ERR:SYNTAX (${String(t)})`);
    while (precedence[this.peek()] !== undefined && precedence[this.peek()] >= min) {
      const op = this.take();
      left = { kind: 'binary', op, left, right: this.read(precedence[op] + 1) };
    }
    return left;
  }
  end() { if (this.i !== this.tokens.length) throw Error(`ERR:SYNTAX (unexpected ${String(this.peek())})`); }
  args() {
    const args = [];
    while (this.peek() !== undefined && this.peek() !== ')') {
      args.push(this.read());
      if (this.peek() !== ',') break;
      this.take();
    }
    if (this.peek() === ')') this.take();
    this.end();
    return args;
  }
}

function expression(text) { const p = new Parser(text); const a = p.read(); p.end(); return a; }
function instruction(text) {
  if (/^Lbl /.test(text)) return { op: 'label', label: text.slice(4) };
  if (/^Goto /.test(text)) return { op: 'goto', label: text.slice(5) };
  if (/^prgm/.test(text)) return { op: 'call', name: text.slice(4) };
  if (/^If /.test(text)) return { op: 'if', condition: expression(text.slice(3)) };
  if (text.startsWith('Menu(')) {
    const p = new Parser(text.slice(5)), title = p.take();
    if (!title || typeof title !== 'object') throw Error('Invalid menu title');
    const items = [];
    while (p.peek() === ',') {
      p.take(); const item = p.take();
      if (!item || typeof item !== 'object' || p.take() !== ',') throw Error('Invalid menu item');
      let label = '';
      while (p.peek() !== ',' && p.peek() !== ')' && p.peek() !== undefined) label += p.take();
      items.push({ text: item.string, label });
    }
    if (p.peek() === ')') p.take(); p.end();
    if (!items.length || items.length > 7) throw Error('Invalid menu size');
    return { op: 'menu', title: title.string, items };
  }
  const command = text.match(/^(Pxl-On|Pxl-Off|Text|Output|Line)\(/);
  if (command) return { op: command[1], args: new Parser(text.slice(command[0].length)).args() };
  if (/^Disp /.test(text)) return { op: 'Disp', args: new Parser(text.slice(5)).args() };
  if (/^RecallPic /.test(text)) return { op: 'RecallPic', value: expression(text.slice(10)) };
  if (text === 'Pause') return { op: 'pause' };
  if (['ClrHome', 'ClrDraw', 'ZStandard', 'AxesOff', 'AxesOn', 'CoordOff', 'CoordOn', 'Stop', 'End'].includes(text)) return { op: text };
  const p = new Parser(text), value = p.read();
  if (p.peek() === '→') {
    p.take(); const target = p.read(); p.end();
    if (!['variable', 'list'].includes(target.kind)) throw Error('Invalid store target');
    return { op: 'store', value, target };
  }
  p.end(); return { op: 'expression', value };
}

export function compile(source) {
  const code = splitStatements(source).map(({ text, line }) => {
    try { return { ...instruction(text), line, text }; }
    catch (error) { throw Error(`Line ${line}: ${error.message}`); }
  });
  const labels = new Map();
  // TI searches from the beginning. The original contains two A4 labels.
  code.forEach((s, i) => { if (s.op === 'label' && !labels.has(s.label)) labels.set(s.label, i); });
  for (const s of code) {
    const destinations = s.op === 'goto' ? [s.label] : s.op === 'menu' ? s.items.map(i => i.label) : [];
    for (const label of destinations) if (!labels.has(label)) throw Error(`Missing label ${label}`);
  }
  return { code, labels };
}

export class Runtime {
  constructor(programs, display, lists) {
    this.programs = programs; this.display = display;
    this.lists = structuredClone(lists); this.variables = {}; this.stack = [];
    this.program = 'GAME'; this.pc = 0; this.wait = null; this.error = null; this.steps = 0;
    this.axes = false; this.coordinates = false;
  }
  eval(a) {
    switch (a.kind) {
      case 'number': case 'string': return a.value;
      case 'variable': return this.variables[a.name] ?? 0;
      case 'list': {
        const index = this.eval(a.index), list = this.lists[a.name];
        if (!list) throw Error(`ERR:UNDEFINED (${a.name})`);
        if (!Number.isInteger(index) || index < 1 || index > list.length) throw Error('ERR:INVALID DIM');
        return list[index - 1];
      }
      case 'negate': return -this.eval(a.value);
      case 'integer': return Math.trunc(this.eval(a.value));
      case 'binary': {
        const l = this.eval(a.left), r = this.eval(a.right);
        switch (a.op) {
          case '+': return numeric(l + r); case '-': return numeric(l - r);
          case '*': return numeric(l * r);
          case '/': if (r === 0) throw Error('ERR:DIVIDE BY 0'); return numeric(l / r);
          case '=': return +(l === r); case '≠': return +(l !== r);
          case '<': return +(l < r); case '>': return +(l > r);
          case '≤': return +(l <= r); case '≥': return +(l >= r);
          case 'and': return +(Boolean(l) && Boolean(r));
        }
      }
    }
    throw Error('Unsupported expression');
  }
  store(target, value) {
    if (typeof value !== 'number') throw Error('ERR:DATA TYPE');
    value = numeric(value);
    if (target.kind === 'variable') this.variables[target.name] = value;
    else {
      const index = this.eval(target.index), list = this.lists[target.name];
      if (!list || !Number.isInteger(index) || index < 1 || index > list.length + 1) throw Error('ERR:INVALID DIM');
      list[index - 1] = value;
    }
  }
  jump(label) {
    const pc = this.programs[this.program].labels.get(label);
    if (pc === undefined) throw Error(`ERR:LABEL (${label})`);
    this.pc = pc + 1;
  }
  restart() {
    this.program = 'GAME'; this.pc = 0; this.stack = []; this.wait = null; this.error = null;
    this.display.clearHome(); this.display.clearGraph();
  }
  key(key) {
    if (this.wait?.type === 'menu') {
      if (key === 'ArrowUp' || key === 'ArrowDown') {
        const n = this.wait.items.length;
        this.wait.selected = (this.wait.selected + (key === 'ArrowUp' ? n - 1 : 1)) % n;
        this.display.menu(this.wait);
      } else if (key === 'Enter') {
        const label = this.wait.items[this.wait.selected].label;
        this.wait = null; this.display.clearHome(); this.jump(label);
      }
    } else if (this.wait?.type === 'pause' && key === 'Enter') this.wait = null;
  }
  run(budget = 2000) {
    let executed = 0;
    try {
      while (!this.wait && executed < budget) {
        const code = this.programs[this.program].code;
        if (this.pc >= code.length) {
          if (this.stack.length) { const frame = this.stack.pop(); this.program = frame.program; this.pc = frame.pc; continue; }
          this.wait = { type: 'stop' }; break;
        }
        const s = code[this.pc++]; executed++; this.steps++;
        switch (s.op) {
          case 'label': case 'expression': break;
          case 'goto': this.jump(s.label); break;
          case 'store': this.store(s.target, this.eval(s.value)); break;
          case 'if': if (!this.eval(s.condition)) this.pc++; break;
          case 'call':
            if (!this.programs[s.name] || this.stack.length >= 16) throw Error('ERR:PROGRAM');
            this.stack.push({ program: this.program, pc: this.pc }); this.program = s.name; this.pc = 0; break;
          case 'menu':
            this.wait = { type: 'menu', title: s.title, items: s.items, selected: 0 };
            this.display.menu(this.wait); break;
          case 'pause': this.wait = { type: 'pause' }; break;
          case 'Stop': this.wait = { type: 'stop' }; break;
          case 'End': throw Error('ERR:SYNTAX (unmatched End)');
          case 'ClrHome': this.display.clearHome(); break;
          case 'ClrDraw': this.display.clearGraph(); break;
          case 'ZStandard': break; // The only graph window supported here is the original -10..10 window.
          case 'AxesOn': this.axes = true; break; case 'AxesOff': this.axes = false; break;
          case 'CoordOn': this.coordinates = true; break; case 'CoordOff': this.coordinates = false; break;
          case 'RecallPic': this.display.recall(this.eval(s.value)); break;
          default: {
            const args = s.args.map(a => this.eval(a));
            switch (s.op) {
              case 'Pxl-On': this.display.pixel(...args, 1); break;
              case 'Pxl-Off': this.display.pixel(...args, 0); break;
              case 'Text': this.display.text(...args); break;
              case 'Output': this.display.output(...args); break;
              case 'Disp': this.display.disp(...args); break;
              case 'Line': this.display.line(...args); break;
              default: throw Error(`Unsupported command ${s.op}`);
            }
          }
        }
      }
    } catch (error) {
      this.error = `${error.message} · ${this.program}:${this.programs[this.program].code[this.pc - 1]?.line ?? '?'}`;
      this.wait = { type: 'error' };
    }
    return executed;
  }
  snapshot() {
    return { program: this.program, pc: this.pc, variables: structuredClone(this.variables), lists: structuredClone(this.lists), stack: structuredClone(this.stack), wait: structuredClone(this.wait), error: this.error, steps: this.steps, display: this.display.snapshot() };
  }
  restore(state) {
    if (!state || !this.programs[state.program] || !Number.isInteger(state.pc) || state.pc < 0 || state.pc > this.programs[state.program].code.length) throw Error('Invalid saved program position');
    const validateFrame = f => f && this.programs[f.program] && Number.isInteger(f.pc) && f.pc >= 0 && f.pc <= this.programs[f.program].code.length;
    if (!Array.isArray(state.stack) || state.stack.length > 16 || !state.stack.every(validateFrame)) throw Error('Invalid saved stack');
    const numbers = v => Array.isArray(v) && v.length <= 999 && v.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) < 1e100);
    if (!state.lists || !numbers(state.lists.GAME) || state.lists.GAME.length < 100 || !numbers(state.lists.PQGD) || state.lists.PQGD.length < 3) throw Error('Invalid saved lists');
    if (!state.variables || Array.isArray(state.variables) || !Object.entries(state.variables).every(([k, v]) => /^[A-Zθ]$/.test(k) && typeof v === 'number' && Number.isFinite(v))) throw Error('Invalid saved variables');
    if (state.wait !== null && !['pause', 'menu', 'stop', 'error'].includes(state.wait?.type)) throw Error('Invalid saved input state');
    let wait = state.wait;
    if (wait?.type === 'menu') {
      const instruction = this.programs[state.program].code[state.pc - 1];
      if (instruction?.op !== 'menu' || !Number.isInteger(wait.selected) || wait.selected < 0 || wait.selected >= instruction.items.length) throw Error('Invalid saved menu');
      wait = { type: 'menu', title: instruction.title, items: instruction.items, selected: wait.selected };
    }
    this.display.restore(state.display);
    this.program = state.program; this.pc = state.pc; this.variables = structuredClone(state.variables);
    this.lists = { GAME: [...state.lists.GAME], PQGD: [...state.lists.PQGD] }; this.stack = structuredClone(state.stack);
    this.wait = structuredClone(wait); this.error = typeof state.error === 'string' ? state.error.slice(0, 300) : null;
    this.steps = Number.isSafeInteger(state.steps) ? state.steps : 0;
  }
}
