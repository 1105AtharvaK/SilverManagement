import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateFine(weight: number, purity: number): number {
  return (weight * purity) / 100
}

export function formatDecimal(num: number | string | null | undefined, decimals = 2): string {
  if (num === null || num === undefined) return '0.00'
  const parsed = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(parsed)) return '0.00'
  return parsed.toFixed(decimals)
}
