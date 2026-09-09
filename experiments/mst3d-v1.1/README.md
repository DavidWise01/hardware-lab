# MST-3D v1.1 candidate — independent coherence and scaling checks

Status: DRAFT, 2026-09-09. Base commit: d08630e1f4f8ab5cbe531e8fec3e350e07d08243. This directory adds a candidate; the root-level frozen v1.0 solver, contract, tests and web workbench remain on v1.0.

## Problem and correction

The solver uses i*dpsi/dtau = [-1/2 laplacian + V] psi. With x=L0*xprime and t=t0*tau, the dimensional Schrodinger equation gives a kinetic coefficient hbar*t0/(2*m*L0^2). If t0=hbar/E0, this becomes hbar^2/(2*m*L0^2*E0).

The v1.0 conversion E0=hbar^2/(2*m*L0^2) gives coefficient 1, conflicting with the actual solver's 1/2. Its numerical propagation is internally coherent, but the advertised energy/time interpretation is inconsistent.

The v1.1 candidate uses E0=hbar^2/(m*L0^2) and t0=hbar/E0. For L0=1 nm and m=electron mass, E0 changes from 0.03809982106299685 to 0.0761996421259937 eV; t0 changes from 17.275985508154353 to 8.637992754077176 fs. The discrete evolution is untouched, and the frozen numerical checksum still passes.

The draft contract adds the scaling equations and a freshly computed content checksum. Its DRAFT status does not claim a new accepted freeze. Regression expectations change only for the new version, draft status and corrected SI units.

## Six independent checks

These six checks were selected for this solver validation; they are not a retrieved pre-existing six-target project list or solutions to open mathematical problems.

| Check | Why it matters | v1.0 | v1.1 |
|---|---|---|---|
| C1 Analytic free Fourier eigenmode | Detect wrong kinetic sign, coefficient or Fourier ordering | PASS: 3.88e-15 state error | PASS |
| C2 Complex superposition linearity | Detect loss of interference relationships | PASS: 2.61e-15 error | PASS |
| C3 Complex overlap conservation | Check phase-sensitive unitarity beyond norm | PASS: 3.44e-16 error | PASS |
| C4 Forward/reverse complex-state recovery | Check reversibility including phase | PASS: 4.31e-14 error | PASS |
| C5 Exact discrete Hamiltonian reference | Compare JS propagation with independent NumPy FFT and eigensolver | PASS: time-halving ratios 4.0013 and 4.0003 | PASS |
| C6 Recover coefficient from physical units | Catch unit conversion inconsistent with equation | FAIL: coefficient 1 | PASS: coefficient .5 |

Existing MST-3D v1.0 suite: 23/23 pass. v1.1 adapted regression suite: 23/23 pass. QT-211 suite previously executed: 27/27 pass. Original M08 checked a frozen numeric value rather than deriving consistency; C6 supplies the independent check.

## Reproduce from repository root

Requires Node.js and Python 3 with NumPy (tested Node 24.19.0, NumPy 2.3.5).

```sh
node --test experiments/mst3d-v1.1/v1.1/tests/matter-state-transformer-model.test.js
node experiments/mst3d-v1.1/check.js matter-state-transformer-model.js /tmp/mst-before.json
python experiments/mst3d-v1.1/exact_reference.py /tmp/mst-before.json
node experiments/mst3d-v1.1/check.js experiments/mst3d-v1.1/v1.1/matter-state-transformer-model.js /tmp/mst-after.json
python experiments/mst3d-v1.1/exact_reference.py /tmp/mst-after.json
```

Check scripts report pass/fail in JSON; a successful process exit alone does not assert every check passed. v1.0 is intentionally expected to report 5/6; v1.1 reports 6/6. Regression test uses Node assertions.

## Scope

Single-particle periodic-box pure-state simulation. C5 diagonalizes the same 4x4x4 discretized Hamiltonian and verifies time convergence; it does not establish spatial convergence, continuum scattering accuracy, device performance, open-system coherence time, or multi-particle entanglement. The baseline Bell-pair experiment was a separate standard three-qubit test, not a function of this solver. Six numerical checks are not Millennium-problem proofs.

The root-level deployed workbench is not switched to this candidate. Integrating it requires updating its scale/version labels and adopting a new contract version explicitly.

## Sources

- Existing model and contract: https://github.com/DavidWise01/hardware-lab/tree/d08630e1f4f8ab5cbe531e8fec3e350e07d08243
- MIT OpenCourseWare, free-particle Schrodinger equation and energy: https://ocw.mit.edu/courses/5-61-physical-chemistry-fall-2017/resources/quantum-mechanics-free-particle-and-particle-in-1d-box/
- IBM Quantum, fidelity and state metrics used in the preceding standard baseline: https://quantum.cloud.ibm.com/docs/en/api/qiskit/quantum_info

All numeric outcomes in this report were produced by the included checks, not attributed to the references as experimental measurements.
