"""Smoke test the FIRMS demo and a two-sensor import in Chromium."""
import csv
import os
import sys

from playwright.sync_api import expect, sync_playwright


base = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')
columns = 'latitude,longitude,acq_date,instrument,confidence,type\n'


def upload(page, sensor, rows):
    page.get_by_label(f'{sensor} CSV').set_input_files({
        'name': f'{sensor}.csv', 'mimeType': 'text/csv', 'buffer': (columns + rows).encode(),
    })


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=os.getenv('FIRE_ATLAS_CHROMIUM'))
    page = browser.new_page(viewport={'width': 1440, 'height': 960}, accept_downloads=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    api = base + '/fire-atlas/api/fire-atlas'
    assert page.request.get(api + '/health').json() == {'status': 'ok'}
    provenance = page.request.get(api + '/provenance').json()
    assert (provenance['start_year'], provenance['end_year'], len(provenance['files'])) == (2013, 2025, 26)
    archive = page.request.get(api + '/archive').json()
    assert len(archive['months']) == 156
    assert archive['monthly']['2025-08']['Combined']['comparison']['median'] == 203
    assert archive['agreement']['2025-08']['shared'] == 381
    assert page.request.get(api + '/archive?bounds=7,10,4,15').status == 400
    assert page.request.post(api + '/import', data='invalid').status == 415
    assert page.request.get(base + '/fire-atlas/backend/archive/modis.csv').status == 404
    page.goto(base + '/fire-atlas/', wait_until='networkidle', timeout=20000)
    expect(page.get_by_role('heading', name='August 2025')).to_be_visible()
    expect(page.locator('.metric-value').first).to_have_text('886')
    expect(page.locator('.earth-stage')).to_have_attribute('data-points', '118')
    expect(page.get_by_text('NASA FIRMS · 2013–2025')).to_be_visible()
    expect(page.locator('.map-dot')).to_have_count(118)
    expect(page.get_by_role('link', name='Check imagery in NASA Worldview')).to_have_attribute(
        'href', 'https://worldview.earthdata.nasa.gov/?t=2025-08-15-T12:00:00Z&v=-16,36.35,0,43.15')
    page.get_by_role('button', name='Aug 1, 20 occupied cells', exact=True).click()
    expect(page.locator('.map-dot')).to_have_count(20)
    expect(page.locator('.earth-stage')).to_have_attribute('data-points', '20')
    page.get_by_role('button', name='Zoom in', exact=True).click()
    expect(page.get_by_role('button', name='Zoom out', exact=True)).to_be_enabled()
    page.get_by_role('button', name='MODIS', exact=True).click()
    assert int(page.locator('.metric-value').first.inner_text().replace(',', '')) < 886
    page.get_by_role('button', name='Combined', exact=True).click()
    page.get_by_label('Area of interest').select_option(label='Northern Portugal')
    expect(page.get_by_label('Area of interest')).to_have_value('1')
    assert int(page.locator('.metric-value').first.inner_text().replace(',', '')) < 886
    page.get_by_label('Area of interest').select_option(label='Mainland Portugal')
    expect(page.locator('.metric-value').first).to_have_text('886')
    page.get_by_role('button', name='Compare sensors').click()
    expect(page.get_by_role('dialog')).to_contain_text('Combined cell-days')
    expect(page.get_by_role('dialog')).to_contain_text('43% of Combined activity')
    page.keyboard.press('Escape')
    expect(page.get_by_role('dialog')).to_have_count(0)
    page.get_by_role('button', name='Methodology').click()
    expect(page.get_by_role('dialog')).to_contain_text('equal-area grid')
    page.get_by_role('button', name='Close dialog').click()
    page.get_by_role('button', name='Previous month').click()
    expect(page.get_by_role('heading', name='July 2025')).to_be_visible()
    page.get_by_role('button', name='Next month').click()
    page.get_by_role('button', name='August 2024,').click()
    expect(page.get_by_role('heading', name='August 2024')).to_be_visible()
    page.get_by_label('Year', exact=True).select_option('2025')
    with page.expect_download() as download:
        page.get_by_role('button', name='Export month').click()
    assert download.value.suggested_filename == 'fire-atlas-2025-08.csv'
    with open(download.value.path(), encoding='utf-8', newline='') as exported:
        rows = list(csv.DictReader(exported))
    assert len(rows) == 31 and sum(int(row['combined_cells']) for row in rows) == 886
    assert sum(int(row['shared_cells']) for row in rows) == 381
    assert all(row['coverage'] == 'Observation coverage unknown' for row in rows)

    page.get_by_role('button', name='Set custom area').click()
    for label, value in [('West', '10'), ('South', '40'), ('East', '11'), ('North', '41')]:
        page.get_by_label(label, exact=True).fill(value)
    page.get_by_role('button', name='Apply area').click()
    expect(page.get_by_text('This area is outside the Portugal demo.', exact=False)).to_be_visible()
    expect(page.get_by_role('button', name='Export month')).to_be_disabled()
    expect(page.get_by_role('heading', name='Burning activity calendar')).to_have_count(0)
    page.get_by_label('Area of interest').select_option(label='Mainland Portugal')
    expect(page.get_by_role('heading', name='August 2025')).to_be_visible()

    page.get_by_role('button', name='Import CSV').click()
    upload(page, 'MODIS', '40.1,-8.1,2024-02-28,MODIS,80,0\n40.1,-8.1,2024-02-28,MODIS,95,0\n40.1,-8.1,2024-02-30,MODIS,90,0\n')
    upload(page, 'VIIRS', '40.1,-8.1,2024-03-01,VIIRS,h,0\n')
    page.get_by_role('button', name='Load observations').click()
    expect(page.get_by_role('dialog').get_by_role('alert')).to_contain_text('overlapping UTC month')
    upload(page, 'VIIRS', '40.1,-8.1,2024-02-28,VIIRS,h,0\n40.1,-8.1,2024-02-29,VIIRS,n,0\n40.1,-8.1,2024-02-27,VIIRS,l,0\n')
    page.get_by_role('button', name='Load observations').click()
    expect(page.get_by_role('heading', name='February 2024')).to_be_visible()
    expect(page.get_by_role('status')).to_contain_text('1 invalid rows skipped')
    expect(page.locator('.metric-value').first).to_have_text('2')
    expect(page.locator('.metric-value').nth(1)).to_contain_text('/ 29')
    expect(page.locator('.detail-foot strong')).to_have_text('1')
    expect(page.locator('.sensor-rows strong')).to_have_text(['2', '1'])
    page.get_by_role('button', name='Set custom area').click()
    for label, value in [('West', '-8.3'), ('South', '40'), ('East', '-8'), ('North', '40.2')]:
        page.get_by_label(label, exact=True).fill(value)
    page.get_by_role('button', name='Apply area').click()
    expect(page.get_by_label('Area of interest')).to_have_value('custom')
    expect(page.locator('.map-dot')).to_have_count(1)
    page.get_by_role('button', name='Restore Portugal demo').click()
    expect(page.get_by_role('heading', name='August 2025')).to_be_visible()

    for width in [320, 390, 768, 1440]:
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth === innerWidth'), f'Overflow at {width}px'
    assert not errors, errors
    print('Fire Atlas passed archive, calendar, map, export, reconciling sensors, import and responsive checks.')
    browser.close()
