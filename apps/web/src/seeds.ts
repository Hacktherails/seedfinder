// Seeds growth path: lifetime CO₂ saved (vs flying) turns a seed into a forest. Display only, nothing is stored.

export interface Level {
  name: string
  emoji: string
  fromG: number // lifetime CO₂ saved needed to reach it, in grams
}

export const LEVELS: Level[] = [
  { name: 'Seed', emoji: '🌰', fromG: 0 },
  { name: 'Sprout', emoji: '🌱', fromG: 100_000 },
  { name: 'Sapling', emoji: '🌿', fromG: 500_000 },
  { name: 'Tree', emoji: '🌳', fromG: 1_000_000 },
  { name: 'Forest', emoji: '🌲', fromG: 5_000_000 },
]

/** A mature tree absorbs about 22 kg of CO₂ a year (commonly cited average). */
export const TREE_G_PER_YEAR = 22_000

export function growth(co2SavedG: number) {
  const i = LEVELS.findLastIndex((l) => co2SavedG >= l.fromG)
  const level = LEVELS[Math.max(0, i)]
  const next = LEVELS[i + 1] ?? null
  const progress = next ? (co2SavedG - level.fromG) / (next.fromG - level.fromG) : 1
  return { level, next, progress, toNextG: next ? next.fromG - co2SavedG : 0 }
}
