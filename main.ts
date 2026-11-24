// A tiny stack VM for make.fun's ISA v1: stdlib only, no clock, no randomness, so
// two runs agree byte for byte. Wrapping MUL, INT_MIN/-1, the remainder's sign,
// DIVU/MODU/LTU on negatives, shifts masked to 5 bits, SHR vs SHRU, PUSH8 sign
// extension, EXIT's low byte, and a trap keeping the output written before it.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SM = 256, CM = 64, WM = 256, SL = 1e6, OL = 65536;
// Per opcode: immediate bytes (255 = no opcode), pops, pushes.
const IM = new Uint8Array(256).fill(255), PO = new Uint8Array(256), PU = new Uint8Array(256);
const op = (b, i, p, u) => { IM[b] = i; PO[b] = p; PU[b] = u; };

op(0, 0, 0, 0); op(1, 1, 0, 1); op(2, 4, 0, 1); op(3, 0, 1, 0);
op(4, 0, 1, 2); op(5, 0, 2, 2); op(6, 0, 2, 3); op(7, 0, 3, 3);
for (const b of [16,17,18,19,20,21,22,24,25,26,28,29,30,32,33,34]) op(b, 0, 2, 1);
op(23, 0, 1, 1); op(27, 0, 1, 1);
op(48, 2, 0, 0); op(49, 2, 1, 0); op(50, 2, 1, 0); op(51, 2, 0, 0); op(52, 0, 0, 0);
op(64, 0, 1, 1); op(65, 0, 2, 0);
op(80, 0, 1, 0); op(81, 0, 1, 0); op(82, 0, 0, 1); op(83, 0, 1, 0);

/** Run one program: the bytes it wrote and the code it ended with. */
function run(P, I) {
  const n = P.length, il = I.length;
  const S = new Int32Array(SM), C = new Int32Array(CM), M = new Int32Array(WM), O = new Uint8Array(OL);
  let sp = 0, cp = 0, ol = 0, pc = 0, st = 0, ii = 0;
  const end = (c) => [O.subarray(0, ol), c];

  for (;;) {
    if (st >= SL) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const b = P[pc], im = IM[b];
    if (im === 255) return end(5);
    if (pc + im >= n) return end(9);
    if (sp < PO[b]) return end(2);
    if (sp - PO[b] + PU[b] > SM) return end(3);

    let a = 0;
    if (im === 1) a = P[pc + 1];
    else if (im === 2) a = P[pc + 1] | (P[pc + 2] << 8);
    else if (im === 4) a = P[pc + 1] | (P[pc + 2] << 8) | (P[pc + 3] << 16) | (P[pc + 4] << 24);
    const nx = pc + 1 + im;
    st++;

    let y = 0, x = 0;
    switch (b) {
      case 0: return end(0);
      case 1: S[sp++] = (a << 24) >> 24; pc = nx; break;
      case 2: S[sp++] = a; pc = nx; break;
      case 3: sp--; pc = nx; break;
      case 4: S[sp] = S[sp - 1]; sp++; pc = nx; break;
      case 5: y = S[sp - 1]; S[sp - 1] = S[sp - 2]; S[sp - 2] = y; pc = nx; break;
      case 6: S[sp] = S[sp - 2]; sp++; pc = nx; break;
      case 7: // ROT ( a b c -- b c a )
        y = S[sp - 1]; x = S[sp - 2];
        S[sp - 1] = S[sp - 3]; S[sp - 2] = y; S[sp - 3] = x; pc = nx; break;

      case 16: y = S[--sp]; S[sp - 1] = (S[sp - 1] + y) | 0; pc = nx; break;
      case 17: y = S[--sp]; S[sp - 1] = (S[sp - 1] - y) | 0; pc = nx; break;
      case 18: y = S[--sp]; S[sp - 1] = Math.imul(S[sp - 1], y); pc = nx; break;
      case 19: // DIV: toward zero, INT_MIN/-1 wraps
        y = S[--sp]; x = S[sp - 1];
        if (!y) return end(4);
        S[sp - 1] = (x / y) | 0; pc = nx; break;
      case 20: // MOD: the sign of the dividend
        y = S[--sp]; x = S[sp - 1];
        if (!y) return end(4);
        S[sp - 1] = (x % y) | 0; pc = nx; break;
      case 21:
        y = S[--sp] >>> 0; x = S[sp - 1] >>> 0;
        if (!y) return end(4);
        S[sp - 1] = Math.floor(x / y) | 0; pc = nx; break;
      case 22:
        y = S[--sp] >>> 0; x = S[sp - 1] >>> 0;
        if (!y) return end(4);
        S[sp - 1] = (x % y) | 0; pc = nx; break;
      case 23: S[sp - 1] = -S[sp - 1] | 0; pc = nx; break;
      case 24: y = S[--sp]; S[sp - 1] &= y; pc = nx; break;
      case 25: y = S[--sp]; S[sp - 1] |= y; pc = nx; break;
      case 26: y = S[--sp]; S[sp - 1] ^= y; pc = nx; break;
      case 27: S[sp - 1] = ~S[sp - 1]; pc = nx; break;
      case 28: y = S[--sp] & 31; S[sp - 1] = S[sp - 1] << y; pc = nx; break;
      case 29: y = S[--sp] & 31; S[sp - 1] = S[sp - 1] >> y; pc = nx; break;
      case 30: y = S[--sp] & 31; S[sp - 1] = S[sp - 1] >>> y; pc = nx; break;
      case 32: y = S[--sp]; S[sp - 1] = S[sp - 1] === y ? 1 : 0; pc = nx; break;
      case 33: y = S[--sp]; S[sp - 1] = S[sp - 1] < y ? 1 : 0; pc = nx; break;
      case 34: y = S[--sp] >>> 0; S[sp - 1] = (S[sp - 1] >>> 0) < y ? 1 : 0; pc = nx; break;

      case 48: pc = nx + ((a << 16) >> 16); break;
      case 49: y = S[--sp]; pc = y === 0 ? nx + ((a << 16) >> 16) : nx; break;
      case 50: y = S[--sp]; pc = y !== 0 ? nx + ((a << 16) >> 16) : nx; break;
      case 51: // CALL, immediate unsigned
        if (cp >= CM) return end(7);
        C[cp++] = nx; pc = a & 0xffff; break;
      case 52:
        if (!cp) return end(8);
        pc = C[--cp]; break;

      case 64:
        y = S[sp - 1];
        if (y < 0 || y >= WM) return end(6);
        S[sp - 1] = M[y]; pc = nx; break;
      case 65: // STORE ( v addr -- )
        y = S[--sp]; x = S[--sp];
        if (y < 0 || y >= WM) return end(6);
        M[y] = x; pc = nx; break;

      case 80: { // PRINT: decimal, leading -
        const t = String(S[--sp]);
        if (ol + t.length > OL) return end(11);
        for (let k = 0; k < t.length; k++) O[ol++] = t.charCodeAt(k);
        pc = nx; break;
      }
      case 81:
        if (ol >= OL) return end(11);
        O[ol++] = S[--sp] & 0xff; pc = nx; break;
      case 82: S[sp++] = ii < il ? I[ii++] : -1; pc = nx; break;
      case 83: return end(S[--sp] & 0xff);
      default: return end(5); // unreachable
    }
  }
}

const IN = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
for (const id of readdirSync(IN).sort()) {
  let p, i;
  try {
    p = readFileSync(join(IN, id, "program.bin"));
    i = readFileSync(join(IN, id, "input.bin"));
  } catch {
    continue;
  }
  const [bytes, code] = run(p, i);
  const d = join(OUT, id);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "stdout.bin"), bytes);
  writeFileSync(join(d, "exit.txt"), String(code));
}
