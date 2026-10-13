"""Descarga (si faltan) las fuentes de la marca desde el repositorio de Google Fonts
y genera instancias estáticas (TTF) para que el PDF incruste TrueType y no Type3.

Uso:  python -I preparar_fuentes.py
Requiere: fontTools  (pip install fonttools)
"""
import os
import sys
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
FUENTES = os.path.join(AQUI, "fuentes")
BASE = "https://github.com/google/fonts/raw/main/ofl/"

DESCARGAS = {
    "SpaceGrotesk-VF.ttf": "spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf",
    "DMSans-VF.ttf": "dmsans/DMSans%5Bopsz,wght%5D.ttf",
    "DMSans-Italic-VF.ttf": "dmsans/DMSans-Italic%5Bopsz,wght%5D.ttf",
    "DMMono-Regular.ttf": "dmmono/DMMono-Regular.ttf",
    "DMMono-Medium.ttf": "dmmono/DMMono-Medium.ttf",
    "OFL.txt": "spacegrotesk/OFL.txt",
}

# (variable, salida, ejes)
INSTANCIAS = [
    ("SpaceGrotesk-VF.ttf", "SpaceGrotesk-Medium.ttf", {"wght": 500}),
    ("SpaceGrotesk-VF.ttf", "SpaceGrotesk-Bold.ttf", {"wght": 700}),
    ("DMSans-VF.ttf", "DMSans-Regular.ttf", {"wght": 400, "opsz": 11}),
    ("DMSans-VF.ttf", "DMSans-SemiBold.ttf", {"wght": 600, "opsz": 11}),
    ("DMSans-VF.ttf", "DMSans-Bold.ttf", {"wght": 700, "opsz": 14}),
    ("DMSans-Italic-VF.ttf", "DMSans-Italic.ttf", {"wght": 400, "opsz": 11}),
    ("DMSans-Italic-VF.ttf", "DMSans-SemiBoldItalic.ttf", {"wght": 600, "opsz": 11}),
]


def main():
    os.makedirs(FUENTES, exist_ok=True)
    for nombre, ruta in DESCARGAS.items():
        destino = os.path.join(FUENTES, nombre)
        if not os.path.isfile(destino) or os.path.getsize(destino) == 0:
            print("descargando", nombre)
            urllib.request.urlretrieve(BASE + ruta, destino)
    try:
        from fontTools.ttLib import TTFont
        from fontTools.varLib import instancer
    except ImportError:
        sys.exit("Falta fontTools: pip install fonttools")
    for origen, salida, ejes in INSTANCIAS:
        destino = os.path.join(FUENTES, salida)
        if os.path.isfile(destino):
            continue
        print("instanciando", salida, ejes)
        vf = TTFont(os.path.join(FUENTES, origen))
        estatica = instancer.instantiateVariableFont(vf, ejes, updateFontNames=False)
        estatica.save(destino)
    print("Fuentes listas en", FUENTES)


if __name__ == "__main__":
    main()
