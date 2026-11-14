import { portugal, type Bounds, type Day, type Layer } from './contract'

export const archive = 'https://firms.modaps.eosdis.nasa.gov/country/'
export const firms = 'https://www.earthdata.nasa.gov/data/tools/firms#links'
export const firmsAttributes = 'https://firms.modaps.eosdis.nasa.gov/data/country/AttributesReadme.txt'
export const challenge = 'https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/'
export const portugalMap: Bounds = [-16, 36.35, 0, 43.15]
export const regions: { name: string; bounds: Bounds }[] = [
  { name: 'Mainland Portugal', bounds: portugal },
  { name: 'Northern Portugal', bounds: [-9.6, 40.9, -6.1, 42.2] },
  { name: 'Central Portugal', bounds: [-9.6, 39.1, -6.1, 40.9] },
  { name: 'Southern Portugal', bounds: [-9.6, 36.9, -6.1, 39.1] },
]

export const emptyDay: Day = { MODIS: 0, VIIRS: 0, cells: [] }
export const getCells = (day: Day, layer: Layer) => layer === 'Combined' ? day.cells : day.cells.filter(cell => cell[layer] > 0)
export const level = (n: number) => n >= 35 ? 4 : n >= 15 ? 3 : n >= 5 ? 2 : n > 0 ? 1 : 0
export const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`
export const format = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

export function monthDays(month: string) {
  const [year, number] = month.split('-').map(Number)
  const last = new Date(`${month}-01T00:00:00Z`)
  last.setUTCMonth(number, 0)
  return Array.from({ length: last.getUTCDate() }, (_, i) => `${monthKey(year, number)}-${String(i + 1).padStart(2, '0')}`)
}

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const content = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
