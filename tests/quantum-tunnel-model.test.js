"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const M = require("../quantum-tunnel-model.js");

const contractPath = path.join(__dirname, "..", "benchmarks", "qt-211-q4-contract-v1.0.json");
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

test("T01: frozen identity and voltage", () => {
  assert.equal(M.VERSION, "QT-211-Q4-1.0.0");
  assert.equal(M.BIAS_VOLTS, 0.211);
});

test("T02: one electron crossing 211 mV carries 0.211 eV", () => {
  assert.equal(M.energyPerElectronEv(M.BIAS_VOLTS), 0.211);
  assert.ok(Math.abs(M.energyPerElectronJ(M.BIAS_VOLTS) - 3.38059269774e-20) < 1e-33);
});

test("T03: frozen bias is below the silicon indirect bandgap reference", () => {
  assert.equal(M.photonCrossesSiliconBandgap(M.BIAS_VOLTS), false);
  assert.ok(Math.abs(M.siliconBandgapRatio(M.BIAS_VOLTS) - 0.18839285714285714) < 1e-15);
});

test("T04: I/Q alphabet is a complete four-state bijection", () => {
  const pairs = new Set();
  for (const symbol of M.GRAY_CYCLE) {
    const state = M.decodeSymbol(symbol);
    pairs.add(`${state.i},${state.q}`);
    assert.equal(M.encodeSymbol(state.i, state.q), symbol);
  }
  assert.deepEqual(Array.from(pairs).sort(), ["-1,-1", "-1,1", "1,-1", "1,1"]);
});

test("T05: phases occupy four quadrants at 90 degree spacing", () => {
  assert.deepEqual(M.GRAY_CYCLE.map((symbol) => M.decodeSymbol(symbol).phaseDeg), [45, 135, 225, 315]);
  for (let i = 0; i < M.GRAY_CYCLE.length; i += 1) {
    assert.equal(M.phaseDistanceDeg(M.GRAY_CYCLE[i], M.GRAY_CYCLE[(i + 1) % 4]), 90);
  }
});

test("T06: closed Gray cycle changes one bit per step", () => {
  for (let i = 0; i < M.GRAY_CYCLE.length; i += 1) {
    assert.equal(M.hammingDistanceBits(M.GRAY_CYCLE[i], M.GRAY_CYCLE[(i + 1) % 4]), 1);
  }
});

test("T07: inversion is involutive and exactly opposite in phase", () => {
  for (const symbol of M.GRAY_CYCLE) {
    const inverse = M.invertSymbol(symbol);
    assert.equal(M.invertSymbol(inverse), symbol);
    assert.equal(M.phaseDistanceDeg(symbol, inverse), 180);
  }
});

test("T08: reverse then invert yields the frozen right word", () => {
  assert.deepEqual(M.RIGHT_WORD, ["-.", "..", ".-", "--"]);
  assert.deepEqual(M.reverseInvert(M.RIGHT_WORD), M.LEFT_WORD);
  assert.equal(M.LOCKED_WORD, contract.normative.locked_word);
});

test("T09: quadrature voltage preserves requested magnitude", () => {
  for (const symbol of M.GRAY_CYCLE) {
    const v = M.quadratureVoltage(symbol, 1, M.BIAS_VOLTS);
    assert.ok(Math.abs(Math.hypot(v.iVolts, v.qVolts) - M.BIAS_VOLTS) < 1e-15);
  }
});

test("T10: amplitude scaling is linear before the tunnel transfer", () => {
  const a = M.quadratureVoltage("..", 0.25, M.BIAS_VOLTS);
  const b = M.quadratureVoltage("..", 1.00, M.BIAS_VOLTS);
  assert.ok(Math.abs(b.iVolts / a.iVolts - 4) < 1e-15);
  assert.ok(Math.abs(b.qVolts / a.qVolts - 4) < 1e-15);
});

test("T11: low-bias polynomial is odd under inversion", () => {
  const args = [2.4e-6, 0.7e-6];
  const positive = M.lowBiasCurrent(M.BIAS_VOLTS, ...args);
  const negative = M.lowBiasCurrent(-M.BIAS_VOLTS, ...args);
  assert.ok(Math.abs(positive + negative) < 1e-24);
});

test("T12: low-bias linear term dominates the selected bench coefficients", () => {
  const v = M.BIAS_VOLTS;
  const linear = 2.4e-6 * v;
  const cubic = 0.7e-6 * v ** 3;
  assert.ok(Math.abs(cubic / linear) < 0.02);
});

test("T13: WKB transmission is bounded", () => {
  const t = M.tunnelTransmission({ barrierEv: 3.2, electronEnergyEv: 0.211, widthNm: 1.1, effectiveMassRatio: 0.5 });
  assert.ok(t > 0 && t < 1);
});

test("T14: WKB transmission decreases with barrier width", () => {
  const options = { barrierEv: 3.2, electronEnergyEv: 0.211, effectiveMassRatio: 0.5 };
  const values = [0.5, 0.8, 1.1, 1.4, 1.7].map((widthNm) => M.tunnelTransmission({ ...options, widthNm }));
  for (let i = 1; i < values.length; i += 1) assert.ok(values[i] < values[i - 1]);
});

test("T15: WKB transmission decreases with barrier height", () => {
  const options = { electronEnergyEv: 0.211, widthNm: 1.1, effectiveMassRatio: 0.5 };
  const values = [1.0, 2.0, 3.0, 4.0, 5.0].map((barrierEv) => M.tunnelTransmission({ ...options, barrierEv }));
  for (let i = 1; i < values.length; i += 1) assert.ok(values[i] < values[i - 1]);
});

test("T16: remembered word honestly reports two opposing quadrants", () => {
  const parsed = M.parseRememberedWord(M.REMEMBERED_WORD);
  assert.deepEqual(parsed.left, ["..", "--"]);
  assert.deepEqual(parsed.right, ["..", "--"]);
  assert.equal(parsed.pilot, ".");
  assert.deepEqual(parsed.uniqueQuadrants, ["..", "--"]);
});

test("T17: full locked word covers all four quadrants", () => {
  assert.equal(new Set(M.LEFT_WORD.concat(M.RIGHT_WORD)).size, 4);
});

test("T18: malformed I/Q states fail closed", () => {
  assert.throws(() => M.decodeSymbol("||"), /unknown I\/Q symbol/);
  assert.throws(() => M.encodeSymbol(0, 1), /must each be/);
  assert.throws(() => M.complexState("..", -1), /non-negative/);
});

test("T19: invalid WKB domains fail closed", () => {
  assert.throws(() => M.tunnelTransmission({ barrierEv: 0.2, electronEnergyEv: 0.211, widthNm: 1 }), /requires/);
  assert.throws(() => M.tunnelTransmission({ barrierEv: 3.2, electronEnergyEv: 0.211, widthNm: 0 }), /positive/);
});

test("T20: snapshot is deterministic and preserves the evidence boundary", () => {
  const a = M.modelSnapshot();
  const b = M.modelSnapshot();
  assert.deepEqual(a, b);
  assert.match(a.classification, /not a universal tunnelling threshold/);
  assert.equal(a.rememberedQuadrants, 2);
});

test("T21: frozen normative contract seal verifies", () => {
  assert.equal(contract.status, "FROZEN");
  assert.equal(sha256(canonical(contract.normative)), contract.freeze_seal.digest);
});

test("T22: one million deterministic evaluations remain finite", () => {
  const iterations = 1_000_000;
  const started = process.hrtime.bigint();
  let checksum = 0;
  for (let i = 0; i < iterations; i += 1) {
    const symbol = M.GRAY_CYCLE[i & 3];
    const v = M.quadratureVoltage(symbol, 0.5 + (i % 101) / 200, M.BIAS_VOLTS);
    const current = M.lowBiasCurrent(v.iVolts, 2.4e-6, 0.7e-6);
    const widthNm = 0.6 + (i % 17) * 0.05;
    const transmission = M.tunnelTransmission({
      barrierEv: 3.2,
      electronEnergyEv: Math.abs(v.iVolts),
      widthNm,
      effectiveMassRatio: 0.5
    });
    checksum += current * 1e9 + transmission;
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(Number.isFinite(checksum));
  assert.ok(elapsedMs > 0);
  console.log(`BENCHMARK iterations=${iterations} elapsed_ms=${elapsedMs.toFixed(3)} eval_per_sec=${Math.round(iterations / (elapsedMs / 1000))} checksum=${checksum.toFixed(12)}`);
});

test("T23: four-trip protocol advances and closes deterministically", () => {
  let phase = "LOCATE";
  const visited = [];
  for (let i = 0; i < 4; i += 1) {
    visited.push(phase);
    phase = M.advanceTrip(phase);
  }
  assert.deepEqual(visited, ["LOCATE", "CAPTURE", "TRANSFER", "CHOOSE"]);
  assert.equal(phase, "LOCATE");
});

test("T24: unknown transport phase fails closed", () => {
  assert.throws(() => M.advanceTrip("DROP"), /unknown trip phase/);
});

test("T25: spinor constructor normalizes two complex components", () => {
  const psi = M.makeSpinor({ re: 3, im: 0 }, { re: 0, im: 4 });
  const norm = Math.hypot(psi.alpha.re, psi.alpha.im, psi.beta.re, psi.beta.im);
  assert.ok(Math.abs(norm - 1) < 1e-15);
});

test("T26: a 2*pi spinor rotation changes psi to -psi", () => {
  const psi = M.makeSpinor({ re: 1, im: 0 }, { re: 1, im: 0 });
  const r2pi = M.rotateSpinorZ(psi, 2 * Math.PI);
  const minusPsi = {
    alpha: { re: -psi.alpha.re, im: -psi.alpha.im },
    beta: { re: -psi.beta.re, im: -psi.beta.im }
  };
  assert.ok(M.spinorDistance(r2pi, minusPsi) < 1e-15);
  assert.ok(M.spinorDistance(r2pi, psi) > 1);
});

test("T27: a 4*pi spinor rotation returns psi", () => {
  const psi = M.makeSpinor({ re: 1, im: 0 }, { re: 0, im: 1 });
  const r4pi = M.rotateSpinorZ(psi, 4 * Math.PI);
  assert.ok(M.spinorDistance(r4pi, psi) < 1e-15);
});
