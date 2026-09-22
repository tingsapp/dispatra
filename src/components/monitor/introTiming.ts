export const INTRO_TIMING = {
  orbit: 1000,
  approach: 500,
  descent: 8000,
  settle: 350,
  reveal: 700,
  timeout: 13000,
} as const;

// Progressively reduce camera speed, reaching zero velocity at the city view.
export const descentEasing = (progress: number) => Math.sin(progress * Math.PI / 2);
