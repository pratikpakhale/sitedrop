const ADJECTIVES = [
  'amber', 'ancient', 'autumn', 'azure', 'bold', 'brave', 'bright', 'calm',
  'candid', 'cerulean', 'clever', 'cobalt', 'cosmic', 'crimson', 'crisp',
  'curious', 'dapper', 'deft', 'dusky', 'eager', 'early', 'electric',
  'elegant', 'fabled', 'fancy', 'feisty', 'floral', 'fluent', 'frosty',
  'gentle', 'gilded', 'glossy', 'golden', 'graceful', 'granite', 'hazel',
  'hidden', 'honest', 'humble', 'indigo', 'ivory', 'jade', 'jolly', 'keen',
  'lively', 'lucid', 'lunar', 'marble', 'mellow', 'merry', 'misty', 'modest',
  'mossy', 'muted', 'nimble', 'noble', 'opal', 'patient', 'placid', 'plucky',
  'polar', 'proud', 'quaint', 'quiet', 'rapid', 'restless', 'rustic', 'sable',
  'scarlet', 'serene', 'silent', 'silken', 'snowy', 'solar', 'spry', 'still',
  'sunny', 'svelte', 'swift', 'tawny', 'tender', 'tidy', 'timid', 'tranquil',
  'twilight', 'urban', 'velvet', 'verdant', 'vivid', 'wandering', 'wild',
  'winter', 'wispy', 'witty', 'zesty',
]

const NOUNS = [
  'acorn', 'arbor', 'arrow', 'aspen', 'atlas', 'badger', 'beacon', 'birch',
  'bloom', 'bluff', 'breeze', 'brook', 'canyon', 'cedar', 'cinder', 'cliff',
  'cloud', 'clover', 'comet', 'coral', 'cove', 'crag', 'creek', 'crest',
  'delta', 'dune', 'echo', 'fern', 'field', 'fjord', 'flame', 'forest', 'fox',
  'garden', 'glade', 'glen', 'grove', 'harbor', 'haven', 'heron', 'hollow',
  'isle', 'ivy', 'lagoon', 'lantern', 'leaf', 'ledge', 'lily', 'lotus',
  'meadow', 'mesa', 'moss', 'oak', 'ocean', 'orchard', 'otter', 'palm', 'peak',
  'pebble', 'petal', 'pine', 'pond', 'prairie', 'quarry', 'quill', 'ravine',
  'reef', 'ridge', 'river', 'shore', 'sky', 'slope', 'spring', 'spruce',
  'star', 'stone', 'stream', 'summit', 'thicket', 'thistle', 'tide', 'trail',
  'tundra', 'valley', 'vine', 'willow', 'wind', 'wood',
]

/** Crockford-style: no 0/1/i/l/o/u, so a name survives being read aloud. */
const TOKEN_ALPHABET = '23456789abcdefghjkmnpqrstvwxyz'
const TOKEN_LENGTH = 4

/** Rejection sampling — `% max` alone would bias the low end of the range. */
function randomBelow(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buffer = new Uint32Array(1)
  let value: number

  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]!
  } while (value >= limit)

  return value % max
}

function pick<T>(items: readonly T[]): T {
  return items[randomBelow(items.length)]!
}

/**
 * Heroku/Haikunator shape: `adjective-noun-token`. The words make it sayable,
 * the token carries the entropy — ~33 bits total, so collisions are rare even
 * before the availability check in /api/name.
 */
export function randomSubdomain(): string {
  const token = Array.from({ length: TOKEN_LENGTH }, () => pick([...TOKEN_ALPHABET])).join('')
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${token}`
}
