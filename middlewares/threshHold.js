function computeThreshold(level) {
  // relative level inside the tier (1–10)
  const relativeLevel = ((level - 1) % 10) + 1;

  // start of every tier → 2
  if (relativeLevel === 1) return 2;

  // doubling based on relative level
  return Math.pow(2, relativeLevel);
}

exports.computeThreshold = computeThreshold;
