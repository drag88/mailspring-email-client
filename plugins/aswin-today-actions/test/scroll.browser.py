"""Run with Python Playwright and an installed Google Chrome."""
import re
import json
import subprocess
from pathlib import Path

from playwright.sync_api import sync_playwright

styles = (Path(__file__).resolve().parents[1] / "styles/today-actions.less").read_text()
rules = "\n".join(re.search(r"\." + name + r"\s*\{[^}]+\}", styles)[0]
                  for name in ("taa-scroll", "taa-event-viewport"))
component = (Path(__file__).resolve().parents[1] / "lib/main.js").read_text()
expression = re.search(r"className: 'taa-event-viewport', style: (.+?), role: 'region'", component)[1]
inline = json.loads(subprocess.check_output([
    "node", "-e", "process.stdout.write(JSON.stringify(require('vm').runInNewContext('('+process.argv[1]+')', {display:{height:720}})))",
    expression], text=True))
viewport_style = ";".join(f"{css}:{inline[key]}{'px' if isinstance(inline[key], (int, float)) else ''}"
                          for key, css in (("height", "height"), ("maxHeight", "max-height")) if key in inline)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel="chrome", headless=True)
    try:
        page = browser.new_page(viewport={"width": 480, "height": 600})

        def fixture(count):
            page.set_content("<style>body{margin:0}.taa-pane{height:100vh;display:flex;flex-direction:column}"
                             "header{height:100px;flex-shrink:0}footer{height:24px;flex-shrink:0}"
                             + rules + "</style><aside class='taa-pane'><header>Today + Actions</header>"
                             "<div class='taa-scroll'><div style='height:200px'>Calendar</div>"
                             f"<div class='taa-event-viewport' style='{viewport_style}'>"
                             + "<div style='height:70px'>Meeting</div>" * count
                             + "</div><section style='height:300px'>Actions</section></div>"
                             "<footer>Saved locally</footer></aside>")
            page.evaluate("window.panel = document.querySelector('.taa-scroll');"
                          "window.meetings = document.querySelector('.taa-event-viewport'); panel.scrollTop = 150")

        def wheel(amount, condition):
            page.mouse.move(200, 200)
            page.mouse.wheel(0, amount)
            page.wait_for_function(condition, timeout=3000)

        fixture(0)
        assert page.locator('.taa-event-viewport').bounding_box()['height'] == 0, "Empty meetings must not reserve space"
        fixture(1)
        assert page.locator('.taa-event-viewport').bounding_box()['height'] == 70, "One meeting must use only its own height"
        fixture(2)
        assert page.locator('.taa-event-viewport').bounding_box()['height'] == 140, "Short lists must grow with their contents"
        assert page.locator('section').bounding_box()['y'] + 48 < page.locator('footer').bounding_box()['y'], "Actions must be visible after a short list"
        wheel(300, "panel.scrollTop > 150")
        assert page.evaluate("panel.scrollTop > 150"), "Short lists must allow scrolling down to Actions"
        bottom = page.evaluate("panel.scrollTop = panel.scrollHeight; panel.scrollTop")
        wheel(-200, f"panel.scrollTop < {bottom}")
        assert page.evaluate(f"panel.scrollTop < {bottom}"), "Short lists must allow scrolling back to the calendar"
        fixture(15)
        assert page.locator('.taa-event-viewport').bounding_box()['height'] <= 210, "Busy days must leave room for Actions"
        wheel(200, "meetings.scrollTop > 0")
        assert page.evaluate("panel.scrollTop === 150"), "Long lists must scroll internally first"
        page.evaluate("meetings.scrollTop = meetings.scrollHeight")
        wheel(200, "panel.scrollTop > 150")
        assert page.evaluate("panel.scrollTop > 150"), "The end of a long list must pass scrolling to Actions"
        page.evaluate("panel.scrollTop = 150; meetings.scrollTop = 0")
        wheel(-200, "panel.scrollTop < 150")
        assert page.evaluate("panel.scrollTop < 150"), "The start of a long list must pass scrolling to the calendar"
        page.set_viewport_size({"width": 480, "height": 400})
        assert page.locator('.taa-event-viewport').bounding_box()['height'] <= 140, "Meetings must shrink with the window"
        print("6 dynamic-height and 5 real-browser scrolling checks passed.")
    finally:
        browser.close()
