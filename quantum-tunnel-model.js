(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuantumTunnel211 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "QT-211-Q4-1.0.0";
  const BIAS_VOLTS = 0.211;
  const ELEMENTARY_CHARGE_C = 1.602176634e-19;
  const ELECTRON_MASS_KG = 9.1093837139e-31;
  const HBAR_J_S = 1.054571817e-34;
  const SILICON_BANDGAP_EV = 1.12;
  const SQRT2 = Math.sqrt(2);

  const ALPHABET = Object.freeze({
    "..": Object.freeze({ i: 1, q: 1, phaseDeg: 45, bits: "00" }),
    "-.": Object.freeze({ i: -1, q: 1, phaseDeg: 135, bits: "10" }),
    "--": Object.freeze({ i: -1, q: -1, phaseDeg: 225, bits: "11" }),
    ".-": Object.freeze({ i: 1, q: -1, phaseDeg: 315, bits: "01" })
  });

  const GRAY_CYCLE = Object.freeze(["..", "-.", "--", ".-"]);
  const TRIP_PHASES = Object.freeze(["LOCATE", "CAPTURE", "TRANSFER", "CHOOSE"]);
  const LEFT_WORD = GRAY_CYCLE;
  const RIGHT_WORD = Object.freeze(reverseInvert(LEFT_WORD));
  const LOCKED_WORD = "[..,-.,--,.-]|[-.,..,.-,--].";
  const REMEMBERED_WORD = "..--|..--.";

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

  function requireSymbol(symbol) {
    if (!Object.prototype.hasOwnProperty.call(ALPHABET, symbol)) {
      throw new RangeError(`unknown I/Q symbol: ${symbol}`);
    }
    return symbol;
  }

  function decodeSymbol(symbol) {
    return ALPHABET[requireSymbol(symbol)];
  }

  function encodeSymbol(i, q) {
    if ((i !== 1 && i !== -1) || (q !== 1 && q !== -1)) {
      throw new RangeError("I and Q must each be +1 or -1");
    }
    return Object.keys(ALPHABET).find((key) => ALPHABET[key].i === i && ALPHABET[key].q === q);
  }

  function hammingDistanceBits(a, b) {
    const aa = decodeSymbol(a).bits;
    const bb = decodeSymbol(b).bits;
    return Number(aa[0] !== bb[0]) + Number(aa[1] !== bb[1]);
  }

  function phaseDistanceDeg(a, b) {
    const delta = Math.abs(decodeSymbol(a).phaseDeg - decodeSymbol(b).phaseDeg) % 360;
    return Math.min(delta, 360 - delta);
  }

  function invertSymbol(symbol) {
    const state = decodeSymbol(symbol);
    return encodeSymbol(-state.i, -state.q);
  }

  function reverseInvert(symbols) {
    if (!Array.isArray(symbols)) throw new TypeError("symbols must be an array");
    return symbols.slice().reverse().map(invertSymbol);
  }

  function complexState(symbol, amplitude) {
    const state = decodeSymbol(symbol);
    const a = positive(amplitude === undefined ? 1 : amplitude, "amplitude", true);
    return Object.freeze({
      re: a * state.i / SQRT2,
      im: a * state.q / SQRT2,
      magnitude: a,
      phaseDeg: state.phaseDeg
    });
  }

  function quadratureVoltage(symbol, amplitude, biasVolts) {
    const z = complexState(symbol, amplitude === undefined ? 1 : amplitude);
    const bias = positive(biasVolts === undefined ? BIAS_VOLTS : biasVolts, "biasVolts", true);
    return Object.freeze({
      iVolts: bias * z.re,
      qVolts: bias * z.im,
      magnitudeVolts: bias * z.magnitude,
      phaseDeg: z.phaseDeg
    });
  }

  function energyPerElectronEv(volts) {
    return Math.abs(finite(volts, "volts"));
  }

  function energyPerElectronJ(volts) {
    return energyPerElectronEv(volts) * ELEMENTARY_CHARGE_C;
  }

  function siliconBandgapRatio(volts) {
    return energyPerElectronEv(volts) / SILICON_BANDGAP_EV;
  }

  function photonCrossesSiliconBandgap(photonEnergyEv) {
    return positive(photonEnergyEv, "photonEnergyEv", true) >= SILICON_BANDGAP_EV;
  }

  function kappaPerMeter(barrierEv, electronEnergyEv, effectiveMassRatio) {
    const barrier = positive(barrierEv, "barrierEv");
    const energy = positive(electronEnergyEv, "electronEnergyEv", true);
    const massRatio = positive(effectiveMassRatio === undefined ? 1 : effectiveMassRatio, "effectiveMassRatio");
    if (energy >= barrier) throw new RangeError("WKB tunnelling requires electronEnergyEv < barrierEv");
    const deltaJ = (barrier - energy) * ELEMENTARY_CHARGE_C;
    return Math.sqrt(2 * ELECTRON_MASS_KG * massRatio * deltaJ) / HBAR_J_S;
  }

  function tunnelTransmission(options) {
    if (!options || typeof options !== "object") throw new TypeError("options are required");
    const widthNm = positive(options.widthNm, "widthNm");
    const kappa = kappaPerMeter(options.barrierEv, options.electronEnergyEv, options.effectiveMassRatio);
    return Math.exp(-2 * kappa * widthNm * 1e-9);
  }

  function lowBiasCurrent(voltage, g1Siemens, g3AmpPerVoltCubed) {
    const v = finite(voltage, "voltage");
    const g1 = positive(g1Siemens, "g1Siemens", true);
    const g3 = finite(g3AmpPerVoltCubed === undefined ? 0 : g3AmpPerVoltCubed, "g3AmpPerVoltCubed");
    return g1 * v + g3 * v * v * v;
  }

  function parseRememberedWord(word) {
    if (word !== REMEMBERED_WORD) throw new RangeError("only the remembered word is defined in v1.0");
    const [left, rawRight] = word.split("|");
    const pilot = rawRight.slice(-1);
    const right = rawRight.slice(0, -1);
    const pairs = (side) => side.match(/.{2}/g) || [];
    const leftSymbols = pairs(left);
    const rightSymbols = pairs(right);
    return Object.freeze({
      left: Object.freeze(leftSymbols),
      right: Object.freeze(rightSymbols),
      pilot,
      uniqueQuadrants: Object.freeze(Array.from(new Set(leftSymbols.concat(rightSymbols))))
    });
  }

  function advanceTrip(phase) {
    const index = TRIP_PHASES.indexOf(phase);
    if (index < 0) throw new RangeError(`unknown trip phase: ${phase}`);
    return TRIP_PHASES[(index + 1) % TRIP_PHASES.length];
  }

  function complex(re, im) {
    return Object.freeze({ re: finite(re, "complex.re"), im: finite(im, "complex.im") });
  }

  function complexMultiply(a, b) {
    return complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  }

  function makeSpinor(alpha, beta) {
    if (!alpha || !beta) throw new TypeError("alpha and beta complex components are required");
    const a = complex(alpha.re, alpha.im);
    const b = complex(beta.re, beta.im);
    const norm = Math.hypot(a.re, a.im, b.re, b.im);
    if (norm === 0) throw new RangeError("spinor norm must be positive");
    return Object.freeze({
      alpha: complex(a.re / norm, a.im / norm),
      beta: complex(b.re / norm, b.im / norm)
    });
  }

  function rotateSpinorZ(spinor, angleRad) {
    if (!spinor || !spinor.alpha || !spinor.beta) throw new TypeError("a spinor is required");
    const theta = finite(angleRad, "angleRad");
    const minus = complex(Math.cos(-theta / 2), Math.sin(-theta / 2));
    const plus = complex(Math.cos(theta / 2), Math.sin(theta / 2));
    return Object.freeze({
      alpha: complexMultiply(spinor.alpha, minus),
      beta: complexMultiply(spinor.beta, plus)
    });
  }

  function spinorDistance(a, b) {
    if (!a || !b) throw new TypeError("two spinors are required");
    return Math.hypot(
      a.alpha.re - b.alpha.re,
      a.alpha.im - b.alpha.im,
      a.beta.re - b.beta.re,
      a.beta.im - b.beta.im
    );
  }

  function modelSnapshot() {
    const remembered = parseRememberedWord(REMEMBERED_WORD);
    return Object.freeze({
      version: VERSION,
      biasVolts: BIAS_VOLTS,
      energyPerElectronEv: energyPerElectronEv(BIAS_VOLTS),
      energyPerElectronJ: energyPerElectronJ(BIAS_VOLTS),
      siliconBandgapEv: SILICON_BANDGAP_EV,
      bandgapRatio: siliconBandgapRatio(BIAS_VOLTS),
      grayCycle: GRAY_CYCLE.slice(),
      rightWord: RIGHT_WORD.slice(),
      lockedWord: LOCKED_WORD,
      rememberedWord: REMEMBERED_WORD,
      rememberedQuadrants: remembered.uniqueQuadrants.length,
      tripPhases: TRIP_PHASES.slice(),
      spinorClassification: "conditional payload type; the four-trip protocol is not itself a spinor",
      classification: "candidate operating bias; not a universal tunnelling threshold"
    });
  }

  return Object.freeze({
    VERSION,
    BIAS_VOLTS,
    ELEMENTARY_CHARGE_C,
    ELECTRON_MASS_KG,
    HBAR_J_S,
    SILICON_BANDGAP_EV,
    ALPHABET,
    GRAY_CYCLE,
    TRIP_PHASES,
    LEFT_WORD,
    RIGHT_WORD,
    LOCKED_WORD,
    REMEMBERED_WORD,
    decodeSymbol,
    encodeSymbol,
    hammingDistanceBits,
    phaseDistanceDeg,
    invertSymbol,
    reverseInvert,
    complexState,
    quadratureVoltage,
    energyPerElectronEv,
    energyPerElectronJ,
    siliconBandgapRatio,
    photonCrossesSiliconBandgap,
    kappaPerMeter,
    tunnelTransmission,
    lowBiasCurrent,
    parseRememberedWord,
    advanceTrip,
    makeSpinor,
    rotateSpinorZ,
    spinorDistance,
    modelSnapshot
  });
});
