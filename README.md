# tiny-stack-vm-01-run-20261122-lucky-tapir-48

[![make.fun · tiny-stack-vm-01-run-20261122](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/bongekanjing/tiny-stack-vm-01-run-20261122-lucky-tapir-48/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122/leaderboard)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/bongekanjing/tiny-stack-vm-01-run-20261122-lucky-tapir-48/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)

An interpreter for make.fun's tiny stack ISA v1 for
[the bounty](https://make.fun/bounty/tiny-stack-vm-01-run-20261122).

Practice set, the kit's sealed scorer: `{"answered":40,"instances":40,
"passed":1,"score":1000000}` — 40000 of 40000 points: every output matches the reference
VM byte for byte and every exit code, traps included.

A table per opcode holds its immediate's length and its pops and pushes. A trap
returns the output written so far, because a trap's output is kept. `MUL` is
`Math.imul`; `DIV` truncates toward zero and `-2147483648 / -1` wraps; `MOD`
keeps the dividend's sign; `DIVU`/`MODU`/`LTU` read unsigned; shift counts take
their low five bits; `PUSH8` sign-extends; `EXIT` keeps its low byte. Nothing
reads the clock, so runs agree.

    MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts

MIT, see `LICENSE`.
