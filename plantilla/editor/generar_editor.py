"""Genera los editores visuales de Tazón para Dos, cada uno en un solo HTML autocontenido:

  editor/index.html     editor de historias (pegar texto + imágenes -> plantilla HTML/PDF)
  editor/pancarta.html  editor de pancartas (roll-up, pendón, pancarta horizontal, afiche)

Ambos comparten comun.js y reúnen el CSS del maquetador (mismo estilo que maquetar.py), las fuentes,
las piezas de marca, los íconos, los temas Tinieblas y algunas ilustraciones de ejemplo. Volver a
ejecutarlo cuando cambie maquetar.py, la marca o los temas:

    python -I editor/generar_editor.py
"""
import base64
import json
import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
HERRAMIENTA = AQUI.parent
sys.path.insert(0, str(HERRAMIENTA))
import maquetar as M  # noqa: E402

TINIEBLAS = Path(r"D:\tazon-para-dos-tinieblas")
MARCA_KIT = Path(r"D:\tazon-para-dos-marca")
FUENTES_CAMPANA = MARCA_KIT / "tools" / "fonts"
ILUSTRACIONES = [Path(r"D:\historias\mitos-engativa\imagenes"), Path(r"D:\historias\mago-la-ascension\imagenes")]
MAX_ILUS = 40_000  # bytes: solo las ilustraciones ligeras entran como ejemplo


def data_uri(p, mime):
    return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()


def main():
    completo = M.CSS.format(
        fuentes="__FUENTES__", ink=M.INK, teal=M.TEAL, coral=M.CORAL, sun=M.SUN, cream=M.CREAM, paper=M.PAPER,
        muted=M.MUTED, triangulo=M.TRIANGULO, hexagono=M.HEXAGONO, destello=M.DESTELLO, divisor=M.DIVISOR,
        corte=M.CORTE_BANNER, puntos=M.PUNTOS, puntos_claros=M.PUNTOS_CLAROS,
        cab_izq='"__CAB_IZQ__"', cab_der='"__CAB_DER__"', pie='"__PIE__"', nombradas=M.paginas_nombradas()) + M.DIVISORES_CSS
    corte = completo.index(":root{")
    web = M.WEB_CSS.format(ink=M.INK, teal=M.TEAL, coral=M.CORAL, sun=M.SUN, cream=M.CREAM, paper=M.PAPER,
                           muted=M.MUTED, puntos=M.PUNTOS)

    fuentes = {f.name: data_uri(f, "font/ttf") for f in sorted(M.FUENTES.glob("*.ttf")) if "-VF" not in f.name}
    marca = {p.stem: data_uri(p, "image/svg+xml") for p in sorted(M.MARCA.glob("*.svg"))}
    if (TINIEBLAS / "assets" / "elementos").exists():
        for p in sorted((TINIEBLAS / "assets" / "elementos").glob("*.svg")):
            marca["tinieblas-" + p.stem] = data_uri(p, "image/svg+xml")
    vistos = set()
    for carpeta in ILUSTRACIONES:
        for p in sorted(carpeta.glob("*.svg")) if carpeta.exists() else []:
            nombre = "ilus-" + (p.stem if p.stem not in vistos else carpeta.parent.name.split("-")[0] + "-" + p.stem)
            if p.stat().st_size <= MAX_ILUS:
                marca[nombre] = data_uri(p, "image/svg+xml")
                vistos.add(p.stem)
    temas = {}
    for clave, nombre in (("tinieblas", "tema-tinieblas.css"), ("pergamino", "tema-tinieblas-pergamino.css")):
        if (TINIEBLAS / nombre).exists():
            temas[clave] = (TINIEBLAS / nombre).read_text(encoding="utf-8")

    R = {"fontcss": completo[:corte], "css": completo[corte:], "webcss": web, "fuentes": fuentes,
         "marca": marca, "temas": temas, "colores": M.COLORES,
         "divisores": sorted(M.DIVISORES)}
    # Para el editor de pancartas: tipografía de campaña (Barlow), íconos de línea y logos Tinieblas
    campana = {f.name: data_uri(f, "font/ttf") for f in sorted(FUENTES_CAMPANA.glob("*.ttf"))} if FUENTES_CAMPANA.exists() else {}
    iconos = {}
    for carpeta, prefijo in ((MARCA_KIT / "assets" / "iconos", ""), (TINIEBLAS / "assets" / "iconos", "tinieblas-")):
        for p in sorted(carpeta.glob("*.svg")) if carpeta.exists() else []:
            if p.stem == "sprite":
                continue
            interior = re.sub(r"<title>.*?</title>", "", re.search(r"<svg[^>]*>(.*)</svg>", p.read_text(encoding="utf-8"), re.S).group(1), flags=re.S)
            iconos[prefijo + p.stem] = interior.strip()
    for p in sorted((TINIEBLAS / "assets" / "logo").glob("*.svg")) if (TINIEBLAS / "assets" / "logo").exists() else []:
        marca["logo-" + p.stem] = data_uri(p, "image/svg+xml")
    R.update(campana=campana, iconos=iconos)
    recursos = "window.R=" + json.dumps(R, ensure_ascii=False).replace("</", "<\\/") + ";"
    comun = (AQUI / "comun.js").read_text(encoding="utf-8")
    armar("editor.src.html", ["editor.css"], comun, "editor.js", recursos, AQUI / "index.html")
    armar("pancarta.src.html", ["editor.css", "pancarta.css"], comun, "pancarta.js", recursos, AQUI / "pancarta.html")
    print(f"  {len(marca)} imágenes de marca, {len(fuentes)} + {len(campana)} fuentes, {len(iconos)} íconos, "
          f"temas: {', '.join(temas) or 'ninguno'}")


def armar(fuente, hojas, comun, js, recursos, salida):
    """Inserta CSS, recursos, código común y el del editor en la plantilla HTML."""
    if not (AQUI / fuente).exists():
        return
    html_ = (AQUI / fuente).read_text(encoding="utf-8")
    trozos = {"/*CSS*/": "\n".join((AQUI / h).read_text(encoding="utf-8") for h in hojas),
              "/*RECURSOS*/": recursos,
              "/*COMUN*/": comun.replace("</script", "<\\/script"),
              "/*JS*/": (AQUI / js).read_text(encoding="utf-8").replace("</script", "<\\/script")}
    for marca_, contenido in trozos.items():
        a, b = html_.split(marca_, 1)
        html_ = a + contenido + b
    salida.write_text(html_, encoding="utf-8")
    print(f"{salida.name}: {salida.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
