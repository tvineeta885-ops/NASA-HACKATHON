'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Activity, ArrowDownToLine, ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, ChevronLeft,
  ChevronRight, CircleHelp, Database, Flame, Globe2, Layers, MapPin, Maximize, Minus, Plus, Radio,
  Satellite, Upload, X,
} from 'lucide-react'
import {
  archive, challenge, downloadCsv, emptyDay, firms, firmsAttributes, format, getCells, level, monthDays, portugalMap, regions,
} from './data'
import { layers, maxFileBytes, portugal, world, type Bounds, type Cell, type Dataset, type Day, type Layer, type Sensor } from './contract'
import { loadDataset, type ImportFiles as CsvFiles } from './api'
import portugalImage from './assets/portugal.jpg'
import worldImage from './assets/world.jpg'

type View = 'method' | 'compare' | 'import'
const defaultMonth = '2025-08'
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 1 })
const count = (value: number) => number.format(value)
const isoMonth = (month: string) => format(`${month}-01`, { month: 'long', year: 'numeric' })
const shortDay = (date: string) => format(date, { month: 'short', day: 'numeric' })
const longDay = (date: string) => format(date, { weekday: 'long', month: 'long', day: 'numeric' })

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
  const [selected, setSelected] = useState<Cell | null>(null)
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
  return <section className="card map-card" aria-labelledby="map-title">
    <div className="card-head"><h2 id="map-title"><Globe2 size={18} /> Hotspot map</h2><span className="micro map-date">{caption[0]} · {caption[1]}</span></div>
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
          {cells.map(cell => {
            const [x, y] = project(cell.lon, cell.lat)
            const both = cell.MODIS > 0 && cell.VIIRS > 0
            const type = layer === 'Combined' ? (both ? 'shared' : cell.MODIS ? 'modis' : 'viirs') : layer.toLowerCase()
            return <circle key={`${cell.lat}/${cell.lon}`} className={`map-dot ${type} ${selected === cell ? 'selected-dot' : ''}`} cx={x} cy={y} r={radius / Math.sqrt(zoom)} onClick={() => setSelected(selected === cell ? null : cell)}>
              <title>{`${cell.lat.toFixed(3)}, ${cell.lon.toFixed(3)}. MODIS ${cell.MODIS}, VIIRS ${cell.VIIRS}`}</title>
            </circle>
          })}
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
    <div><i className="dot modis" /><span><b>MODIS</b><small>Terra / Aqua · 1 km</small></span><strong>{count(day.MODIS)}</strong></div>
    <div><i className="dot viirs" /><span><b>VIIRS</b><small>375 m active fire product</small></span><strong>{count(day.VIIRS)}</strong></div>
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
  const [layer, setLayer] = useState<Layer>('Combined')
  const [region, setRegion] = useState(0)
  const [customBounds, setCustomBounds] = useState<Bounds>()
  const [dialog, setDialog] = useState<View>()
  const pending = useRef<AbortController | null>(null)

  async function refresh(bounds: Bounds, files: CsvFiles | undefined, accept: (data: Dataset) => void) {
    pending.current?.abort()
    const operation = new AbortController()
    pending.current = operation
    setLoadError('')
    setLoading(true)
    try {
      const data = await loadDataset(bounds, files, operation.signal)
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
    const nextBounds = custom ?? (importedFiles ? world : regions[preset].bounds)
    void refresh(nextBounds, importedFiles, () => {
      setRegion(preset)
      setCustomBounds(custom)
      setDate('')
    })
  }

  const bounds = customBounds ?? (importedFiles ? world : regions[region].bounds)
  const regionName = customBounds ? 'Custom area' : importedFiles ? 'All imported locations' : regions[region].name
  const imageBounds = !importedFiles || (bounds[0] >= portugalMap[0] && bounds[1] >= portugalMap[1]
    && bounds[2] <= portugalMap[2] && bounds[3] <= portugalMap[3]) ? portugalMap : world
  const mapBounds = customBounds ?? imageBounds
  const days = dataset?.days ?? {}
  const calendar = monthDays(month)
  const year = month.slice(0, 4)
  const months = dataset?.months.filter(item => item.startsWith(year)) ?? []
  const years = [...new Set(dataset?.months.map(item => item.slice(0, 4)))].reverse()
  const index = dataset?.months.indexOf(month) ?? -1
  const monthCount = (value: string, sensor: Layer) => dataset?.monthly[value]?.[sensor].total ?? 0
  const calendarCounts = calendar.map(day => getCells(days[day] ?? emptyDay, layer).length)
  const total = monthCount(month, layer)
  const peak = Math.max(...calendarCounts)
  const peakDay = calendar[calendarCounts.indexOf(peak)]
  const selected = date || peakDay
  const selectedDay = days[selected] ?? emptyDay
  const selectedCells = getCells(selectedDay, layer)
  const history = dataset?.months.filter(item => item.slice(5) === month.slice(5)).map(item => ({ month: item, total: monthCount(item, layer) })) ?? []
  const historyPeak = Math.max(1, ...history.map(item => item.total))
  const outsideDemo = !importedFiles && (bounds[2] <= portugal[0] || bounds[0] >= portugal[2]
    || bounds[3] <= portugal[1] || bounds[1] >= portugal[3])
  const partialDemo = !importedFiles && !outsideDemo && customBounds && (
    bounds[0] < portugal[0] || bounds[1] < portugal[1] || bounds[2] > portugal[2] || bounds[3] > portugal[3])
  const comparison = dataset?.monthly[month]?.[layer].comparison
  const agreement = dataset?.agreement[month]
  const archiveFirst = dataset?.months[0]?.slice(0, 4)
  const archiveLast = dataset?.months[dataset.months.length - 1]?.slice(0, 4)
  const change = comparison && comparison.median > 0 ? (total / comparison.median - 1) * 100 : null
  const leading = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7
  const trailing = (7 - (leading + calendar.length) % 7) % 7

  function chooseMonth(value: string) {
    setMonth(value)
    setDate('')
  }

  function exportMonth() {
    downloadCsv(`fire-atlas-${month}.csv`, [
      ['date_utc', 'area', 'selected_layer', 'occupied_cells_5km', 'combined_cells', 'modis_cells', 'viirs_cells', 'modis_detections', 'viirs_detections', 'dataset', 'shared_cells', 'coverage'],
      ...calendar.map(day => {
        const record = days[day] ?? emptyDay
        return [day, customBounds ? bounds.join('/') : regionName, layer, getCells(record, layer).length, record.cells.length,
          getCells(record, 'MODIS').length, getCells(record, 'VIIRS').length, record.MODIS, record.VIIRS,
          importedFiles ? 'Imported FIRMS' : 'NASA FIRMS standard-processing Portugal archive',
          record.cells.filter(cell => cell.MODIS && cell.VIIRS).length, 'Observation coverage unknown']
      }),
    ])
  }

  return <>
    <header className="topbar"><div className="top-inner">
      <Link href="/" className="identity" aria-label="Fire Atlas home"><span className="brand-icon"><Flame size={22} fill="currentColor" strokeWidth={1.5} /></span><span>Fire Atlas<small>EARTH OBSERVATION</small></span></Link>
      <nav aria-label="Main navigation" className="navigation"><a className="current" href="#explorer" aria-current="page"><CalendarDays size={16} /> Explorer</a><button onClick={() => setDialog('compare')} disabled={!dataset || outsideDemo}><Layers size={16} /> Compare sensors</button><button onClick={() => setDialog('method')}><CircleHelp size={16} /> Methodology</button></nav>
      <button className="button import-button" onClick={() => setDialog('import')}><Upload size={15} /><span>Import CSV</span></button>
    </div></header>
    <main className="shell" id="explorer">
      <div className="hero">
        <div><div className="kicker"><Radio size={14} /> HISTORICAL FIRE INTELLIGENCE</div><h1>Burning activity <em>explorer</em></h1><p>See where and when burning activity was detected across the MODIS and VIIRS record.</p></div>
        <div className="archive-badge"><div><i /> {importedFiles ? 'IMPORTED RECORD' : 'HISTORICAL ARCHIVE'}</div><span>{importedFiles ? 'FIRMS CSV · coverage unverified' : archiveFirst ? `NASA FIRMS · ${archiveFirst}–${archiveLast}` : 'NASA FIRMS standard processing'}</span></div>
      </div>
      <div className="toolbar">
        <div className="area-filter"><span className="micro filter-label">AREA OF INTEREST</span><div className="select-field"><MapPin size={16} /><select aria-label="Area of interest" value={customBounds ? 'custom' : region} disabled={loading} onChange={event => {
          if (event.target.value === 'custom') return
          chooseArea(Number(event.target.value))
        }}>
          {importedFiles ? <option value={0}>All imported locations</option> : regions.map((item, i) => <option key={item.name} value={i}>{item.name}</option>)}
          {customBounds && <option value="custom">Custom area</option>}
        </select><ChevronDown size={14} /></div><AreaPicker bounds={bounds} disabled={loading} onApply={value => chooseArea(region, value)} /></div>
        <div className="layer-filter"><span className="micro filter-label">SENSOR LAYER</span><div className="segmented" role="group" aria-label="Sensor layer">{layers.map(item => <button key={item} aria-pressed={layer === item} onClick={() => { setLayer(item); setDate('') }}>{item === 'Combined' && <Layers size={14} />}{item}</button>)}</div></div>
        <button className="button export" aria-label="Export month" disabled={!dataset || loading || outsideDemo} onClick={exportMonth}><ArrowDownToLine size={16} /> Export month</button>
      </div>
      {notice && <p className="status" role="status">{notice}</p>}
      {outsideDemo && <p className="status" role="status">This area is outside the Portugal demo. Import FIRMS CSVs to explore other regions.</p>}
      {partialDemo && <p className="status" role="status">The demo counts only the mainland Portugal portion of this area.</p>}
      {importedFiles && <div className="import-note"><span>Imported months reflect dates present in both files. Check that both cover the same area and full date range.</span><button disabled={loading} onClick={() => void resetDemo()}>Restore Portugal demo</button></div>}
      {loadError && <p className="status" role="alert">{loadError} {!dataset && <button onClick={() => void resetDemo()}>Retry archive</button>}</p>}
      {loading && <p className="status" role="status">{dataset ? 'Updating observations…' : 'Loading NASA FIRMS archive…'}</p>}
      {dataset && !outsideDemo && <>
        <section className="metrics" aria-label="Month summary">
          <article className="metric"><div className="metric-label"><Activity size={16} /> Occupied cell-days</div><div className="metric-value">{count(total)}</div><div className="metric-note">{layer} · 5 km grid</div></article>
          <article className="metric"><div className="metric-label"><CalendarDays size={16} /> Days with detections</div><div className="metric-value">{calendarCounts.filter(Boolean).length}<small> / {calendar.length}</small></div><div className="metric-note">UTC days this month</div></article>
          <article className="metric"><div className="metric-label"><Flame size={16} /> Peak activity</div><div className="metric-value">{count(peak)}<small> cells</small></div><div className="metric-note">{peak ? <button className="text-link" onClick={() => setDate(peakDay)}>{shortDay(peakDay)} <ArrowUpRight size={12} /></button> : 'No detected cells'}</div></article>
          <article className={`metric ${comparison?.above ? 'anomaly-metric' : ''}`}><div className="metric-label"><Activity size={16} /> vs. historical median</div><div className="metric-value">{change === null ? '—' : `${change >= 0 ? '+' : '−'}${count(Math.round(Math.abs(change)))}%`}{change !== null && (change >= 0 ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />)}</div><div className="metric-note">{comparison ? `${count(comparison.median)} cell-days · above ${comparison.prior_below} of ${comparison.years} prior years` : importedFiles ? 'Imported coverage unverified' : 'Needs 3 prior archive years'}</div></article>
        </section>
        <div className="workspace">
          <section className="card calendar-card" aria-labelledby="calendar-title">
            <div className="card-head"><h2 id="calendar-title"><CalendarDays size={18} /> Burning activity calendar</h2><span className="micro utc">UTC</span></div>
            <div className="calendar-inner">
              <div className="calendar-heading"><h3>{isoMonth(month)}</h3><div className="month-controls">
                <select aria-label="Month" value={month} onChange={event => chooseMonth(event.target.value)}>{months.map(item => <option key={item} value={item}>{format(`${item}-01`, { month: 'short' })}</option>)}</select>
                <select aria-label="Year" value={year} onChange={event => {
                  const sameMonth = `${event.target.value}${month.slice(4)}`
                  chooseMonth(dataset.months.includes(sameMonth) ? sameMonth : dataset.months.find(item => item.startsWith(event.target.value))!)
                }}>{years.map(item => <option key={item}>{item}</option>)}</select>
                <button className="icon-button" aria-label="Previous month" disabled={index <= 0} onClick={() => chooseMonth(dataset.months[index - 1])}><ChevronLeft size={17} /></button>
                <button className="icon-button" aria-label="Next month" disabled={index >= dataset.months.length - 1} onClick={() => chooseMonth(dataset.months[index + 1])}><ChevronRight size={17} /></button>
              </div></div>
              <div className="calendar-grid">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(item => <div className="weekday" key={item}>{item}</div>)}
                {Array.from({ length: leading }, (_, i) => <div className="pad-day" key={`before-${i}`} />)}
                {calendar.map((day, i) => <button key={day} className={`day level-${level(calendarCounts[i])}`} aria-pressed={selected === day} aria-label={`${shortDay(day)}, ${calendarCounts[i]} occupied cells`} onClick={() => setDate(day)}>
                  <span>{i + 1}</span><strong>{count(calendarCounts[i])}</strong>
                </button>)}
                {Array.from({ length: trailing }, (_, i) => <div className="pad-day" key={`after-${i}`} />)}
              </div>
              <div className="heat-legend"><span>Occupied cells</span><div>{['0', '1–4', '5–14', '15–34', '35+'].map((item, i) => <span key={item}><i className={`level-${i}`} />{item}</span>)}</div></div>
              <p className="coverage-note">Zero means no retained hotspots. Cloud and overpass coverage are unknown.</p>
            </div>
          </section>
          <aside className="detail-stack">
            <HotspotMap key={`${selected}-${regionName}-${layer}-${bounds.join(',')}`} cells={selectedCells} bounds={mapBounds} imageBounds={imageBounds} date={selected} region={regionName} layer={layer} />
            <section className="card detail-card" aria-labelledby="detail-title">
              <div className="card-head"><h2 id="detail-title"><Satellite size={18} /> {longDay(selected)}</h2><span className="micro">DAY DETAIL</span></div>
              <SensorRows day={selectedDay} />
              <div className="detail-foot"><span>Shared 5 km cells</span><strong>{count(selectedDay.cells.filter(cell => cell.MODIS && cell.VIIRS).length)}</strong></div>
              <div className="detail-foot"><a href={`https://worldview.earthdata.nasa.gov/?t=${selected}-T12:00:00Z&v=${mapBounds.join(',')}`} target="_blank" rel="noreferrer">Check imagery in NASA Worldview <ArrowUpRight size={13} /></a></div>
            </section>
          </aside>
        </div>
        {!importedFiles && !outsideDemo && <section className="card history-card" aria-labelledby="history-title">
          <div className="card-head"><h2 id="history-title"><Activity size={18} /> {format(`${month}-01`, { month: 'long' })} across years</h2><span className="micro">CELL-DAYS</span></div>
          <div className="history-bars">{history.map(item => <button key={item.month} aria-pressed={item.month === month} aria-label={`${isoMonth(item.month)}, ${item.total} occupied cell-days`} onClick={() => chooseMonth(item.month)}>
            <strong>{count(item.total)}</strong><span className="bar-track"><i style={{ height: `${item.total / historyPeak * 100}%` }} /></span><span>{item.month.slice(0, 4)}</span>
          </button>)}</div>
        </section>}
      </>}
      <footer><span><Database size={14} /> Data <a href={archive} target="_blank" rel="noreferrer">NASA FIRMS</a><i /> Historical UTC detections</span><a href={challenge} target="_blank" rel="noreferrer">NASA Space Apps Challenge 2026 <ArrowUpRight size={13} /></a></footer>
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
      <p>Shared means both sensors detected activity in the same cell on the same UTC day. Satellite overpasses can occur hours apart. Raw detection counts for {longDay(selected)} are shown below.</p><SensorRows day={selectedDay} />
    </Modal>}
    {dialog === 'method' && <Modal title="How Fire Atlas harmonizes hotspots" onClose={() => setDialog(undefined)}>
      <div className="method-content"><h3>1. Filter observations</h3><p>Keep MODIS confidence ≥30 and VIIRS nominal or high confidence. If the FIRMS type field is supplied, retain presumed vegetation fires (type 0) and rows with unspecified type.</p>
        <h3>2. Use a common grid and date</h3><p>Assign each detection center to a 5 × 5 km equal-area grid cell and UTC day. Each sensor counts a cell once on that day. Combined takes the union. Monthly totals sum these daily occupied cells.</p>
        <h3>3. Compare with seasonal history</h3><p>Compare the selected month against the median of the same month in at least three earlier archive years. The displayed rank counts earlier years with lower totals. An imported dataset has unverified coverage, so its anomaly indicator is disabled.</p>
        <h3>Interpret the counts</h3><p>Zero means no retained detections. Coverage can vary with overpasses, cloud and instrument sensitivity. Occupied cells describe detected activity. Fire extent, incident counts and hazard forecasts require other data.</p>
        <p><a href={firms} target="_blank" rel="noreferrer">NASA FIRMS resources</a> · <a href={firmsAttributes} target="_blank" rel="noreferrer">FIRMS data fields</a> · <a href="/fire-atlas/api/fire-atlas/provenance" target="_blank" rel="noreferrer">Archive provenance</a></p></div>
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
