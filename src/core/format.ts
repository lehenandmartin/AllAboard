// Number input and display in the interface language (decimal comma in French).

import { numberLocale, t } from '../i18n'

/** Formats a number for display: "1.25" in English, "1,25" in French. */
export function formatDecimal(value: number, maxDecimals = 2, locale = numberLocale()): string {
  return value.toLocaleString(locale, { maximumFractionDigits: maxDecimals, useGrouping: false })
}

/** Reads "1,25" or "1.25". Returns null if the input is not a number. */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (normalized === '') return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

/** "#RRGGBB" + opacity → "rgba(r, g, b, a)". */
export function hexToRgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** File name: project name + date (YYYY-MM-DD) + extension, without forbidden characters. */
export function datedFileName(projectName: string, extension: string, date = new Date(), fallback = 'Storyboard'): string {
  const name = projectName.replace(/[\\/:*?"<>|]+/g, '-').trim() || fallback
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${name} ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}${extension}`
}

/** Readable file size: "850 KB", "12.4 MB". */
export function formatBytes(bytes: number): string {
  const { units } = t()
  if (bytes < 1000 * 1000) return units.kilobytes(String(Math.max(1, Math.round(bytes / 1000))))
  return units.megabytes(formatDecimal(bytes / 1000 / 1000, 1))
}
