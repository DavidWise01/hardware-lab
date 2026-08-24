# QT-211-Q4 Verification Record v1.0

**Contract:** `QT-211-Q4-BC-1.0`  
**Model:** `QT-211-Q4-1.0.0`  
**Frozen:** 2026-08-23T23:48:44Z  
**Normative SHA-256:** `f882dbd1b80cbe8efcf5c9d49a977276529f11b7953d0276a80ab168485348fb`

## Verdict

`PASS` — 27/27 deterministic gates passed in every trial. The remembered word `..--|..--.` remains classified as two opposing quadrants plus a terminal pilot; the verified four-quadrant word is `[..,-.,--,.-]|[-.,..,.-,--].`.

The four trips are frozen as a transport protocol: `LOCATE → CAPTURE → TRANSFER → CHOOSE → LOCATE`. The protocol is not classified as a spinor. A payload is classified as a spinor only when it is a normalized two-component complex vector evolved by SU(2); the reference implementation passes the 2π sign-flip and 4π return tests.

## Five-trial benchmark

| Trial | Assertions | Deterministic evaluations | Elapsed | Evaluations/s | Checksum |
|---:|---:|---:|---:|---:|---:|
| 1 | 27/27 | 1,000,000 | 220.488 ms | 4,535,401 | 60.148992691902 |
| 2 | 27/27 | 1,000,000 | 241.907 ms | 4,133,825 | 60.148992691902 |
| 3 | 27/27 | 1,000,000 | 255.061 ms | 3,920,636 | 60.148992691902 |
| 4 | 27/27 | 1,000,000 | 174.284 ms | 5,737,757 | 60.148992691902 |
| 5 | 27/27 | 1,000,000 | 219.126 ms | 4,563,584 | 60.148992691902 |

- Total assertions: **135/135 PASS**
- Total deterministic evaluations: **5,000,000**
- Median kernel time: **220.488 ms**
- Median throughput: **4,535,401 evaluations/s**
- Throughput range: **3,920,636–5,737,757 evaluations/s**
- Checksum agreement: **5/5 identical**

Throughput is descriptive, not normative. Correctness, checksum agreement, evidence boundaries, and the frozen contract seal are normative.

## Gates exercised

1. Exact `0.211 V` identity and `qV` conversion.
2. Silicon-bandgap boundary remains explicit.
3. Complete four-state I/Q bijection.
4. Four 90°-spaced phase quadrants.
5. Closed one-bit Gray cycle.
6. 180° involutive inversion.
7. Frozen reverse-inverse right word.
8. Linear input-amplitude scaling.
9. Odd low-bias current transfer.
10. Bounded WKB transmission.
11. Monotonic decrease with width and barrier height.
12. Honest two-quadrant parsing of the remembered word.
13. Fail-closed malformed state and WKB domains.
14. Frozen contract seal verification.
15. One-million-evaluation deterministic stress path.
16. Four-trip order and closure.
17. Spinor normalization, 2π sign flip, and 4π return.

## Browser boundary

- Inline browser script compilation: `PASS`.
- Canvas2D implementation: no external library or WebGL dependency.
- Local Playwright render: `NOT RUN` because the environment contains the Playwright package but no installed Chromium binary. No browser PASS is claimed from that attempt.
- Published-page render and interaction: post-push verification target.

## Physical claim boundary

`211 mV` is frozen as this design's candidate operating bias. It is not established as a universal silicon tunnelling threshold. The current and transmission readouts are outputs of a low-bias polynomial plus a rectangular-barrier WKB approximation, not laboratory measurements.
