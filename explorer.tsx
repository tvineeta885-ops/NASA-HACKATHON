'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  Activity, ArrowDownToLine, ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, ChevronLeft,
  ChevronRight, Database, Flame, Globe2, Layers, MapPin, Maximize, Minus, Pause, Play, Plus,
  Satellite, Upload, X,
} from 'lucide-react'
import {
  archive, challenge, downloadCsv, emptyDay, firms, firmsAttributes, format, getCells, level, monthDays, portugalMap, regions,
} from './data'
import { layers, maxFileBytes, portugal, world, type Bounds, type Cell, type Dataset, type Day, type Layer, type Sensor } from './contract'
import { loadDataset, type ImportFiles as CsvFiles } from './api'
import portugalImage from './assets/portugal.jpg'
import worldImage from './assets/world.jpg'
import earthStill from './assets/earth-still.webp'

const Earth = dynamic(() => import('./earth'), {
  ssr: false,
  loading: () => <div className="earth-stage"><div className="earth-placeholder" aria-hidden="true" style={{ backgroundImage: `url(${earthStill.src})` }} /></div>,
})

type View = 'method' | 'compare' | 'import'
const defaultMonth = '2025-08'
const utcTimestamp = (value: string) => `${value.slice(0, 16).replace('T', ' ')} UTC`
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 1 })
const count = (value: number) => number.format(value)
const isoMonth = (month: string) => format(`${month}-01`, { month: 'long', year: 'numeric' })
const shortDay = (date: string) => format(date, { month: 'short', day: 'numeric' })
const longDay = (date: string) => format(date, { weekday: 'long', month: 'long', day: 'numeric' })

function Reading({ value }: { value: string | number }) {
  return <span key={value} className="reading">{value}</span>
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  return <dialog className="modal" ref={dialog} aria-labelledby="dialog-heading" onCancel={event => {
    event.preventDefault()
    onClose()
  }} onClick={event => { if (event.target === dialog.current) onClose() }}>
    <div className="modal-inner">
      <div className="modal-head"><h2 id="dialog-heading">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></div>
      {children}
    </div>
  </dialog>
}
function ImportFiles({ onLoad }: { onLoad: (dataset: Dataset, files: CsvFiles) => void }) {
  const [files, setFiles] = useState<Partial<Record<Sensor, File>>>({})
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  return <form className="import-form" onSubmit={async event => {
    event.preventDefault()
    if (working) return
    setError('')
    setWorking(true)
    const operation = new AbortController()
    request.current = operation
    try {
      if (!files.MODIS || !files.VIIRS) throw new Error('Choose a CSV for each instrument.')
      if (files.MODIS.size > maxFileBytes || files.VIIRS.size > maxFileBytes) throw new Error('Use a regional extract under 50 MB per file.')
      const selected = { MODIS: files.MODIS, VIIRS: files.VIIRS }
      const dataset = await loadDataset(world, selected, operation.signal)
      if (!operation.signal.aborted) onLoad(dataset, selected)
    } catch (cause) {
      if (!operation.signal.aborted) setError(cause instanceof Error ? cause.message : 'The CSVs could not be read.')
    } finally {
      if (!operation.signal.aborted) setWorking(false)
    }
  }}>
    <p>Upload one <a href={archive} target="_blank" rel="noreferrer">FIRMS hotspot CSV</a> per instrument for the same region and overlapping dates. The API processes uploads for this request. Imported results last for this browser session.</p>
    {(['MODIS', 'VIIRS'] as const).map(sensor => <label className="file-field" key={sensor}>
      <span><Satellite size={17} /> {sensor} CSV</span>
      <input type="file" accept=".csv,text/csv" onChange={event => setFiles({ ...files, [sensor]: event.target.files?.[0] })} required />
    </label>)}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button accent-button" disabled={working}><Upload size={16} />{working ? 'Reading CSVs…' : 'Load observations'}</button>
  </form>
}

function HotspotMap({ cells, bounds, imageBounds, date, region, layer }: {
  cells: Cell[]; bounds: Bounds; imageBounds: Bounds; date: string; region: string; layer: Layer
}) {
  const [zoom, setZoom] = useState(1)
  const [picked, setSelected] = useState<Cell | null>(null)
  const selected = picked && cells.includes(picked) ? picked : null
  useEffect(() => setSelected(null), [date])
  const [west, south, east, north] = bounds
  const mid = (north + south) / 2 * Math.PI / 180
  const height = 350
  const width = height * (east - west) * Math.cos(mid) / (north - south)
  const project = (lon: number, lat: number) => [(lon - west) / (east - west) * width, (north - lat) / (north - south) * height]
  const [imageX, imageY] = project(imageBounds[0], imageBounds[3])
  const [imageRight, imageBottom] = project(imageBounds[2], imageBounds[1])
  const image = imageBounds === portugalMap ? portugalImage.src : worldImage.src
  const radius = bounds === world ? 2.4 : 2.5
  const caption = [date ? shortDay(date) : 'No date', `${count(cells.length)} ${cells.length === 1 ? 'cell' : 'cells'}`]
  return <section className="card map-card" id="hotspot-map" tabIndex={-1} aria-labelledby="map-title">
    <div className="card-head"><h2 id="map-title"><Globe2 size={18} /> Hotspot map</h2><span className="micro map-date"><Reading value={caption.join(' · ')} /></span></div>
    <div className="map-stage">
      <svg className="map-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio={bounds === portugalMap ? 'xMidYMid slice' : 'xMidYMid meet'} aria-label={`Hotspot map for ${region}, ${caption.join(', ')}`}>
        <defs><pattern id="map-grid" width={width / 8} height={height / 6} patternUnits="userSpaceOnUse"><path d={`M ${width / 8} 0 H 0 V ${height / 6}`} fill="none" stroke="#e8e7c9" strokeOpacity=".12" strokeWidth=".6" /></pattern></defs>
        <g transform={`translate(${width * (1 - zoom) / 2} ${height * (1 - zoom) / 2}) scale(${zoom})`}>
          <image className="terrain" href={image} x={imageX} y={imageY} width={imageRight - imageX} height={imageBottom - imageY} preserveAspectRatio="none" />
          <rect width={width} height={height} fill="url(#map-grid)" />
          {imageBounds === portugalMap && ([['PORTUGAL', -8.2, 39.75], ['SPAIN', -5.7, 40.4], ['ATLANTIC OCEAN', -10.65, 38.25]] as const).map(([label, lon, lat]) => {
            const [x, y] = project(lon, lat)
            return <text key={label} className="map-label" x={x} y={y}>{label}</text>
          })}
          <g key={date} className="hotspot-layer">
            {cells.map(cell => {
              const [x, y] = project(cell.lon, cell.lat)
              const both = cell.MODIS > 0 && cell.VIIRS > 0
              const type = layer === 'Combined' ? (both ? 'shared' : cell.MODIS ? 'modis' : 'viirs') : layer.toLowerCase()
              return <circle key={`${cell.lat}/${cell.lon}`} className={`map-dot ${type} ${selected === cell ? 'selected-dot' : ''}`} cx={x} cy={y} r={radius / Math.sqrt(zoom)} onClick={() => setSelected(selected === cell ? null : cell)}>
                <title>{`${cell.lat.toFixed(3)}, ${cell.lon.toFixed(3)}. MODIS ${cell.MODIS}, VIIRS ${cell.VIIRS}`}</title>
              </circle>
            })}
          </g>
        </g>
      </svg>
      <div className="map-north" aria-hidden="true"><span>▲</span>N</div>
      <div className="map-controls"><button className="icon-button" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom(Math.min(3, zoom * 1.4))}><Plus size={16} /></button><button className="icon-button" aria-label="Zoom out" disabled={zoom === 1} onClick={() => setZoom(Math.max(1, zoom / 1.4))}><Minus size={16} /></button><button className="icon-button" aria-label="Reset map zoom" onClick={() => setZoom(1)}><Maximize size={14} /></button></div>
      {selected && <div className="map-tooltip"><strong>{selected.lat.toFixed(3)}°, {selected.lon.toFixed(3)}°</strong> <span>MODIS {selected.MODIS} · VIIRS {selected.VIIRS}</span></div>}
      <a className="map-credit" href="https://earthdata.nasa.gov/data/projects/gibs" target="_blank" rel="noreferrer">NASA GIBS · Blue Marble</a>
    </div>
    <div className="map-legend">{layer !== 'VIIRS' && <span><i className="dot modis" /> MODIS</span>}{layer !== 'MODIS' && <span><i className="dot viirs" /> VIIRS</span>}{layer === 'Combined' && <span><i className="dot shared" /> Both sensors</span>}</div>
  </section>
}

function SensorRows({ day }: { day: Day }) {
  return <div className="sensor-rows">
    <div><i className="dot modis" /><span><b>MODIS</b><small>Terra / Aqua · 1 km</small></span><strong><Reading value={count(day.MODIS)} /></strong></div>
    <div><i className="dot viirs" /><span><b>VIIRS</b><small>375 m active fire product</small></span><strong><Reading value={count(day.VIIRS)} /></strong></div>
  </div>
}

export default function Explorer() {
  const [dataset, setDataset] = useState<Dataset>()
  const [importedFiles, setImportedFiles] = useState<CsvFiles>()
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [month, setMonth] = useState(defaultMonth)
  const [date, setDate] = useState('')
  const [playing, setPlaying] = useState(false)
  const [layer, setLayer] = useState<Layer>('Combined')
  const [useHarmonized, setUseHarmonized] = useState(true)
  const [region, setRegion] = useState(0)
  const [customBounds, setCustomBounds] = useState<Bounds>()
  const [dialog, setDialog] = useState<View>()
  const pending = useRef<AbortController | null>(null)
  const [mapArrival, setMapArrival] = useState(false)

  async function refresh(bounds: Bounds, files: CsvFiles | undefined, accept: (data: Dataset) => void, recent = false) {
    pending.current?.abort()
    const operation = new AbortController()
    pending.current = operation
    setLoadError('')
    setLoading(true)
    setPlaying(false)
    try {
      const data = await loadDataset(bounds, files, operation.signal, recent)
      if (operation.signal.aborted) return
      setDataset(data)
      accept(data)
    } catch (cause) {
      if (!operation.signal.aborted) setLoadError(cause instanceof Error ? cause.message : 'Observations unavailable.')
    } finally {
      if (!operation.signal.aborted) setLoading(false)
    }
  }

  function resetDemo() {
    return refresh(portugal, undefined, () => {
      setImportedFiles(undefined)
      setUseHarmonized(true)
      setMonth(defaultMonth)
      setDate('')
      setRegion(0)
      setCustomBounds(undefined)
      setNotice('')
    })
  }

  useEffect(() => {
    void resetDemo()
    return () => pending.current?.abort()
  }, [])

  function chooseArea(preset: number, custom?: Bounds) {
    const nextBounds = custom ?? (importedFiles ? world : preset === regions.length ? world : regions[preset].bounds)
    void refresh(nextBounds, importedFiles, next => {
      setRegion(preset)
      setCustomBounds(custom)
      const available = useHarmonized && next.harmonized ? next.harmonized.months : next.months
      if (!available.includes(month)) setMonth(available[available.length - 1])
      setDate('')
    }, Boolean(dataset?.recent))
  }

  const recent = dataset?.recent
  const harmonized = useHarmonized ? dataset?.harmonized : undefined
  const bounds = customBounds ?? (importedFiles || region === regions.length ? world : regions[region].bounds)
  const regionName = customBounds ? 'Custom area' : importedFiles ? 'All imported locations' : region === regions.length ? 'Worldwide' : regions[region].name
  const imageBounds = (!importedFiles && !recent) || (bounds[0] >= portugalMap[0] && bounds[1] >= portugalMap[1]
    && bounds[2] <= portugalMap[2] && bounds[3] <= portugalMap[3]) ? portugalMap : world
  const mapBounds = customBounds ?? imageBounds
  const days = dataset?.days ?? {}
  const calendar = monthDays(month)
  const listedDates = recent ? calendar.filter(day => recent.dates.includes(day)) : calendar
  const year = month.slice(0, 4)
  const availableMonths = harmonized?.months ?? dataset?.months ?? []
  const months = availableMonths.filter(item => item.startsWith(year))
  const years = [...new Set(availableMonths.map(item => item.slice(0, 4)))].reverse()
  const index = availableMonths.indexOf(month)
  const monthCount = (value: string, sensor: Layer) => dataset?.monthly[value]?.[sensor].total ?? 0
  const calendarCounts = calendar.map(day => harmonized ? harmonized.days[day]?.value ?? 0 : getCells(days[day] ?? emptyDay, layer).length)
  const total = harmonized?.monthly[month]?.total ?? monthCount(month, layer)
  const peak = Math.max(...calendarCounts)
  const peakDay = calendar[calendarCounts.indexOf(peak)]
  const selected = date || (recent && peak === 0 ? listedDates[listedDates.length - 1] ?? peakDay : peakDay)
  const historical = harmonized?.days[selected]
  const selectedDay = historical?.cells ? { MODIS: historical.detections ?? 0, VIIRS: 0, cells: historical.cells } : days[selected] ?? emptyDay
  const plottedLayer = harmonized ? (month < harmonized.method.transition ? 'MODIS' : 'VIIRS') : layer
  const selectedCells = getCells(selectedDay, plottedLayer)
  const history = availableMonths.filter(item => item.slice(5) === month.slice(5)).map(item => ({ month: item, total: harmonized?.monthly[item]?.total ?? monthCount(item, layer) }))
  const historyPeak = Math.max(1, ...history.map(item => item.total))
  const outsideDemo = !recent && !importedFiles && (bounds[2] <= portugal[0] || bounds[0] >= portugal[2]
    || bounds[3] <= portugal[1] || bounds[1] >= portugal[3])
  const partialDemo = !recent && !importedFiles && !outsideDemo && customBounds && (
    bounds[0] < portugal[0] || bounds[1] < portugal[1] || bounds[2] > portugal[2] || bounds[3] > portugal[3])
  const globeFocus = { lat: (bounds[1] + bounds[3]) / 2, lon: (bounds[0] + bounds[2]) / 2 }
  const comparison = harmonized ? harmonized.monthly[month]?.comparison : dataset?.monthly[month]?.[layer].comparison
  const agreement = dataset?.agreement[month]
  const archiveFirst = availableMonths[0]?.slice(0, 4)
  const archiveLast = availableMonths[availableMonths.length - 1]?.slice(0, 4)
  const change = comparison && comparison.median > 0 ? (total / comparison.median - 1) * 100 : null
  const leading = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7
  const trailing = (7 - (leading + calendar.length) % 7) % 7
  const playbackIndex = Math.max(0, listedDates.indexOf(selected))
  const nextPlaybackDate = listedDates[playbackIndex + 1] ?? listedDates[0]
  const canPlay = Boolean(dataset) && !outsideDemo && !loading && listedDates.length > 1

  useEffect(() => {
    if (!playing || !canPlay || dialog) return
    const timer = window.setInterval(() => {
      if (!document.hidden) setDate(nextPlaybackDate)
    }, 1400)
    return () => window.clearInterval(timer)
  }, [playing, canPlay, dialog, nextPlaybackDate])

  function chooseDay(value: string) {
    setPlaying(false)
    setDate(value)
  }

  function chooseMonth(value: string) {
    setMonth(value)
    chooseDay('')
  }

  function chooseLayer(value: Layer) {
    setUseHarmonized(false)
    setLayer(value)
    if (dataset && !dataset.months.includes(month)) chooseMonth(dataset.months[0])
    else chooseDay('')
  }

  function loadRecent() {
    void refresh(bounds, undefined, next => {
      setImportedFiles(undefined)
      if (!customBounds && importedFiles) setRegion(regions.length)
      chooseMonth(next.months[next.months.length - 1])
      setNotice('')
    }, true)
  }

  function showHotspots() {
    const map = document.getElementById('hotspot-map')
    if (!map) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map.focus({ preventScroll: true })
    map.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'center' })
    if (!reduce) setMapArrival(true)
  }

  function exportMonth() {
    if (harmonized) {
      downloadCsv(`fire-atlas-harmonized-${month}.csv`, [
        ['date_utc', 'area', 'modis_equivalent_cell_days', 'source'],
        ...calendar.map(day => [day, regionName, (harmonized.days[day]?.value ?? 0).toFixed(6),
          month < harmonized.method.transition ? 'MODIS Terra/Aqua' : 'Calibrated VIIRS Suomi NPP']),
      ])
      return
    }
    downloadCsv(`fire-atlas-${recent ? 'recent-' : ''}${month}.csv`, [
      ['date_utc', 'area', 'selected_layer', 'occupied_cells_5km', 'combined_cells', 'modis_cells', 'viirs_cells', 'modis_detections', 'viirs_detections', 'dataset', 'shared_cells', 'coverage'],
      ...listedDates.map(day => {
        const record = days[day] ?? emptyDay
        return [day, customBounds ? bounds.join('/') : regionName, layer, getCells(record, layer).length, record.cells.length,
          getCells(record, 'MODIS').length, getCells(record, 'VIIRS').length, record.MODIS, record.VIIRS,
          importedFiles ? 'Imported FIRMS' : recent ? 'NASA FIRMS public 24h (MODIS / NOAA-20 VIIRS)' : 'NASA FIRMS standard-processing Portugal archive',
          record.cells.filter(cell => cell.MODIS && cell.VIIRS).length, 'Observation coverage unknown']
      }),
    ])
  }

  return <>
    <header className="topbar"><div className="top-inner">
      <Link href="/" className="identity" aria-label="Fire Atlas home"><Flame size={20} strokeWidth={1.6} /><span>FIRE ATLAS</span></Link>
      <nav aria-label="Main navigation" className="navigation"><a href="#calendar-title">Calendar</a><button onClick={() => setDialog('compare')} disabled={!dataset || outsideDemo || !dataset.months.includes(month)}>Compare sensors</button><button onClick={() => setDialog('method')}>Methodology</button></nav>
      <button className="button import-button" onClick={() => setDialog('import')}>Import CSV <Upload size={14} /></button>
    </div></header>
    <main className="shell" id="explorer">
      <div className="hero">
        <div className="hero-copy">
          <div className="archive-badge">{recent ? 'NASA FIRMS · Near real-time' : importedFiles ? 'Imported FIRMS CSV' : archiveFirst ? `NASA FIRMS · ${archiveFirst}–${archiveLast}` : 'NASA FIRMS standard processing'}</div>
          <h1>Fire from <br />orbit<span>.</span></h1>
          <p>Follow burning activity through the MODIS and VIIRS satellite record.</p>
          <a href="#calendar-title" className="hero-link">Explore the calendar <ArrowDownRight size={17} /></a>
        </div>
        <Earth cells={selectedCells} layer={plottedLayer} focus={globeFocus} date={selected} area={regionName} onShowHotspots={dataset && !outsideDemo ? showHotspots : undefined} />
      </div>
      <div className="workbench">
      <div className="observation-heading"><div><span className="micro">{regionName}</span><p>Burning activity</p></div>
        {dataset && !outsideDemo && <div className="observation-total"><strong className="metric-value"><Reading value={count(total)} /></strong><span>{harmonized ? 'MODIS-equivalent' : 'Occupied'} cell-days</span></div>}
      </div>
      <div className="toolbar">
        <div className="layer-filter"><span className="micro filter-label">NASA FIRMS SOURCE</span><div className="segmented" role="group" aria-label="Data source">
          <button aria-pressed={!recent && !importedFiles} disabled={loading} onClick={() => { void resetDemo() }}>Archive</button>
          <button aria-pressed={Boolean(recent)} disabled={loading} onClick={loadRecent}>{recent ? 'Refresh recent' : 'Recent hotspots'}</button>
        </div></div>
        <div className="area-filter"><span className="micro filter-label">AREA OF INTEREST</span><div className="select-field"><MapPin size={16} /><select aria-label="Area of interest" value={customBounds ? 'custom' : region} disabled={loading} onChange={event => {
          if (event.target.value === 'custom') return
          chooseArea(Number(event.target.value))
        }}>
          {importedFiles ? <option value={0}>All imported locations</option> : regions.map((item, i) => <option key={item.name} value={i}>{item.name}</option>)}
          {recent && <option value={regions.length}>Worldwide</option>}
          {customBounds && <option value="custom">Custom area</option>}
        </select><ChevronDown size={14} /></div><AreaPicker bounds={bounds} disabled={loading} onApply={value => chooseArea(region, value)} /></div>
        <div className="layer-filter"><span className="micro filter-label">ACTIVITY SERIES</span><div className="segmented" role="group" aria-label="Activity series">
          {dataset?.harmonized && <button aria-pressed={Boolean(harmonized)} onClick={() => { setUseHarmonized(true); chooseDay('') }}>Harmonized</button>}
          {layers.map(item => <button key={item} aria-pressed={!harmonized && layer === item} onClick={() => chooseLayer(item)}>{item === 'Combined' && <Layers size={14} />}{item}</button>)}
        </div></div>
        <button className="button export" aria-label={recent ? 'Export snapshot' : 'Export month'} disabled={!dataset || loading || outsideDemo} onClick={exportMonth}><ArrowDownToLine size={16} /> {recent ? 'Export snapshot' : 'Export month'}</button>
      </div>
      {notice && <p className="status" role="status">{notice}</p>}
      {harmonized && <p className="status">MODIS through 2012 · calibrated S-NPP VIIRS from 2013. Held-out monthly error versus MODIS was {count(harmonized.method.adjusted_mae)} cell-days after adjustment and {count(harmonized.method.raw_mae)} before. The map shows the source detections.</p>}
      {recent && <div className="status recent-source">
        <span>NASA FIRMS 24-hour products · fetched {utcTimestamp(recent.fetched_at)}</span>
        <span><a href={recent.feeds.MODIS.url}>MODIS CSV</a> · last observation {utcTimestamp(recent.feeds.MODIS.last_observed_at)}</span>
        <span><a href={recent.feeds.VIIRS.url}>NOAA-20 VIIRS CSV</a> · last observation {utcTimestamp(recent.feeds.VIIRS.last_observed_at)}</span>
      </div>}
      {outsideDemo && <p className="status" role="status">This area is outside the Portugal demo. Import FIRMS CSVs to explore other regions.</p>}
      {partialDemo && <p className="status" role="status">The demo counts only the mainland Portugal portion of this area.</p>}
      {importedFiles && <div className="import-note"><span>Imported months reflect dates present in both files. Check that both cover the same area and full date range.</span><button disabled={loading} onClick={() => void resetDemo()}>Restore Portugal demo</button></div>}
      {loadError && <p className="status" role="alert">{loadError} {!dataset && <button onClick={() => void resetDemo()}>Retry archive</button>}</p>}
      {loading && <p className="status" role="status">{dataset ? 'Updating observations…' : 'Loading NASA FIRMS archive…'}</p>}
      {dataset && !outsideDemo && <>
        <section className="metrics" aria-label="Month summary">
          <article className="metric"><div className="metric-label"><CalendarDays size={16} /> Days with detections</div><div className="metric-value"><Reading value={calendarCounts.filter(Boolean).length} /><small> / {listedDates.length}</small></div><div className="metric-note">{recent ? 'UTC dates in the snapshot' : 'UTC days this month'}</div></article>
          <article className="metric"><div className="metric-label"><Flame size={16} /> Peak activity</div><div className="metric-value"><Reading value={count(peak)} /><small>{harmonized ? ' equiv.' : ' cells'}</small></div><div className="metric-note">{peak ? <button className="text-link" onClick={() => chooseDay(peakDay)}>{shortDay(peakDay)} <ArrowUpRight size={12} /></button> : 'No detected cells'}</div></article>
          {!recent && <article className={`metric ${comparison?.above ? 'anomaly-metric' : ''}`}><div className="metric-label"><Activity size={16} /> vs. historical median</div><div className="metric-value"><Reading value={change === null ? '—' : `${change >= 0 ? '+' : '−'}${count(Math.round(Math.abs(change)))}%`} />{change !== null && (change >= 0 ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />)}</div><div className="metric-note">{comparison ? `${count(comparison.median)} cell-days · above ${comparison.prior_below} of ${comparison.years} prior years` : importedFiles ? 'Imported coverage unverified' : 'Needs 3 prior archive years'}</div></article>}
        </section>
        <div className="workspace">
          <section className="card calendar-card" aria-labelledby="calendar-title">
            <div className="card-head"><h2 id="calendar-title"><CalendarDays size={18} /> Burning activity calendar</h2><span className="micro utc">UTC</span></div>
            <div className="calendar-inner">
              <div className="calendar-heading"><h3>{isoMonth(month)}</h3><div className="month-controls">
                <select aria-label="Month" value={month} onChange={event => chooseMonth(event.target.value)}>{months.map(item => <option key={item} value={item}>{format(`${item}-01`, { month: 'short' })}</option>)}</select>
                <select aria-label="Year" value={year} onChange={event => {
                  const sameMonth = `${event.target.value}${month.slice(4)}`
                  chooseMonth(availableMonths.includes(sameMonth) ? sameMonth : availableMonths.find(item => item.startsWith(event.target.value))!)
                }}>{years.map(item => <option key={item}>{item}</option>)}</select>
                <button className="icon-button" aria-label="Previous month" disabled={index <= 0} onClick={() => chooseMonth(availableMonths[index - 1])}><ChevronLeft size={17} /></button>
                <button className="icon-button" aria-label="Next month" disabled={index >= availableMonths.length - 1} onClick={() => chooseMonth(availableMonths[index + 1])}><ChevronRight size={17} /></button>
              </div></div>
              <div className="day-playback">
                <button type="button" className="button playback-toggle" data-playing={playing} disabled={!canPlay} onClick={() => setPlaying(value => !value)}>
                  {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                  {playing ? 'Pause days' : 'Play days'}
                </button>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, listedDates.length - 1)}
                  value={playbackIndex}
                  disabled={!canPlay}
                  aria-label="Observation date"
                  aria-valuetext={longDay(selected)}
                  onChange={event => chooseDay(listedDates[Number(event.target.value)])}
                />
                <span className="micro"><Reading value={shortDay(selected)} /></span>
              </div>
              <div className="calendar-grid">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(item => <div className="weekday" key={item}>{item}</div>)}
                {Array.from({ length: leading }, (_, i) => <div className="pad-day" key={`before-${i}`} />)}
                {calendar.map((day, i) => {
                  const available = !recent || recent.dates.includes(day)
                  return <button key={day} className={`day level-${level(calendarCounts[i])}`} disabled={!available} aria-pressed={selected === day} aria-label={`${shortDay(day)}, ${available ? (harmonized ? `${count(calendarCounts[i])} equivalent cells` : `${calendarCounts[i]} occupied cells`) : 'outside the snapshot'}`} onClick={() => chooseDay(day)}>
                  <span>{i + 1}</span><strong>{available ? count(calendarCounts[i]) : '—'}</strong>
                </button>})}
                {Array.from({ length: trailing }, (_, i) => <div className="pad-day" key={`after-${i}`} />)}
              </div>
              <div className="heat-legend"><span>{harmonized ? 'Equivalent cells' : 'Occupied cells'}</span><div>{(harmonized ? ['0', '>0–<5', '5–<15', '15–<35', '35+'] : ['0', '1–4', '5–14', '15–34', '35+']).map((item, i) => <span key={item}><i className={`level-${i}`} />{item}</span>)}</div></div>
              <p className="coverage-note">Zero means no retained hotspots. Cloud and overpass coverage are unknown.</p>
            </div>
          </section>
          <aside className={`detail-stack${mapArrival ? ' map-arrival' : ''}`} onAnimationEnd={event => {
            if (event.animationName === 'map-arrival') setMapArrival(false)
          }}>
            <HotspotMap key={`${regionName}-${plottedLayer}-${bounds.join(',')}`} cells={selectedCells} bounds={mapBounds} imageBounds={imageBounds} date={selected} region={regionName} layer={plottedLayer} />
            <section className="card detail-card" aria-labelledby="detail-title">
              <div className="card-head"><h2 id="detail-title"><Satellite size={18} /> {longDay(selected)}</h2><span className="micro">DAY DETAIL</span></div>
              {harmonized ? <div className="detail-foot"><span>{plottedLayer} observed cells</span><strong><Reading value={count(selectedCells.length)} /></strong></div> : <>
                <SensorRows day={selectedDay} />
                <div className="detail-foot"><span>Shared 5 km cells</span><strong><Reading value={count(selectedDay.cells.filter(cell => cell.MODIS && cell.VIIRS).length)} /></strong></div>
              </>}
              <div className="detail-foot"><a href={`https://worldview.earthdata.nasa.gov/?t=${selected}-T12:00:00Z&v=${mapBounds.join(',')}`} target="_blank" rel="noreferrer">Check imagery in NASA Worldview <ArrowUpRight size={13} /></a></div>
            </section>
          </aside>
        </div>
        {!recent && !importedFiles && !outsideDemo && <section className="card history-card" aria-labelledby="history-title">
          <div className="card-head"><h2 id="history-title"><Activity size={18} /> {format(`${month}-01`, { month: 'long' })} across years</h2><span className="micro">CELL-DAYS</span></div>
          <div className="history-bars">{history.map(item => <button key={item.month} aria-pressed={item.month === month} aria-label={`${isoMonth(item.month)}, ${item.total} occupied cell-days`} onClick={() => chooseMonth(item.month)}>
            <strong>{count(item.total)}</strong><span className="bar-track"><i style={{ height: `${item.total / historyPeak * 100}%` }} /></span><span>{item.month.slice(0, 4)}</span>
          </button>)}</div>
        </section>}
      </>}
      <footer><span><Database size={14} /> Data <a href={recent ? firms : archive} target="_blank" rel="noreferrer">NASA FIRMS</a><i /> {recent ? 'Near real-time UTC detections' : 'Historical UTC detections'}</span><a href={challenge} target="_blank" rel="noreferrer">NASA Space Apps Challenge 2026 <ArrowUpRight size={13} /></a></footer>
      </div>
    </main>
    {dialog === 'import' && <Modal title="Import FIRMS observations" onClose={() => setDialog(undefined)}><ImportFiles onLoad={(next, files) => {
      pending.current?.abort()
      setLoading(false)
      setImportedFiles(files)
      setDataset(next)
      chooseMonth(next.months[next.months.length - 1])
      setRegion(0)
      setCustomBounds(undefined)
      setDialog(undefined)
      setLoadError('')
      setNotice(`${count(next.count)} observations passed the confidence and type filters.${next.skipped ? ` ${count(next.skipped)} invalid rows skipped.` : ''}`)
    }} /></Modal>}
    {dialog === 'compare' && <Modal title="Compare sensors" onClose={() => setDialog(undefined)}>
      <p>{regionName} · {isoMonth(month)}</p><div className="compare-grid"><div><span>MODIS cell-days</span><strong>{count(monthCount(month, 'MODIS'))}</strong></div><div><span>VIIRS cell-days</span><strong>{count(monthCount(month, 'VIIRS'))}</strong></div><div><span>Combined cell-days</span><strong>{count(monthCount(month, 'Combined'))}</strong></div></div>
      {agreement && <><div className="compare-grid"><div><span>MODIS only</span><strong>{count(agreement.modis_only)}</strong></div><div><span>VIIRS only</span><strong>{count(agreement.viirs_only)}</strong></div><div><span>Shared cell-days</span><strong>{count(agreement.shared)}</strong></div></div><p>Shared cell-days account for {agreement.share === null ? '—' : `${count(agreement.share * 100)}%`} of Combined activity.</p></>}
      <p>Shared means both sensors detected activity in the same cell on the same UTC day. Satellite overpasses can occur hours apart. Raw detection counts for {longDay(selected)} are shown below.</p><SensorRows day={days[selected] ?? emptyDay} />
    </Modal>}
    {dialog === 'method' && <Modal title="How Fire Atlas harmonizes hotspots" onClose={() => setDialog(undefined)}>
      <div className="method-content"><h3>1. Filter observations</h3><p>Keep MODIS confidence ≥30 and VIIRS nominal or high confidence. If the FIRMS type field is supplied, retain presumed vegetation fires (type 0) and rows with unspecified type.</p>
        <h3>2. Use a common grid and date</h3><p>Assign each detection center to a 5 × 5 km equal-area grid cell and UTC day. Each sensor counts a cell once on that day. Combined takes the union. Monthly totals sum these daily occupied cells.</p>
        <h3>3. Calibrate across sensors</h3><p>For each Portugal preset, fit the ratio of MODIS to S-NPP VIIRS cell-days by calendar quarter on 2013–2020 data. Check the adjustment on 2021–2025. The harmonized series uses MODIS through 2012 and adjusted VIIRS thereafter. Historical comparisons use the same calendar month in earlier years.</p>
        <h3>Interpret the counts</h3><p>Zero means no retained detections. Coverage can vary with overpasses, cloud and instrument sensitivity. Occupied cells describe detected activity. Fire extent, incident counts and hazard forecasts require other data.</p>
        <p><a href={firms} target="_blank" rel="noreferrer">NASA FIRMS resources</a> · <a href={firmsAttributes} target="_blank" rel="noreferrer">FIRMS data fields</a> · <a href="/api/fire-atlas/provenance" target="_blank" rel="noreferrer">Archive provenance</a></p></div>
    </Modal>}
  </>
}

function AreaPicker({ bounds, disabled, onApply }: { bounds: Bounds; disabled: boolean; onApply: (bounds: Bounds) => void }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  return <><button className="icon-button custom-area" aria-label="Set custom area" title="Set custom area" disabled={disabled} onClick={() => { setError(''); setOpen(true) }}><Maximize size={15} /></button>
    {open && <Modal title="Set custom area" onClose={() => setOpen(false)}><form className="import-form" onSubmit={event => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      const values = [Number(data.get('West')), Number(data.get('South')), Number(data.get('East')), Number(data.get('North'))] as const
      if (values[0] >= values[2] || values[1] >= values[3]) { setError('West must be before east and south must be below north.'); return }
      onApply(values); setOpen(false)
    }}><p>Enter longitude and latitude bounds in decimal degrees.</p><div className="bounds-grid">{['West', 'South', 'East', 'North'].map((item, i) => <label key={item}>{item}<input name={item} type="number" step="any" min={i % 2 ? -90 : -180} max={i % 2 ? 90 : 180} required defaultValue={bounds[i]} /></label>)}</div><p>Historical demo observations cover mainland Portugal.</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="button accent-button">Apply area</button></form></Modal>}
  </>
}
