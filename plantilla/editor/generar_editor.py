"""Genera editor/index.html: el editor visual de historias (pegar texto + imágenes -> plantilla HTML/PDF).

Reúne en un solo HTML autocontenido el CSS del maquetador (mismo estilo que maquetar.py), las fuentes,
las piezas de marca, los temas Tinieblas y algunas ilustraciones de ejemplo. Volver a ejecutarlo
cuando cambie maquetar.py, la marca o los temas:

    python -I editor/generar_editor.py
"""
import base64
import json
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
HERRAMIENTA = AQUI.parent
sys.path.insert(0, str(HERRAMIENTA))
import maquetar as M  # noqa: E402

TINIEBLAS = Path(r"D:\tazon-para-dos-tinieblas")
ILUSTRACIONES = [Path(r"D:\historias\mitos-engativa\imagenes"), Path(r"D:\historias\mago-la-ascension\imagenes")]
MAX_ILUS = 40_000  # bytes: solo las ilustraciones ligeras entran como ejemplo


def data_uri(p, mime):
    return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()


def main():
    completo = M.CSS.format(
        fuentes="__FUENTES__", ink=M.INK, teal=M.TEAL, coral=M.CORAL, sun=M.SUN, cream=M.CREAM, paper=M.PAPER,
        muted=M.MUTED, triangulo=M.TRIANGULO, hexagono=M.HEXAGONO, destello=M.DESTELLO, divisor=M.DIVISOR,
        corte=M.CORTE_BANNER, puntos=M.PUNTOS, puntos_claros=M.PUNTOS_CLAROS,
        cab_izq='"__CAB_IZQ__"', cab_der='"__CAB_DER__"', pie='"__PIE__"', nombradas=M.paginas_nombradas())
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
         "marca": marca, "temas": temas, "colores": M.COLORES}
    recursos = "window.R=" + json.dumps(R, ensure_ascii=False).replace("</", "<\\/") + ";"

    plantilla = (AQUI / "editor.src.html").read_text(encoding="utf-8")
    css = (AQUI / "editor.css").read_text(encoding="utf-8")
    js = (AQUI / "editor.js").read_text(encoding="utf-8").replace("</script", "<\\/script")
    a, b = plantilla.split("/*CSS*/", 1)
    plantilla = a + css + b
    a, b = plantilla.split("/*RECURSOS*/", 1)
    plantilla = a + recursos + b
    a, b = plantilla.split("/*JS*/", 1)
    plantilla = a + js + b
    salida = AQUI / "index.html"
    salida.write_text(plantilla, encoding="utf-8")
    print(f"Editor: {salida}  ({salida.stat().st_size / 1e6:.2f} MB, {len(marca)} imágenes de marca, "
          f"{len(fuentes)} fuentes, temas: {', '.join(temas) or 'ninguno'})")


if __name__ == "__main__":
    main()
