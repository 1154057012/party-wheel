(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
  function indexAtPointer(rotation, count) {
    return Math.floor(mod(-rotation + TAU / count / 2, TAU) / (TAU / count)) % count;
  }
  function targetRotation(start, index, count, turns = 6, jitter = 0) {
    const target = -index * TAU / count + jitter * TAU / count;
    return start + turns * TAU + mod(target - start, TAU);
  }
  function easeInOut(t) { return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2; }
  function stoppingRotation(start, speed, count, duration) {
    const step = TAU / count;
    const predicted = start + Math.max(0, speed) * duration / 3;
    return Math.max(Math.round(predicted / step), Math.floor(start / step) + 1) * step;
  }
  const api = {TAU, mod, indexAtPointer, targetRotation, stoppingRotation, easeInOut};
  root.WheelCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
