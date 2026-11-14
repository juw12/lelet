"""Browser test for Lelet. Run with:  python tests/e2e.py

Starts the rate-limited fake line (8 Mbps down / 2 Mbps up / 20 ms), opens the real app in a
headless Chromium at phone size and walks the whole path: plan -> test -> evidence -> letter.

The speed reading is given up to three attempts, and every attempt is printed. The machine this was
written on ran at 100 % CPU, which stalls any transfer now and then; a stalled attempt is reported,
not hidden.
"""
import json
import re
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

APP = Path(__file__).resolve().parent.parent
SHOTS = APP.parent / "shots"
LINE_DOWN = 8
LINE_UP = 2
TOLERANCE = 0.10
ATTEMPTS = 3

results = []


def check(name, passed, detail=""):
    results.append((name, bool(passed)))
    print(f"{'PASS' if passed else 'FAIL'}  {name}{'  -> ' + str(detail) if detail else ''}", flush=True)


def free_port():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def start_line(port):
    server = subprocess.Popen(
        ["node", "tests/fake_server.mjs", str(port), str(LINE_DOWN), str(LINE_UP), "20"],
        cwd=APP,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    first_line = server.stdout.readline()
    if "line:" not in first_line:
        raise RuntimeError(f"fake line did not start: {first_line!r}")
    return server


def stored(page):
    return json.loads(page.evaluate("localStorage.getItem('lelet.v1')") or "{}")


def no_sideways_scroll(page):
    return page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")


def shot(page, name):
    SHOTS.mkdir(exist_ok=True)
    # A toast stays up for 2.6 s; wait for it to go so it does not cover the page in the picture.
    page.locator("#toast.show").wait_for(state="hidden", timeout=6000)
    page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True)


def go(page, tab):
    page.evaluate(f"location.hash = '#{tab}'")
    page.wait_for_function(f"document.querySelector('#tabs a[aria-current=page]').getAttribute('href') === '#{tab}'")


def launch_browser(playwright):
    """Use Playwright's own Chromium when it is downloaded, otherwise an installed Edge or Chrome."""
    last_error = None
    for channel in (None, "msedge", "chrome"):
        try:
            options = {"args": ["--proxy-bypass-list=<-loopback>"]}
            if channel:
                options["channel"] = channel
            browser = playwright.chromium.launch(**options)
            print(f"browser: {channel or 'bundled chromium'} {browser.version}", flush=True)
            return browser
        except Exception as error:
            last_error = error
    raise RuntimeError(f"no browser could be started: {str(last_error).splitlines()[0]}")


def main():
    port = free_port()
    server = start_line(port)
    url = f"http://127.0.0.1:{port}/?server=http://127.0.0.1:{port}"
    problems = []

    try:
        with sync_playwright() as playwright:
            browser = launch_browser(playwright)

            def new_page(width, height):
                context = browser.new_context(viewport={"width": width, "height": height}, locale="id-ID")
                page = context.new_page()
                page.on("console", lambda message: problems.append(message.text) if message.type == "error" else None)
                page.on("pageerror", lambda error: problems.append(str(error)))
                page.on("dialog", lambda dialog: dialog.accept())
                page.goto(url)
                page.wait_for_selector("h1")
                return page

            # ---- first visit, phone size ----
            page = new_page(390, 844)
            check("first screen shows the Indonesian headline", "Buktikan" in page.inner_text("h1"))
            check("phone: no sideways scroll on Tes", no_sideways_scroll(page))
            check("one primary button on Tes", page.locator("#view .btn.primary").count() == 1)
            start_box = page.locator("[data-act=start]").bounding_box()
            tabs_top = page.locator("#tabs").bounding_box()["y"]
            check(
                "phone: start button is visible without scrolling",
                start_box["y"] + start_box["height"] <= tabs_top,
                f"button ends at {start_box['y'] + start_box['height']:.0f}px, tab bar starts at {tabs_top:.0f}px",
            )
            shot(page, "01-tes-kosong-id-terang")

            # cancel leaves nothing behind
            page.click("[data-act=start]")
            page.wait_for_selector("[data-act=cancel]")
            page.click("[data-act=cancel]")
            page.wait_for_selector("[data-act=start]", timeout=30000)
            check("cancelled test stores nothing", len(stored(page).get("tests", [])) == 0)
            check("cancelled test says so", "dibatalkan" in page.inner_text(".phase"))

            # plan typed right on the first screen
            page.fill("[data-plan=mbps]", "20")
            page.fill("[data-plan=price]", "300.000")
            check("price typed with dots is stored as digits", stored(page)["plan"]["price"] == "300000")

            reading = None
            for attempt in range(1, ATTEMPTS + 1):
                page.click("[data-act=start]")
                page.wait_for_selector("[data-act=cancel]")
                page.wait_for_selector("[data-act=start]", timeout=120000)
                tests = stored(page).get("tests", [])
                if not tests:
                    print(f"miss  attempt {attempt}: no result stored ({page.inner_text('#view')[:120]!r})", flush=True)
                    continue
                last = tests[-1]
                down_error = abs(last["down"] - LINE_DOWN) / LINE_DOWN
                up_error = abs(last["up"] - LINE_UP) / LINE_UP
                good = down_error <= TOLERANCE and up_error <= TOLERANCE
                print(
                    f"{'ok  ' if good else 'miss'}  attempt {attempt}: read {last['down']:.2f}/{last['up']:.2f} Mbps "
                    f"on a {LINE_DOWN}/{LINE_UP} line, {last['bytes'] / 1e6:.1f} MB, confidence {last['conf']}",
                    flush=True,
                )
                if good:
                    reading = last
                    break
                # start clean so the median on screen comes from one good reading
                page.evaluate(
                    "(() => { const s = JSON.parse(localStorage.getItem('lelet.v1')); s.tests = [];"
                    " localStorage.setItem('lelet.v1', JSON.stringify(s)); })()"
                )
                page.reload()
                page.wait_for_selector("h1")

            check(f"app reads the {LINE_DOWN}/{LINE_UP} Mbps line within 10 %", reading is not None)
            if reading is None:
                raise RuntimeError("no usable reading; the remaining checks need one")
            check("Saver test uses less than 15 MB", reading["bytes"] / 1e6 < 15, f"{reading['bytes'] / 1e6:.1f} MB")

            tes_text = page.inner_text("#view")
            check("verdict: far below plan", "Jauh di bawah paket" in tes_text)
            check("rupiah gap shown after the first test", re.search(r"Rp\s1[6-9]\d\.\d{3}", tes_text) is not None)
            check("evidence strength shown with a next step", "Berikutnya" in tes_text)
            check("still one primary button on Tes", page.locator("#view .btn.primary").count() == 1)
            check("letter is one tap away from the result", page.locator("#sec-verdict a[href='#surat']").count() == 1)
            check("phone: no sideways scroll after a test", no_sideways_scroll(page))
            shot(page, "02-tes-hasil-id-terang")

            # ---- Paket ----
            go(page, "paket")
            page.fill("[data-plan=provider]", "Contoh Fiber")
            page.fill("[data-plan=name]", "Home 20")
            page.fill("[data-plan=person]", "Budi Santoso")
            page.fill("[data-plan=city]", "Batam")
            plan = stored(page)["plan"]
            check("plan is saved as typed", plan["provider"] == "Contoh Fiber" and plan["mbps"] == "20" and plan["person"] == "Budi Santoso")
            check("one primary button on Paket", page.locator("#view .btn.primary").count() == 1)
            check("phone: no sideways scroll on Paket", no_sideways_scroll(page))
            shot(page, "03-paket-id-terang")

            # ---- Bukti ----
            go(page, "bukti")
            receipt = page.inner_text(".receipt")
            check("receipt names the provider and the plan", "Contoh Fiber" in receipt and "20 Mbps" in receipt)
            check("receipt carries the verdict stamp", "jauh di bawah paket" in page.text_content(".stamp").lower())
            check("one test = weak evidence", page.text_content(".level").strip().lower() == "lemah")
            check("one primary button on Bukti", page.locator("#view .btn.primary").count() == 1)
            check("phone: no sideways scroll on Bukti", no_sideways_scroll(page))
            shot(page, "04-bukti-id-terang")

            # ---- Surat ----
            go(page, "surat")
            letter = page.input_value("#letter-text")
            for part in ["Pasal 19", "Contoh Fiber", "20 Mbps", "Budi Santoso", "Batam", "Lampiran"]:
                check(f"letter contains '{part}'", part in letter)
            check("weak evidence is flagged above the letter", "Bukti masih lemah" in page.inner_text("#view"))
            check("one primary button on Surat", page.locator("#view .btn.primary").count() == 1)
            check("phone: no sideways scroll on Surat", no_sideways_scroll(page))
            shot(page, "05-surat-id-terang")

            # ---- after the letter is sent: the wait, then the second letter ----
            second_kind = "[data-act=kind][data-val=lanjut]"
            check("follow-up card is offered under the letter", page.locator("#follow #sent-date").count() == 1)
            check("no second letter before the first is marked sent", page.locator(second_kind).count() == 0)
            page.fill("#sent-ticket", "TKT-778")
            page.click("[data-act=sent]")
            page.wait_for_selector("#follow-status")
            saved_mark = stored(page).get("sent") or {}
            check("sent date and ticket are saved on the device", saved_mark.get("ticket") == "TKT-778" and saved_mark.get("at", 0) > 0, saved_mark)
            status_text = page.inner_text("#follow-status")
            check("the wait is counted in working days", "hari kerja" in status_text and "Tunggu 7" in status_text, status_text)
            check("second letter is offered once the first is marked sent", page.locator(second_kind).count() >= 1)
            check("still one primary button after marking sent", page.locator("#view .btn.primary").count() == 1)
            shot(page, "05b-surat-terkirim-id-terang")

            page.click(f"#follow {second_kind}")
            second = page.input_value("#letter-text")
            for part in ["Pengaduan lanjutan", "Komdigi", "nomor tiket TKT-778", "Contoh Fiber", "Pasal 19", "bukan pengukuran resmi"]:
                check(f"second letter contains '{part}'", part in second)
            check("sending the second letter early is flagged", "belum lewat" in page.inner_text("#view"))
            check("phone: no sideways scroll on the second letter", no_sideways_scroll(page))
            shot(page, "05c-surat-kedua-id-terang")

            page.evaluate(
                """() => {
                    const saved = JSON.parse(localStorage.getItem('lelet.v1'));
                    saved.sent.at = Date.now() - 20 * 24 * 60 * 60 * 1000;
                    localStorage.setItem('lelet.v1', JSON.stringify(saved));
                }"""
            )
            page.reload()
            page.wait_for_selector("#follow-status")
            overdue_text = page.inner_text("#follow-status")
            check("sent mark survives a reload", (stored(page).get("sent") or {}).get("ticket") == "TKT-778")
            check("after 7 working days the app says the wait is over", "sudah lewat" in overdue_text and page.locator("#follow-status.over").count() == 1, overdue_text)
            page.click(f"#follow {second_kind}")
            late = page.input_value("#letter-text")
            check("late second letter says the deadline has passed", "berakhir pada" in late and "baru berakhir" not in late)
            check("no early warning once the wait is over", "belum lewat" not in page.inner_text("#view"))
            shot(page, "05d-surat-kedua-lewat-id-terang")

            page.click("[data-act=unsent]")
            page.wait_for_selector("#sent-date")
            check("removing the sent mark clears it and hides the second letter", stored(page).get("sent") is None and page.locator(second_kind).count() == 0)
            check("letter returns to the first complaint", "Pengaduan lanjutan" not in page.input_value("#letter-text"))

            page.click("#lang-btn")
            check("English letter cites Article 19", "Article 19" in page.input_value("#letter-text"))
            check("page language switches to en", page.evaluate("document.documentElement.lang") == "en")
            shot(page, "06-surat-en-terang")

            page.click("[data-act=kind][data-val=wa]")
            message = page.input_value("#letter-text")
            link = page.get_attribute("#wa-link", "href")
            check("WhatsApp message is short", len(message) < 700, len(message))
            check("English uses the singular for one test", "1 test on 1 day " in message, message[60:140])
            check("WhatsApp link carries the message", link.startswith("https://wa.me/?text=") and "Contoh%20Fiber" in link)
            page.fill("#letter-text", "pesan saya")
            check("edited text goes into the WhatsApp link", page.get_attribute("#wa-link", "href").endswith("pesan%20saya"))
            page.click("[data-act=reset]")
            check("reset brings the generated text back", "Contoh Fiber" in page.input_value("#letter-text"))

            page.click("#theme-btn")
            check("theme button switches to dark", page.evaluate("document.documentElement.dataset.theme") == "dark")
            shot(page, "07-surat-wa-en-gelap")
            page.click("#lang-btn")
            go(page, "tes")
            shot(page, "08-tes-hasil-id-gelap")
            page.reload()
            page.wait_for_selector("h1")
            check("theme and data survive a reload", page.evaluate("document.documentElement.dataset.theme") == "dark" and len(stored(page)["tests"]) == 1)

            go(page, "bukti")
            page.click("[data-act=del]")
            check("deleting the only test empties the evidence", len(stored(page)["tests"]) == 0 and page.locator(".receipt").count() == 0)

            # ---- sample data, fresh visitor, desktop size ----
            desk = new_page(1280, 800)
            check("desktop: no sideways scroll on Tes", no_sideways_scroll(desk))
            go(desk, "bukti")
            desk.click("[data-act=sample]")
            desk.wait_for_selector(".receipt")
            sample_receipt = desk.inner_text(".receipt")
            check("sample receipt is marked as a sample", "CONTOH" in sample_receipt and "Contoh Net" in sample_receipt)
            check("sample evidence is strong", desk.text_content(".level").strip().lower() == "kuat")
            check("sample tests are flagged in storage", all(item["sample"] for item in stored(desk)["tests"]))
            check("desktop: no sideways scroll on Bukti", no_sideways_scroll(desk))
            shot(desk, "09-bukti-contoh-desktop")
            go(desk, "surat")
            check("sample letter is tagged, with a do-not-send warning", desk.input_value("#letter-text").startswith("[CONTOH") and "Jangan dikirim" in desk.inner_text("#view"))
            check("sample data never gets a sent mark or a second letter", desk.locator("#follow").count() == 0)
            shot(desk, "10-surat-contoh-desktop")
            go(desk, "tes")
            shot(desk, "11-tes-contoh-desktop")
            go(desk, "bukti")
            desk.click("[data-act=sample-remove]")
            after = stored(desk)
            check("removing the sample leaves no tests and no sample plan", after["tests"] == [] and after["plan"]["provider"] == "")

            browser.close()
    finally:
        server.terminate()

    check("no console errors, page errors or CSP violations", not problems, problems[:3])
    failed = [name for name, passed in results if not passed]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed", flush=True)
    if failed:
        print("FAILED: " + "; ".join(failed), flush=True)
        return 1
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:  # a crash is a failure, with the reason on the last line
        print(f"FAIL  e2e stopped early: {error}", flush=True)
        sys.exit(1)
