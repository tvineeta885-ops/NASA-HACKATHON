"""Check globe motion, the flight to the regional map, and WebGL fallback."""
import os
import sys

from playwright.sync_api import expect, sync_playwright

base = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000').rstrip('/')
executable = os.getenv('FIRE_ATLAS_CHROMIUM')

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True, executable_path=executable, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    )
    page = browser.new_page(viewport={'width': 1280, 'height': 900}, reduced_motion='reduce')
    page.goto(base + '/', timeout=30000)
    earth = page.locator('.earth-stage')
    expect(earth).to_have_attribute('data-renderer', 'webgl', timeout=20000)
    page.get_by_role('button', name='Combined', exact=True).click()
    expect(earth).to_have_attribute('data-points', '118')
    expect(page.get_by_role('button', name='Pause Earth rotation')).to_have_count(0)

    canvas = page.locator('.earth-canvas canvas')
    before = canvas.screenshot()
    canvas.focus()
    canvas.press('ArrowRight')
    canvas.blur()
    assert canvas.screenshot() != before, 'Keyboard rotation did not change the globe'
    page.get_by_role('button', name='Locate area').click()
    assert canvas.screenshot() != before, 'Centering on the selected area did not move the globe'
    page.get_by_role('button', name='Zoom to hotspots').click()
    regional_map = page.get_by_role('region', name='Hotspot map')
    expect(regional_map).to_be_focused()
    expect(regional_map).to_be_in_viewport()

    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    page.goto(base + '/', timeout=30000)
    expect(page.locator('.earth-stage')).to_have_attribute('data-renderer', 'webgl', timeout=20000)
    canvas = page.locator('.earth-canvas canvas')
    before = canvas.screenshot()
    page.wait_for_function('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    assert canvas.screenshot() != before, 'The globe should rotate on initial load'
    page.get_by_role('button', name='Pause Earth rotation').click()
    expect(page.get_by_role('button', name='Play Earth rotation')).to_be_visible()
    page.get_by_role('button', name='Play Earth rotation').click()
    expect(page.get_by_role('button', name='Pause Earth rotation')).to_be_visible()
    page.get_by_role('button', name='Locate area').click()
    expect(page.get_by_role('button', name='Play Earth rotation')).to_be_visible()
    page.get_by_role('button', name='Zoom to hotspots').click()
    regional_map = page.get_by_role('region', name='Hotspot map')
    expect(regional_map).not_to_be_focused(timeout=300)
    expect(regional_map).to_be_focused(timeout=5000)
    expect(regional_map).to_be_in_viewport()
    browser.close()

    browser = playwright.chromium.launch(headless=True, executable_path=executable, args=['--disable-webgl'])
    fallback = browser.new_page()
    fallback.goto(base + '/', timeout=30000)
    expect(fallback.locator('.earth-stage')).to_have_attribute('data-renderer', 'fallback')
    expect(fallback.locator('.earth-placeholder')).to_be_visible()
    fallback.get_by_role('button', name='Combined', exact=True).click()
    expect(fallback.locator('.map-dot')).to_have_count(118)
    assert fallback.locator('.earth-canvas canvas').count() == 0
    fallback.get_by_role('button', name='Zoom to hotspots').click()
    expect(fallback.get_by_role('region', name='Hotspot map')).to_be_focused()
    browser.close()

print('Three.js auto-rotation, keyboard controls, regional flight, reduced motion and WebGL fallback passed.')
