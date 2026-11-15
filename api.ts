import type { Bounds, Dataset, Sensor } from './contract'

export type ImportFiles = Record<Sensor, File>

export async function loadDataset(bounds: Bounds, files?: ImportFiles, signal?: AbortSignal, recent = false): Promise<Dataset> {
  const route = files ? 'import' : recent ? 'recent' : 'archive'
  const query = new URLSearchParams({ bounds: bounds.join(',') })
  const body = files ? new FormData() : undefined
  if (body && files) {
    body.set('MODIS', files.MODIS)
    body.set('VIIRS', files.VIIRS)
  }
  const response = await fetch(`/api/fire-atlas/${route}?${query}`, { method: files ? 'POST' : 'GET', body, signal })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The Fire Atlas API is unavailable. Check that the backend is running and try again.')
  }
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Fire Atlas could not load observations.')
  return result as Dataset
}
