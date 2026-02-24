/**
 * Compute the tilt angle in degrees for the given piece column (0-indexed).
 * Formula: clamp((col - 4.5) / 4.5 * 7, -7, 7)
 * @param {number} col - active piece left-origin column (0–9)
 * @returns {number} angle in degrees, clamped to [-7, 7]
 */
export function computeTiltAngle(col) {
  const angle = (col - 4.5) / 4.5 * 7;
  return Math.max(-7, Math.min(7, angle));
}

/**
 * Advance the spring animation by one step.
 * spring constant: 0.15, damping: 0.75
 * @param {number} current - current angle (degrees)
 * @param {number} velocity - current velocity
 * @param {number} target - target angle (degrees)
 * @returns {{ angle: number, velocity: number }}
 */
export function stepSpring(current, velocity, target) {
  const newVelocity = (velocity + (target - current) * 0.15) * 0.75;
  const newAngle = current + newVelocity;
  return { angle: newAngle, velocity: newVelocity };
}
