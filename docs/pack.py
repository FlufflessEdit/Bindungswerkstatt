import re
from pathlib import Path

# ------------------------------------------------------------
# Einstellungen
# ------------------------------------------------------------

BASE_DIR = Path(__file__).parent
INPUT_FILE = BASE_DIR / "index.html"
OUTPUT_FILE = BASE_DIR / "standalone.html"


# ------------------------------------------------------------
# Dateien einlesen
# ------------------------------------------------------------

html = INPUT_FILE.read_text(encoding="utf-8")


# ------------------------------------------------------------
# CSS-Dateien einbetten
# ------------------------------------------------------------

css_pattern = re.compile(
    r'<link\b[^>]*\bhref=["\']([^"\']+\.css(?:\?[^"\']*)?)["\'][^>]*>',
    re.IGNORECASE
)


def replace_css(match):
    href = match.group(1)

    # Externe URLs nicht anfassen
    if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*://', href):
        return match.group(0)

    css_path = (INPUT_FILE.parent / href.split("?")[0]).resolve()

    if not css_path.is_file():
        print(f"[WARNUNG] CSS nicht gefunden: {href}")
        return match.group(0)

    css = css_path.read_text(encoding="utf-8")

    return (
        f"\n<!-- BEGIN {href} -->\n"
        f"<style>\n"
        f"{css}\n"
        f"</style>\n"
        f"<!-- END {href} -->\n"
    )


html = css_pattern.sub(replace_css, html)


# ------------------------------------------------------------
# JavaScript-Dateien einbetten
# ------------------------------------------------------------

js_pattern = re.compile(
    r'<script\b([^>]*)\bsrc=["\']([^"\']+\.js(?:\?[^"\']*)?)["\']([^>]*)>\s*</script>',
    re.IGNORECASE
)


def replace_js(match):
    before = match.group(1)
    src = match.group(2)
    after = match.group(3)

    # Externe URLs nicht anfassen
    if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*://', src):
        return match.group(0)

    js_path = (INPUT_FILE.parent / src.split("?")[0]).resolve()

    if not js_path.is_file():
        print(f"[WARNUNG] JavaScript nicht gefunden: {src}")
        return match.group(0)

    js = js_path.read_text(encoding="utf-8")

    # src entfernen, andere Attribute wie defer/async/type behalten
    attributes = before + after

    attributes = re.sub(
        r'\s+src\s*=\s*["\'][^"\']*["\']',
        "",
        attributes,
        flags=re.IGNORECASE
    )

    return (
        f"\n<!-- BEGIN {src} -->\n"
        f"<script{attributes}>\n"
        f"{js}\n"
        f"</script>\n"
        f"<!-- END {src} -->\n"
    )


html = js_pattern.sub(replace_js, html)


# ------------------------------------------------------------
# Ergebnis speichern
# ------------------------------------------------------------

OUTPUT_FILE.write_text(html, encoding="utf-8")

print()
print("Fertig.")
print(f"Eingabe : {INPUT_FILE}")
print(f"Ausgabe : {OUTPUT_FILE}")
print()