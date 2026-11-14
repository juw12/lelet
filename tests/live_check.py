"""Check the published Lelet page with a real test.  Run with:  python tests/live_check.py [url]

Opens the live page in a headless browser at phone size, runs one "Hemat" test against the real
measurement server and prints what it read. This is a smoke test of the published site, not an
accuracy test: the true speed of the line it runs on is unknown.

Set HTTPS_PROXY when the machine reaches the internet through a proxy.
"""
import json
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "https://juw12.github.io/lelet/"
SHOT = Path(__file__).resolve().parent.parent.parent / "shots" / "live-hemat.png"
MAX_SECONDS = 20
MAX_MEGABYTES = 15

failures = []


def check(name, passed, detail=""):
    if not passed:
        failures.append(name)
    print(f"{'PASS' if passed else 'FAIL'}  {name}{'  -> ' + str(detail) if detail else ''}", flush=True)


def launch_browser(playwright):
    options = {}
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if proxy:
        options["proxy"] = {"server": proxy}
    last_error = None
    for channel in (None, "msedge", "chrome"):
        try:
            if channel:
                options["channel"] = channel
            browser = playwright.chromium.launch(**options)
            print(f"browser: {channel or 'bundled chromium'} {browser.version}", flush=True)
            return browser
        except Exception as error:
            last_error = error
    raise RuntimeError(f"no browser could be started: {str(last_error).splitlines()[0]}")


def main():
    problems = []
    with sync_playwright() as playwright:
        browser = launch_browser(playwright)
        context = browser.new_context(viewport={"width": 390, "height": 844}, locale="id-ID")
        page = context.new_page()
        page.on("console", lambda message: problems.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: problems.append(str(error)))

        response = page.goto(URL, wait_until="domcontentloaded", timeout=60000)
        check("page answers 200", response is not None and response.status == 200, response and response.status)
        page.wait_for_selector("h1", timeout=30000)
        check("headline is shown", "Buktikan" in page.inner_text("h1"), page.inner_text("h1"))

        started = time.monotonic()
        page.click("[data-act=start]")
        page.wait_for_selector("[data-act=cancel]", timeout=15000)
        page.wait_for_selector("[data-act=start]", timeout=90000)
        seconds = time.monotonic() - started

        stored = json.loads(page.evaluate("localStorage.getItem('lelet.v1')") or "{}")
        tests = stored.get("tests", [])
        check("a result was stored", len(tests) == 1, page.inner_text("#view")[:160] if not tests else "")
        if tests:
            last = tests[-1]
            megabytes = last["bytes"] / 1e6
            print(
                f"read {last['down']:.2f} Mbps down, {last['up']:.2f} Mbps up, {last['ping']:.0f} ms latency, "
                f"{megabytes:.1f} MB used, {seconds:.1f} s, confidence {last['conf']}",
                flush=True,
            )
            check("download and upload are above zero", last["down"] > 0 and last["up"] > 0)
            check(f"test took under {MAX_SECONDS} s", seconds < MAX_SECONDS, f"{seconds:.1f} s")
            check(f"test used under {MAX_MEGABYTES} MB", megabytes < MAX_MEGABYTES, f"{megabytes:.1f} MB")

        if URL.startswith("https://"):
            try:
                page.wait_for_function("navigator.serviceWorker.getRegistration().then((r) => !!r)", timeout=15000)
                registered = True
            except Exception:
                registered = False
            check("service worker is registered (works offline after the first visit)", registered)

        SHOT.parent.mkdir(exist_ok=True)
        page.screenshot(path=str(SHOT), full_page=True)
        check("no console errors, page errors or CSP violations", not problems, problems[:3])
        browser.close()

    print(f"\n{'all checks passed' if not failures else str(len(failures)) + ' check(s) failed'}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
