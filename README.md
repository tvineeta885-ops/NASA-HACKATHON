# Fire Atlas frontend

The Next.js App Router frontend uses React and TypeScript to render the burning activity calendar, hotspot map, sensor comparison, and seasonal history. It sends filters and FIRMS CSV uploads to FastAPI and exports the returned daily results as CSV.

The Three.js scene uses NASA GIBS Blue Marble imagery and plots the selected day's FIRMS cells. A visible Sun lights the day side. The cloud layer drifts as Earth turns. This is an illustrative lighting scene; the Sun and clouds do not represent conditions on the selected date. Drag or use the arrow keys to take control, or use Play and Pause. **Locate area** centers the selected region. **Zoom to hotspots** flies in and brings the regional map into focus. Reduced-motion preferences skip auto-rotation and flights. A still Earth preview is available when WebGL is unavailable.

Night lights and the cloud mask are resized from the [Three.js Earth example](https://threejs.org/examples/webgpu_tsl_earth.html). The textures come from [Solar System Scope](https://www.solarsystemscope.com/textures/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Fire Atlas extracts the cloud channel from the original packed texture.

## Run locally

Use Node.js 22.12 or later. Start the [FastAPI backend](https://github.com/Anuvesh07/NSVI_backend#readme), then run these commands from this repository root.

```sh
npm ci
npm run dev
```

Open [Fire Atlas](http://127.0.0.1:3000/). In development, Next.js forwards API requests to `http://127.0.0.1:8787` by default. Set `FIRE_ATLAS_API_ORIGIN` in the frontend environment or `.env.local` if FastAPI runs at another origin.

## Deploy the frontend

In Vercel, select the **Next.js** framework preset and the repository root. Fire Atlas opens at `/` and existing `/fire-atlas` page links redirect there. Production builds use the [Railway FastAPI service](https://fire-atlas-api-production.up.railway.app/api/fire-atlas/docs) by default. For a different backend, set `FIRE_ATLAS_API_ORIGIN` to its origin before building and redeploy. The same settings apply when running `npm run build` and `npm start` locally.

## Where to work

- `app/` contains the Next.js route, layout, and page metadata. `explorer.tsx` owns the interactive UI and page state. `style.css` and `assets/` hold the styles, fonts, and basemaps.
- `api.ts` handles archive requests and multipart uploads. `contract.ts` defines the types for the JSON response from FastAPI. `data.ts` handles calendar formatting, sensor display, and CSV export.
- `earth.tsx` renders the globe. With the app running, `python test_earth.py http://127.0.0.1:3000` checks WebGL, keyboard rotation, reduced motion and the static fallback in Chromium.
- `test_explorer.py` verifies the UI and API together. With both processes running, run `python test_explorer.py http://127.0.0.1:3000`. The test requires Python Playwright and Chromium. Supply `FIRE_ATLAS_CHROMIUM` to use a specific executable.

The archive opens on mainland Portugal in August 2025. Select **Recent hotspots** to load NASA's near-real-time MODIS and NOAA-20 VIIRS downloads through FastAPI. The app shows each source and its latest acquisition time. Choose **Worldwide** or set custom bounds for another area. The recent calendar and CSV cover only the dates in the downloaded snapshot. You can also upload one FIRMS CSV per instrument with at least one overlapping month. [NASA FIRMS resources](https://www.earthdata.nasa.gov/data/tools/firms#links)

The data source, grid method, and coverage limits are documented in the [backend README](https://github.com/Anuvesh07/NSVI_backend#readme).

**Harmonized** is the default for the Portugal archive. It extends the calendar back to 2003, displays MODIS-equivalent cell-days, and shows raw source hotspots on the map. Select **Combined**, **MODIS**, or **VIIRS** to inspect the unadjusted overlap. The historical chart and harmonized CSV use the same calibrated series.
