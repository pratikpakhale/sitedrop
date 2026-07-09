import { ROOT_DOMAIN } from './config'

const IS_LOCAL = ROOT_DOMAIN.startsWith('localhost')

export function siteUrl(subdomain: string): string {
  return `${IS_LOCAL ? 'http' : 'https'}://${subdomain}.${ROOT_DOMAIN}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
