"""Barra de navegación común de Tazón para Dos: une los sitios, los editores y los kits de marca.

Inserta (o actualiza) la misma barra al principio del <body> de cada página, entre las marcas
<!--tpd-eco--> y <!--/tpd-eco-->. Es idempotente: vuelve a ejecutarlo cada vez que se regenere
una de estas páginas (editores, historias, divisores, kits).

    python -I navegacion.py            # actualiza todas las páginas conocidas
"""
import re
import sys
from pathlib import Path

SITIO = "https://thetrashkat.github.io"
ENLACES = [
    ("inicio", "Inicio", f"{SITIO}/historias-tazon/"),
    ("historias", "Editor de historias", f"{SITIO}/historias-tazon/editor/"),
    ("pancartas", "Editor de pancartas", f"{SITIO}/historias-tazon/editor/pancarta.html"),
    ("leer", "Historias", f"{SITIO}/historias-tazon/#historias"),
    ("marca", "Marca", f"{SITIO}/tazon-para-dos-marca/"),
    ("divisores", "Divisores", f"{SITIO}/tazon-para-dos-marca/divisores.html"),
    ("tinieblas", "Tinieblas", f"{SITIO}/tazon-para-dos-tinieblas/"),
    ("biblioteca", "Biblioteca", f"{SITIO}/biblioteca-aventuras/"),
    ("web", "Web Tazón", f"{SITIO}/tazon-para-dos-web/"),
]
# Las dos herramientas son hermanas: entre ellas se enlazan en relativo para que también funcionen sin internet.
RELATIVOS = {"historias": {"pancartas": "pancarta.html", "historias": "index.html"},
             "pancartas": {"historias": "index.html", "pancartas": "pancarta.html"}}

CSS = (".tpd-eco{position:relative;z-index:40;display:flex;align-items:center;gap:4px;overflow-x:auto;scrollbar-width:none;"
       "background:#110D18;border-bottom:2px solid #F8CB67;padding:5px 12px;font:500 11px/1.2 'DM Mono',ui-monospace,monospace;"
       "letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}"
       ".tpd-eco::-webkit-scrollbar{display:none}"
       ".tpd-eco b{color:#F8CB67;font:700 12px 'Space Grotesk',system-ui,sans-serif;letter-spacing:.04em;margin-right:8px}"
       ".tpd-eco a{color:#F7F2E8;text-decoration:none;padding:4px 9px;border-radius:999px;flex:none}"
       ".tpd-eco a:hover,.tpd-eco a:focus-visible{background:#2B2340;outline:none}"
       ".tpd-eco a[aria-current=page]{background:#F8CB67;color:#28203B}"
       "@media print{.tpd-eco{display:none!important}}")

PAGINAS = [  # (archivo, clave actual)
    (r"D:\historias-tazon\index.html", "inicio"),
    (r"D:\herramientas\pdf-historias\editor\editor.src.html", "historias"),
    (r"D:\herramientas\pdf-historias\editor\pancarta.src.html", "pancartas"),
    (r"D:\tazon-para-dos-marca\index.html", "marca"),
    (r"D:\tazon-para-dos-marca\divisores.html", "divisores"),
    (r"D:\tazon-para-dos-tinieblas\index.html", "tinieblas"),
    (r"D:\biblioteca-aventuras\index.html", "biblioteca"),
] + [(str(p), "leer") for p in Path(r"D:\historias-tazon").glob("*/*/index.html") if "plantilla" not in p.parts] \
  + [(str(p), "leer") for p in Path(r"D:\historias-tazon").glob("*/tinieblas/index.html")]


def barra(actual):
    rel = RELATIVOS.get(actual, {})
    items = "".join(
        f'<a href="{rel.get(k, url)}"' + (' aria-current="page"' if k == actual else "") + f">{texto}</a>"
        for k, texto, url in ENLACES)
    return (f'<!--tpd-eco--><style>{CSS}</style><nav class="tpd-eco" aria-label="Tazón para Dos: sitios y herramientas">'
            f'<b>TAZÓN PARA DOS</b>{items}</nav><!--/tpd-eco-->')


def insertar(html, actual):
    nuevo = barra(actual)
    if "<!--tpd-eco-->" in html:
        return re.sub(r"<!--tpd-eco-->.*?<!--/tpd-eco-->", lambda m: nuevo, html, count=1, flags=re.S)
    m = re.search(r"<body[^>]*>", html)
    if not m:
        raise ValueError("sin <body>")
    return html[:m.end()] + nuevo + html[m.end():]


def main(rutas=None):
    hechas = 0
    for ruta, actual in rutas or PAGINAS:
        p = Path(ruta)
        if not p.exists():
            continue
        antes = p.read_text(encoding="utf-8")
        despues = insertar(antes, actual)
        if despues != antes:
            p.write_text(despues, encoding="utf-8")
        hechas += 1
    print(f"Barra de navegación en {hechas} páginas")


if __name__ == "__main__":
    main([(a, b) for a, b in (x.split("=") for x in sys.argv[1:])] or None)
