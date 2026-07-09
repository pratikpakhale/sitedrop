import { RESERVED_SUBDOMAINS } from './config'

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export type SubdomainError = 'malformed' | 'reserved'

/** Shape only. Says nothing about whether the label is allowed to be a site. */
export function isWellFormedLabel(sub: string): boolean {
  return LABEL.test(sub)
}

export function validateSubdomain(sub: string): SubdomainError | null {
  if (!isWellFormedLabel(sub)) return 'malformed'
  if (RESERVED_SUBDOMAINS.has(sub)) return 'reserved'
  return null
}

export function isValidSubdomain(sub: string): boolean {
  return validateSubdomain(sub) === null
}
