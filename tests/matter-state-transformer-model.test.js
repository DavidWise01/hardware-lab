"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const M = require("../matter-state-transformer-model.js");

const contractPath = path.join(__dirname, "..", "benchmarks", "mst-3d-contract-v1.0.json");
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

function distance(aRe, aIm, bRe, bIm) {
  let total = 0;
  for (let i = 0; i < aRe.length; i += 1) {
    total += (aRe[i] - bRe[i]) ** 2 + (aIm[i] - bIm[i]) ** 2;
  }
  return Math.sqrt(total);
}

test("M01: frozen identity and vacuum-gap glyph", () => {
  assert.equal(M.VERSION, "MST-3D-1.0.0");
  assert.equal(M.GLYPH, ".|-|..");
  assert.match(M.evidenceBoundary().glyphMeaning, /vacuum gap/);
});

test("M02: baseline is a power-of-two 3D grid", () => {
  const c = M.mergeOptions();
  assert.deepEqual([c.nx, c.ny, c.nz], [32, 16, 16]);
});

test("M03: initial state is normalized", () => {
  const c = M.mergeOptions();
  const psi = M.buildInitialState(c);
  assert.ok(Math.abs(M.probabilityNorm(psi.re, psi.im) - 1) < 1e-12);
});

test("M04: regional probabilities close exactly to the norm", () => {
  const s = M.createSimulation();
  const w = s.witness();
  assert.ok(Math.abs(w.left + w.middle + w.right - w.norm) < 1e-15);
  assert.ok(w.left > 0.999);
});

test("M05: one-dimensional FFT round trip", () => {
  const re = Float64Array.from({ length: 16 }, (_, i) => Math.sin(i * 0.37));
  const im = Float64Array.from({ length: 16 }, (_, i) => Math.cos(i * 0.19));
  const sourceRe = re.slice();
  const sourceIm = im.slice();
  M.fft1d(re, im, false);
  M.fft1d(re, im, true);
  assert.ok(distance(re, im, sourceRe, sourceIm) < 1e-12);
});

test("M06: separable three-dimensional FFT round trip", () => {
  const shape = { nx: 8, ny: 4, nz: 4 };
  const size = shape.nx * shape.ny * shape.nz;
  const re = Float64Array.from({ length: size }, (_, i) => Math.sin(i * 0.11));
  const im = Float64Array.from({ length: size }, (_, i) => Math.cos(i * 0.07));
  const sourceRe = re.slice();
  const sourceIm = im.slice();
  M.fft3d(re, im, shape, false);
  M.fft3d(re, im, shape, true);
  assert.ok(distance(re, im, sourceRe, sourceIm) < 1e-11);
});

test("M07: potential marks the bounded vacuum gap", () => {
  const c = M.mergeOptions({ nx: 8, ny: 4, nz: 4, dx: 1, dy: 1, dz: 1, barrierHeight: 7, barrierHalfWidth: 0.6, guideStrength: 0 });
  const v = M.buildPotential(c);
  const center = v[M.index3(4, 2, 2, c.ny, c.nz)];
  const material = v[M.index3(1, 2, 2, c.ny, c.nz)];
  assert.equal(center, 7);
  assert.equal(material, 0);
});

test("M08: one-nanometre electron scale is reproducible", () => {
  const scale = M.physicalScale(1, 1);
  assert.ok(Math.abs(scale.energyEv - 0.03809982106299685) < 1e-16);
  assert.ok(Math.abs(scale.timeFs - 17.275985508154353) < 1e-12);
});

test("M09: WKB vacuum-gap estimate is bounded", () => {
  const t = M.wkbTransmissionDimensionless(5.12, 5.8, 1.8);
  assert.ok(t > 0 && t < 1);
});

test("M10: WKB transfer decreases with vacuum-gap width", () => {
  const widths = [0.5, 1, 1.5, 2].map((width) => M.wkbTransmissionDimensionless(5.12, 5.8, width));
  for (let i = 1; i < widths.length; i += 1) assert.ok(widths[i] < widths[i - 1]);
});

test("M11: WKB transfer decreases with barrier height", () => {
  const heights = [5.3, 5.8, 6.5, 8].map((height) => M.wkbTransmissionDimensionless(5.12, height, 1.8));
  for (let i = 1; i < heights.length; i += 1) assert.ok(heights[i] < heights[i - 1]);
});

test("M12: one split-operator step conserves norm", () => {
  const s = M.createSimulation();
  const before = s.snapshot().norm;
  const after = s.advance().norm;
  assert.ok(Math.abs(after - before) < 1e-12);
});

test("M13: two hundred split-operator steps conserve norm", () => {
  const s = M.createSimulation();
  s.advance(200);
  assert.ok(Math.abs(s.snapshot().norm - 1) < 2e-11);
});

test("M14: forward then reverse evolution recovers the state", () => {
  const s = M.createSimulation({ nx: 16, ny: 8, nz: 8, packetX: -3 });
  const sourceRe = s.re.slice();
  const sourceIm = s.im.slice();
  s.advance(40, 1);
  s.advance(40, -1);
  assert.ok(distance(s.re, s.im, sourceRe, sourceIm) < 2e-11);
});

test("M15: free matter packet propagates toward the output port", () => {
  const s = M.createSimulation({ barrierHeight: 0, guideStrength: 0 });
  const before = s.snapshot().centroidX;
  s.advance(100);
  assert.ok(s.snapshot().centroidX > before + 4);
});

test("M16: vacuum barrier suppresses transfer relative to free propagation", () => {
  const free = M.createSimulation({ barrierHeight: 0, guideStrength: 0 });
  const vacuum = M.createSimulation({ barrierHeight: 5.8, guideStrength: 0 });
  free.advance(150);
  vacuum.advance(150);
  assert.ok(free.snapshot().right > 0.5);
  assert.ok(vacuum.snapshot().right < free.snapshot().right / 5);
});

test("M17: numerical witness is read-only", () => {
  const s = M.createSimulation();
  const beforeRe = s.re.slice();
  const beforeIm = s.im.slice();
  const a = s.witness();
  const b = s.witness();
  assert.deepEqual(a, b);
  assert.equal(distance(s.re, s.im, beforeRe, beforeIm), 0);
});

test("M18: reset restores the exact initial arrays", () => {
  const s = M.createSimulation({ nx: 16, ny: 8, nz: 8, packetX: -3 });
  const sourceRe = s.re.slice();
  const sourceIm = s.im.slice();
  s.advance(25);
  s.reset();
  assert.equal(distance(s.re, s.im, sourceRe, sourceIm), 0);
  assert.equal(s.snapshot().steps, 0);
});

test("M19: invalid grids and step directions fail closed", () => {
  assert.throws(() => M.createSimulation({ nx: 18 }), /power of two/);
  const s = M.createSimulation({ nx: 16, ny: 8, nz: 8, packetX: -3 });
  assert.throws(() => s.advance(-1), /non-negative integer/);
  assert.throws(() => s.advance(1, 0), /direction/);
});

test("M20: two independent simulations remain deterministic", () => {
  const a = M.createSimulation({ nx: 16, ny: 8, nz: 8, packetX: -3 });
  const b = M.createSimulation({ nx: 16, ny: 8, nz: 8, packetX: -3 });
  a.advance(120);
  b.advance(120);
  assert.equal(distance(a.re, a.im, b.re, b.im), 0);
});

test("M21: frozen deterministic checksum", () => {
  const s = M.createSimulation({ nx: 16, ny: 8, nz: 8, packetX: -3 });
  s.advance(120);
  const density = s.density();
  let checksum = 0;
  for (let i = 0; i < density.length; i += 1) checksum += density[i] * ((i % 97) + 1);
  assert.ok(Math.abs(checksum - 46.251995456959357) < 1e-12);
});

test("M22: one thousand-step stress remains finite and normalized", () => {
  const s = M.createSimulation({ nx: 16, ny: 8, nz: 8, packetX: -3 });
  const started = process.hrtime.bigint();
  s.advance(1000);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  const w = s.snapshot();
  assert.ok(Object.values(w).filter((value) => typeof value === "number").every(Number.isFinite));
  assert.ok(Math.abs(w.norm - 1) < 5e-11);
  console.log(`MST_BENCHMARK grid=16x8x8 steps=1000 elapsed_ms=${elapsedMs.toFixed(3)} norm=${w.norm.toFixed(15)}`);
});

test("M23: frozen normative contract seal verifies", () => {
  assert.equal(contract.status, "FROZEN");
  assert.equal(sha256(canonical(contract.normative)), contract.freeze_seal.digest);
});
