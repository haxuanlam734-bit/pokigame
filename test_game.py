import asyncio
import sys
import io
from playwright.async_api import async_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

async def test_game():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1280, 'height': 720})
        
        console_logs = []
        page.on('console', lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on('pageerror', lambda err: console_logs.append(f"[PAGEERROR] {err}"))
        
        print("Navigating to game...")
        await page.goto('http://localhost:8000/', wait_until='domcontentloaded', timeout=30000)
        
        print("Waiting for game to initialize...")
        await page.wait_for_timeout(4000)
        
        print("\n=== Console Logs (last 60) ===")
        for log in console_logs[-60:]:
            print(log)
        
        errors = [l for l in console_logs if 'error' in l.lower() or 'TypeError' in l or 'ReferenceError' in l or 'SyntaxError' in l]
        if errors:
            print("\n=== ERRORS FOUND ===")
            for e in errors:
                print(e)
        else:
            print("\nNo JS runtime errors found!")
        
        print("\nTaking initial screenshot...")
        await page.screenshot(path='E:/pokigame/screenshot_clouds_initial.png')
        
        print("Waiting 8s for time cycle...")
        await page.wait_for_timeout(8000)
        
        await page.screenshot(path='E:/pokigame/screenshot_clouds_8s.png')
        
        print("\nDone!")
        await browser.close()

asyncio.run(test_game())
