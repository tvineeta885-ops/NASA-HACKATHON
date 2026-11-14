# Fire Atlas frontend

The Next.js App Router frontend uses React and TypeScript to render the burning activity calendar, hotspot map, sensor comparison, and seasonal history. It sends filters and FIRMS CSV uploads to FastAPI and exports the returned daily results as CSV.

## Run locally

Use Node.js 22.12 or later. Start the [FastAPI backend](https://github.com/Anuvesh07/NSVI_backend#readme), then run these commands from this repository root.

```sh
npm ci
npm run dev
```

Open [Fire Atlas](http://127.0.0.1:3000/fire-atlas). The Next.js server forwards API requests to `http://127.0.0.1:8787` by default. Set `FIRE_ATLAS_API_ORIGIN` in the frontend environment or `.env.local` if FastAPI runs at another origin. Set it before building for production.

Run `npm run build` and `npm start` from this repository root to run the production build alongside FastAPI.

## Where to work

- `app/` contains the Next.js route, layout, and page metadata. `explorer.tsx` owns the interactive UI and page state. `style.css` and `assets/` hold the styles, fonts, and basemaps.
- `api.ts` handles archive requests and multipart uploads. `contract.ts` defines the types for the JSON response from FastAPI. `data.ts` handles calendar formatting, sensor display, and CSV export.
- `test_explorer.py` verifies the UI and API together. With both processes running, run `python test_explorer.py http://127.0.0.1:3000`. The test requires Python Playwright and Chromium. Supply `FIRE_ATLAS_CHROMIUM` to use a specific executable.

The demo opens on mainland Portugal in August 2025. Compare both sensors, select another date or region, and export the month. For another area, upload one FIRMS CSV per instrument with at least one overlapping month. [NASA FIRMS resources](https://www.earthdata.nasa.gov/data/tools/firms#links)

The data source, grid method, and coverage limits are documented in the [backend README](https://github.com/Anuvesh07/NSVI_backend#readme).
