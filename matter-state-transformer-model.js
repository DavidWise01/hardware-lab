(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MatterStateTransformer3D = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "MST-3D-1.0.0";
  const GLYPH = ".|-|..";
  const HBAR_J_S = 1.054571817e-34;
  const ELECTRON_MASS_KG = 9.1093837139e-31;
  const ELEMENTARY_CHARGE_C = 1.602176634e-19;
  const DEFAULTS = Object.freeze({
    nx: 32,
    ny: 16,
    nz: 16,
    dx: 0.75,
    dy: 0.75,
    dz: 0.75,
    dt: 0.018,
    packetX: -7.0,
    sigmaX: 1.15,
    sigmaY: 1.0,
    sigmaZ: 1.0,
    waveNumber: 3.2,
    barrierHeight: 5.8,
    barrierHalfWidth: 0.9,
    guideStrength: 0.05
  });

  function finite(value, name) {
    if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
    return value;
  }

  function positive(value, name, allowZero) {
    finite(value, name);
    if (allowZero ? value < 0 : value <= 0) {
      throw new RangeError(`${name} must be ${allowZero ? "non-negative" : "positive"}`);
    }
    return value;
  }

  function powerOfTwo(value, name) {
    if (!Number.isInteger(value) || value < 2 || (value & (value - 1)) !== 0) {
      throw new RangeError(`${name} must be a power of two greater than one`);
    }
    return value;
  }

  function mergeOptions(options) {
    const value = Object.assign({}, DEFAULTS, options || {});
    powerOfTwo(value.nx, "nx");
    powerOfTwo(value.ny, "ny");
    powerOfTwo(value.nz, "nz");
    positive(value.dx, "dx");
    positive(value.dy, "dy");
    positive(value.dz, "dz");
    positive(value.dt, "dt");
    finite(value.packetX, "packetX");
    positive(value.sigmaX, "sigmaX");
    positive(value.sigmaY, "sigmaY");
    positive(value.sigmaZ, "sigmaZ");
    positive(value.waveNumber, "waveNumber", true);
    positive(value.barrierHeight, "barrierHeight", true);
    positive(value.barrierHalfWidth, "barrierHalfWidth");
    positive(value.guideStrength, "guideStrength", true);
    return Object.freeze(value);
  }

  function index3(x, y, z, ny, nz) {
    return (x * ny + y) * nz + z;
  }

  function coordinate(index, count, spacing) {
    return (index - count / 2) * spacing;
  }

  function waveNumberAt(index, count, spacing) {
    const mode = index <= count / 2 ? index : index - count;
    return 2 * Math.PI * mode / (count * spacing);
  }

  function fft1d(re, im, inverse) {
    if (!(re instanceof Float64Array) || !(im instanceof Float64Array) || re.length !== im.length) {
      throw new TypeError("fft1d requires equally sized Float64Array components");
    }
    const n = powerOfTwo(re.length, "fft length");
    for (let i = 1, j = 0; i < n; i += 1) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        const tr = re[i]; re[i] = re[j]; re[j] = tr;
        const ti = im[i]; im[i] = im[j]; im[j] = ti;
      }
    }
    for (let length = 2; length <= n; length <<= 1) {
      const angle = (inverse ? 2 : -2) * Math.PI / length;
      const wr0 = Math.cos(angle);
      const wi0 = Math.sin(angle);
      const half = length >> 1;
      for (let start = 0; start < n; start += length) {
        let wr = 1;
        let wi = 0;
        for (let offset = 0; offset < half; offset += 1) {
          const even = start + offset;
          const odd = even + half;
          const or = re[odd] * wr - im[odd] * wi;
          const oi = re[odd] * wi + im[odd] * wr;
          const er = re[even];
          const ei = im[even];
          re[even] = er + or;
          im[even] = ei + oi;
          re[odd] = er - or;
          im[odd] = ei - oi;
          const nextWr = wr * wr0 - wi * wi0;
          wi = wr * wi0 + wi * wr0;
          wr = nextWr;
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < n; i += 1) {
        re[i] /= n;
        im[i] /= n;
      }
    }
    return { re, im };
  }

  function fft3d(re, im, shape, inverse) {
    const nx = powerOfTwo(shape.nx, "nx");
    const ny = powerOfTwo(shape.ny, "ny");
    const nz = powerOfTwo(shape.nz, "nz");
    if (re.length !== nx * ny * nz || im.length !== re.length) {
      throw new RangeError("wavefunction length does not match the 3D grid");
    }
    const maxLength = Math.max(nx, ny, nz);
    const lineRe = new Float64Array(maxLength);
    const lineIm = new Float64Array(maxLength);
    for (let x = 0; x < nx; x += 1) {
      for (let y = 0; y < ny; y += 1) {
        for (let z = 0; z < nz; z += 1) {
          const p = index3(x, y, z, ny, nz);
          lineRe[z] = re[p]; lineIm[z] = im[p];
        }
        fft1d(lineRe.subarray(0, nz), lineIm.subarray(0, nz), inverse);
        for (let z = 0; z < nz; z += 1) {
          const p = index3(x, y, z, ny, nz);
          re[p] = lineRe[z]; im[p] = lineIm[z];
        }
      }
    }
    for (let x = 0; x < nx; x += 1) {
      for (let z = 0; z < nz; z += 1) {
        for (let y = 0; y < ny; y += 1) {
          const p = index3(x, y, z, ny, nz);
          lineRe[y] = re[p]; lineIm[y] = im[p];
        }
        fft1d(lineRe.subarray(0, ny), lineIm.subarray(0, ny), inverse);
        for (let y = 0; y < ny; y += 1) {
          const p = index3(x, y, z, ny, nz);
          re[p] = lineRe[y]; im[p] = lineIm[y];
        }
      }
    }
    for (let y = 0; y < ny; y += 1) {
      for (let z = 0; z < nz; z += 1) {
        for (let x = 0; x < nx; x += 1) {
          const p = index3(x, y, z, ny, nz);
          lineRe[x] = re[p]; lineIm[x] = im[p];
        }
        fft1d(lineRe.subarray(0, nx), lineIm.subarray(0, nx), inverse);
        for (let x = 0; x < nx; x += 1) {
          const p = index3(x, y, z, ny, nz);
          re[p] = lineRe[x]; im[p] = lineIm[x];
        }
      }
    }
    return { re, im };
  }

  function buildPotential(config) {
    const size = config.nx * config.ny * config.nz;
    const potential = new Float64Array(size);
    for (let xIndex = 0; xIndex < config.nx; xIndex += 1) {
      const x = coordinate(xIndex, config.nx, config.dx);
      const slab = Math.abs(x) <= config.barrierHalfWidth ? config.barrierHeight : 0;
      for (let yIndex = 0; yIndex < config.ny; yIndex += 1) {
        const y = coordinate(yIndex, config.ny, config.dy);
        for (let zIndex = 0; zIndex < config.nz; zIndex += 1) {
          const z = coordinate(zIndex, config.nz, config.dz);
          const guide = 0.5 * config.guideStrength * (y * y + z * z);
          potential[index3(xIndex, yIndex, zIndex, config.ny, config.nz)] = slab + guide;
        }
      }
    }
    return potential;
  }

  function buildInitialState(config) {
    const size = config.nx * config.ny * config.nz;
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    let norm2 = 0;
    for (let xIndex = 0; xIndex < config.nx; xIndex += 1) {
      const x = coordinate(xIndex, config.nx, config.dx);
      for (let yIndex = 0; yIndex < config.ny; yIndex += 1) {
        const y = coordinate(yIndex, config.ny, config.dy);
        for (let zIndex = 0; zIndex < config.nz; zIndex += 1) {
          const z = coordinate(zIndex, config.nz, config.dz);
          const envelope = Math.exp(
            -((x - config.packetX) ** 2) / (4 * config.sigmaX ** 2)
            -(y * y) / (4 * config.sigmaY ** 2)
            -(z * z) / (4 * config.sigmaZ ** 2)
          );
          const phase = config.waveNumber * x;
          const p = index3(xIndex, yIndex, zIndex, config.ny, config.nz);
          re[p] = envelope * Math.cos(phase);
          im[p] = envelope * Math.sin(phase);
          norm2 += envelope * envelope;
        }
      }
    }
    const scale = 1 / Math.sqrt(norm2);
    for (let i = 0; i < size; i += 1) {
      re[i] *= scale;
      im[i] *= scale;
    }
    return { re, im };
  }

  function probabilityNorm(re, im) {
    if (re.length !== im.length) throw new RangeError("complex arrays must have equal length");
    let total = 0;
    for (let i = 0; i < re.length; i += 1) total += re[i] * re[i] + im[i] * im[i];
    return total;
  }

  function createSimulation(options) {
    const config = mergeOptions(options);
    const shape = Object.freeze({ nx: config.nx, ny: config.ny, nz: config.nz });
    const potential = buildPotential(config);
    const initial = buildInitialState(config);
    const re = initial.re.slice();
    const im = initial.im.slice();
    const kEnergy = new Float64Array(re.length);
    for (let x = 0; x < config.nx; x += 1) {
      const kx = waveNumberAt(x, config.nx, config.dx);
      for (let y = 0; y < config.ny; y += 1) {
        const ky = waveNumberAt(y, config.ny, config.dy);
        for (let z = 0; z < config.nz; z += 1) {
          const kz = waveNumberAt(z, config.nz, config.dz);
          kEnergy[index3(x, y, z, config.ny, config.nz)] = 0.5 * (kx * kx + ky * ky + kz * kz);
        }
      }
    }
    let time = 0;
    let steps = 0;

    function phaseMultiply(values, halfDt) {
      for (let i = 0; i < re.length; i += 1) {
        const angle = -values[i] * halfDt;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const rr = re[i];
        const ii = im[i];
        re[i] = rr * c - ii * s;
        im[i] = rr * s + ii * c;
      }
    }

    function advance(count, direction) {
      const iterations = count === undefined ? 1 : count;
      if (!Number.isInteger(iterations) || iterations < 0) throw new RangeError("step count must be a non-negative integer");
      const sign = direction === undefined ? 1 : finite(direction, "direction");
      if (sign !== 1 && sign !== -1) throw new RangeError("direction must be +1 or -1");
      const signedDt = config.dt * sign;
      for (let step = 0; step < iterations; step += 1) {
        phaseMultiply(potential, signedDt / 2);
        fft3d(re, im, shape, false);
        phaseMultiply(kEnergy, signedDt);
        fft3d(re, im, shape, true);
        phaseMultiply(potential, signedDt / 2);
        time += signedDt;
        steps += sign;
      }
      return snapshot();
    }

    function reset() {
      re.set(initial.re);
      im.set(initial.im);
      time = 0;
      steps = 0;
      return snapshot();
    }

    function density() {
      const out = new Float64Array(re.length);
      for (let i = 0; i < re.length; i += 1) out[i] = re[i] * re[i] + im[i] * im[i];
      return out;
    }

    function regionalProbabilities() {
      let left = 0;
      let middle = 0;
      let right = 0;
      let centroidX = 0;
      for (let xIndex = 0; xIndex < config.nx; xIndex += 1) {
        const x = coordinate(xIndex, config.nx, config.dx);
        for (let yIndex = 0; yIndex < config.ny; yIndex += 1) {
          for (let zIndex = 0; zIndex < config.nz; zIndex += 1) {
            const p = index3(xIndex, yIndex, zIndex, config.ny, config.nz);
            const probability = re[p] * re[p] + im[p] * im[p];
            centroidX += probability * x;
            if (x < -config.barrierHalfWidth) left += probability;
            else if (x > config.barrierHalfWidth) right += probability;
            else middle += probability;
          }
        }
      }
      const norm = left + middle + right;
      return Object.freeze({ left, middle, right, norm, centroidX: centroidX / norm });
    }

    function snapshot() {
      const regions = regionalProbabilities();
      return Object.freeze({
        version: VERSION,
        glyph: GLYPH,
        time,
        steps,
        norm: regions.norm,
        left: regions.left,
        middle: regions.middle,
        right: regions.right,
        centroidX: regions.centroidX
      });
    }

    function witness() {
      return snapshot();
    }

    return Object.freeze({
      config,
      shape,
      potential,
      re,
      im,
      advance,
      reset,
      density,
      regionalProbabilities,
      snapshot,
      witness
    });
  }

  function wkbTransmissionDimensionless(energy, barrierHeight, width) {
    const e = positive(energy, "energy", true);
    const v = positive(barrierHeight, "barrierHeight", true);
    const d = positive(width, "width");
    if (e >= v) throw new RangeError("WKB sub-barrier estimate requires energy < barrierHeight");
    return Math.exp(-2 * Math.sqrt(2 * (v - e)) * d);
  }

  function physicalScale(lengthNm, effectiveMassRatio) {
    const lengthM = positive(lengthNm, "lengthNm") * 1e-9;
    const mass = ELECTRON_MASS_KG * positive(effectiveMassRatio === undefined ? 1 : effectiveMassRatio, "effectiveMassRatio");
    const energyJ = HBAR_J_S * HBAR_J_S / (2 * mass * lengthM * lengthM);
    return Object.freeze({
      lengthNm,
      effectiveMassRatio: mass / ELECTRON_MASS_KG,
      energyEv: energyJ / ELEMENTARY_CHARGE_C,
      timeFs: HBAR_J_S / energyJ * 1e15
    });
  }

  function evidenceBoundary() {
    return Object.freeze({
      established: "single-particle time-dependent Schrodinger equation; unitary split-operator Fourier propagation; Born probability density",
      modelChoice: "closed periodic 3D computational volume with a material-vacuum-material potential barrier and weak transverse guide",
      glyphMeaning: ". input | material-vacuum interface - bounded vacuum gap | vacuum-material interface . output . read-only numerical witness",
      excluded: "matter creation, particle transmutation, field-theory interactions, measurement back-action, fabricated device performance"
    });
  }

  return Object.freeze({
    VERSION,
    GLYPH,
    HBAR_J_S,
    ELECTRON_MASS_KG,
    ELEMENTARY_CHARGE_C,
    DEFAULTS,
    mergeOptions,
    index3,
    coordinate,
    waveNumberAt,
    fft1d,
    fft3d,
    buildPotential,
    buildInitialState,
    probabilityNorm,
    createSimulation,
    wkbTransmissionDimensionless,
    physicalScale,
    evidenceBoundary
  });
});
