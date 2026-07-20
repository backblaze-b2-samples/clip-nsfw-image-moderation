// The finite set of safety thresholds surfaced as a selector in the batch
// forms. An image is quarantined when its NSFW score (0..1, 1 = NSFW) is
// >= threshold, so a LOWER threshold quarantines more aggressively.
export type ThresholdPreset = "strict" | "balanced" | "lenient";

export const THRESHOLD_PRESETS: {
  value: ThresholdPreset;
  score: number;
  label: string;
  hint: string;
}[] = [
  { value: "strict", score: 0.5, label: "Strict (0.50)", hint: "Quarantines aggressively — flags anything mildly suggestive." },
  { value: "balanced", score: 0.7, label: "Balanced (0.70)", hint: "Recommended default — good precision/recall for a sound test run." },
  { value: "lenient", score: 0.9, label: "Lenient (0.90)", hint: "Only quarantines clearly explicit images." },
];

export const DEFAULT_PRESET: ThresholdPreset = "balanced";

export function scoreToPreset(score: number): ThresholdPreset {
  // Snap an arbitrary stored threshold to the nearest preset for the selector.
  let best = THRESHOLD_PRESETS[0];
  for (const p of THRESHOLD_PRESETS) {
    if (Math.abs(p.score - score) < Math.abs(best.score - score)) best = p;
  }
  return best.value;
}

export function presetToScore(preset: ThresholdPreset): number {
  return THRESHOLD_PRESETS.find((p) => p.value === preset)?.score ?? 0.7;
}
