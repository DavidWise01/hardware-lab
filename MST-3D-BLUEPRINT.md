# MST-3D matter-state transformer

Version: `MST-3D-1.0.0`  
Glyph: `.|-|..`  
Contract: `MST-3D-BC-1.0`

## 1. Scope

MST-3D is a deterministic, nonrelativistic, single-particle matter-wave simulation. It evolves a normalized complex state through a material–vacuum–material potential barrier in three spatial dimensions.

It is a matter-**state** transformer. It does not create matter, transmute particles, implement quantum field theory, model a laboratory vacuum system, or predict fabricated-device performance.

## 2. Glyph binding

| Mark | Mathematical object | Physical reading |
|---|---|---|
| first `.` | normalized localized wave packet | input matter state |
| paired `| |` | interfaces at `x = -a` and `x = +a` | material boundaries enclosing a vacuum gap |
| `-` | sub-barrier complex amplitude | evanescent coupling across the vacuum gap |
| second `.` | probability in `x > +a` | transformed output state |
| final `.` | immutable snapshot of the solver arrays | read-only numerical witness |

The vacuum contains no substrate matter, but an electron referenced to the adjoining material sees a potential-energy barrier determined by the interface work function. The baseline therefore represents the bounded vacuum region as a positive potential slab.

## 3. Governing equation

The nondimensional time-dependent Schrödinger equation is

```text
i ∂ψ(r,t)/∂t = Hψ(r,t)
H = -(1/2)∇² + V(x,y,z)
```

with `ℏ = m = 1`. The potential is

```text
V(x,y,z) = Vvac · I(|x| ≤ a) + (g/2)(y² + z²)
```

where:

- `Vvac` is the vacuum-barrier height;
- `2a` is the vacuum-gap width;
- `g` is a weak transverse guide; and
- `I` is the indicator function.

The initialized matter state is a normalized three-dimensional Gaussian packet with longitudinal carrier wave number `k0`:

```text
ψ(x,y,z,0) = N exp[-(x-x0)²/(4σx²) - y²/(4σy²) - z²/(4σz²)] exp(ik0x)
```

## 4. Discrete volume

| Parameter | Frozen baseline |
|---|---:|
| grid | `32 × 16 × 16` complex samples |
| spacing | `Δx = Δy = Δz = 0.75 L0` |
| time step | `Δt = 0.018 t0` |
| input center | `x0 = -7 L0` |
| input widths | `σx = 1.15 L0`, `σy = σz = 1.0 L0` |
| carrier | `k0 = 3.2 L0^-1` |
| barrier height | `Vvac = 5.8 E0` |
| barrier half-width | `a = 0.9 L0` |
| guide strength | `g = 0.05 E0/L0²` |
| boundary | closed periodic computational volume |

Periodic boundaries preserve a closed, unitary numerical volume. The interactive workbench halts before the baseline packet can complete a full wraparound. This boundary is a numerical choice, not a claim of an infinite or physically periodic vacuum apparatus.

## 5. Propagator

Each step uses the second-order Strang split-operator Fourier approximation:

```text
U(Δt) ≈ exp(-iVΔt/2) F^-1 exp(-ik²Δt/2) F exp(-iVΔt/2)
```

The three-dimensional Fourier transform is applied as separable radix-2 one-dimensional FFTs along `z`, `y`, then `x`. The inverse performs the same axes with the inverse sign and `1/N` normalization.

Both the potential and kinetic substeps are pure phase multiplications. Their composition is unitary apart from floating-point roundoff.

## 6. Ports and witnesses

At every witness call, the grid is partitioned into three disjoint volumes:

```text
PL   = Σ |ψ|² for x < -a
Pvac = Σ |ψ|² for |x| ≤ a
PR   = Σ |ψ|² for x > +a
```

The required closure is

```text
PL + Pvac + PR = ||ψ||² = 1 ± floating-point tolerance.
```

The witness reports time, step count, norm, the three regional probabilities, and the probability-weighted `x` centroid. It does not change either complex array and therefore does not simulate measurement back-action.

## 7. Dimensional scaling

For a selected physical length `L0` and effective mass `m*`, the unit scales are

```text
E0 = ℏ² / (2m*L0²)
t0 = ℏ / E0
```

For `L0 = 1 nm` and `m* = me`:

- `E0 = 0.03809982106299685 eV`
- `t0 = 17.275985508154353 fs`

This mapping is illustrative. A device-specific mapping requires the actual electrode material, work function, effective mass, gap geometry, temperature, fields, surface state and environmental coupling.

## 8. Verification gates

The frozen suite requires:

1. valid power-of-two volume dimensions;
2. normalized initial state;
3. one-dimensional and three-dimensional FFT round trips;
4. correct vacuum-region potential topology;
5. bounded and monotonic sub-barrier WKB reference values;
6. probability norm conservation;
7. forward/reverse recovery;
8. forward propagation of the free packet;
9. transfer suppression by the vacuum barrier relative to the free baseline;
10. read-only witness behavior;
11. deterministic array evolution and checksum; and
12. fail-closed validation of invalid domains.

The exact normative object and SHA-256 seal are stored in `benchmarks/mst-3d-contract-v1.0.json`.

## 9. Renderer

The web workbench uses a custom WebGL2 point-field renderer with no 3D framework. The visible point radius and opacity encode normalized local probability density. The two cyan grids are the material–vacuum interfaces. Input-side, in-gap and output-side samples use distinct stable colors. Dragging changes only the camera angles.

If WebGL2 is unavailable, a Canvas2D projected-point fallback uses the same solver density and interface geometry. The renderer never feeds values back into the physics state.

## 10. Extension boundary

The port topology can remain unchanged while replacing the Hamiltonian:

- electromagnetic fields: minimal coupling `p → p - qA`;
- spin-1/2: Pauli Hamiltonian;
- relativistic single-particle model: Dirac Hamiltonian;
- open system: explicitly nonunitary absorbing boundaries or Lindblad evolution; or
- many-body matter: a declared many-body or field-theory state space.

Those are future model classes, not conclusions of the frozen MST-3D baseline.
