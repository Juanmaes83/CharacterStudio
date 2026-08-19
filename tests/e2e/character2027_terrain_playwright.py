from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:5174/e2e-terrain.html"
SCREENSHOT = Path("artifacts/character2027-terrain-playwright.png")


def main():
    SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
    console_errors = []
    page_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: page_errors.append(str(exc)))
        page.goto(BASE_URL, wait_until="networkidle")
        page.locator('#result[data-status="pass"]').wait_for(timeout=15000)
        runtime = page.evaluate("window.__CHARACTER2027_TERRAIN_E2E__")
        assert runtime and runtime["pass"], runtime
        assert not console_errors, f"console errors: {console_errors}"
        assert not page_errors, f"page errors: {page_errors}"
        page.screenshot(path=str(SCREENSHOT), full_page=True)
        browser.close()


if __name__ == "__main__":
    main()
