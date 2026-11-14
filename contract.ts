export type Sensor = 'MODIS' | 'VIIRS'
export type Layer = 'Combined' | Sensor
export type Bounds = readonly [west: number, south: number, east: number, north: number]
export type Cell = { lat: number; lon: number; MODIS: number; VIIRS: number }
export type Day = { MODIS: number; VIIRS: number; cells: Cell[] }

export type Comparison = { median: number; years: number; above: boolean; prior_below: number }
export type Dataset = {
  months: string[]
  days: Record<string, Day>
  monthly: Record<string, Record<Layer, { total: number; comparison: Comparison | null }>>
  agreement: Record<string, { shared: number; modis_only: number; viirs_only: number; share: number | null }>
  count: number
  skipped: number
  harmonized?: {
    months: string[]
    days: Record<string, { value: number; cells?: Cell[]; detections?: number }>
    monthly: Record<string, { total: number; comparison: Comparison | null }>
    method: { transition: string; fit_years: [number, number]; holdout_months: number; raw_mae: number; adjusted_mae: number }
  } | null
  recent?: {
    fetched_at: string
    dates: string[]
    feeds: Record<Sensor, { first_observed_at: string; last_observed_at: string; url: string }>
  }
}

export const portugal: Bounds = [-9.6, 36.9, -6.1, 42.2]
export const world: Bounds = [-180, -90, 180, 90]
export const layers: Layer[] = ['Combined', 'MODIS', 'VIIRS']
export const maxFileBytes = 50_000_000
