# MST-3D verification record v1.0

Date: 2026-08-23  
Version: `MST-3D-1.0.0`  
Contract: `MST-3D-BC-1.0`  
Seal: `b1924bad1f35783c0dcc7e906ba5f7f359a083418da83e363662044b6d131ac4`

## Result

```text
MST-3D conformance:      23 / 23 PASS
QT-211 regression:       27 / 27 PASS
combined suite:          50 / 50 PASS
repeated combined runs:  5
aggregate assertions:    250 / 250 PASS
failed assertions:       0
```

## Long evolution witness

```text
grid:                    16 × 8 × 8
split-operator steps:    10,000
elapsed:                 1,794.208 ms
throughput:              5,573 steps/s
final norm:              0.999999999999657
absolute norm error:     3.4294789230671086e-13
regional closure:        0.999999999999657
weighted checksum:       51.849614344564
```

## Deterministic seal witness

The frozen small-grid state after 120 steps has weighted density checksum:

```text
46.251995456959357
```

Two independently initialized simulations evolved through the same 120 steps produce array distance exactly `0` in the JavaScript runtime used for verification.

## Physics boundary

Verified by this record:

- normalized three-dimensional complex state;
- radix-2 FFT round trips;
- split-operator norm conservation;
- numerical time-reversal recovery;
- material–vacuum–material potential topology;
- free versus barrier transfer distinction; and
- non-mutating numerical witness.

Not verified or claimed:

- a physical matter transformer;
- matter production or particle transmutation;
- fabricated junction performance;
- laboratory vacuum quality;
- relativistic or quantum-field effects; or
- physical measurement back-action.
