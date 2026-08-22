import asyncio
import sys
import io
import os
from playwright.async_api import async_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

async def test_clouds():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1280, 'height': 720})
        
        console_logs = []
        page.on('console', lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on('pageerror', lambda err: console_logs.append(f"[PAGEERROR] {err}"))
        
        print("Navigating...")
        await page.goto('http://localhost:8000/', wait_until='domcontentloaded', timeout=30000)
        await page.wait_for_timeout(3000)
        
        phases = ['day', 'sunset', 'night', 'dawn']
        for phase in phases:
            print(f"--- Phase: {phase} ---")
            await page.evaluate(f"""() => {{
                if (typeof TimeCycle !== 'undefined') {{
                    TimeCycle.forcePhase('{phase}');
                }}
            }}""")
            await page.wait_for_timeout(1500)
            filename = f'screenshot_final_{phase}.png'
            await page.screenshot(path=filename)
            print(f"Saved {filename} (exists: {os.path.exists(filename)})")
        
        print("\n=== Recent Console Logs ===")
        for log in console_logs[-20:]:
            print(log)
        
        errors = [l for l in console_logs if 'TypeError' in l or 'ReferenceError' in l or 'SyntaxError' in l]
        if errors:
            print("\n=== ERRORS ===")
            for e in errors:
                print(e)
        else:
            print("\nNo JS errors!")
        
        await browser.close()

asyncio.run(test_clouds())
