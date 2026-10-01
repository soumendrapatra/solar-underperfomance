/**
 * Global UI and animation constants.
 * Single source of truth for motion timing and palette curves.
 */

export const EASING = [0.22, 1, 0.36, 1]

export const DURATION = {
  fast: 0.15,
  normal: 0.28,
  slow: 0.45,
}

export const SPRING_CONFIG = {
  type: 'spring',
  stiffness: 450,
  damping: 32,
}
