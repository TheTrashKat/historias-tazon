"""pdf-historias · maquetador de historias en PDF con el estándar visual de Tazón para Dos.

Convierte un Markdown con directivas sencillas en un HTML paginado y lo imprime a PDF con
Microsoft Edge (o Chrome) en modo headless. Todo (perfil del navegador, temporales y salidas)
se queda en la carpeta de la herramienta o junto al Markdown, nunca en C:.

Uso rápido:
    python -I maquetar.py historia.md                      -> historia.pdf (junto al .md)
    python -I maquetar.py historia.md -o salida.pdf --png vistas --dpi 70
    python -I maquetar.py historia.md --solo-html          -> solo genera historia.html

Ver README.md para la sintaxis completa.
"""
import argparse
import html
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
FUENTES = AQUI / "fuentes"
MARCA = AQUI / "marca"

NAVEGADORES = [
    os.environ.get("PDF_HISTORIAS_NAVEGADOR", ""),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]

# --------------------------------------------------------------------------------------
# Paleta y ornamentos (SVG en línea)
# --------------------------------------------------------------------------------------
INK, TEAL, CORAL, SUN, CREAM, PAPER, MUTED = (
    "#28203B", "#55C4BF", "#EA6077", "#F8CB67", "#F7F2E8", "#FFFDF8", "#665F68")
COLORES = {"turquesa": TEAL, "coral": CORAL, "sol": SUN, "tinta": INK, "crema": CREAM}


def svg_uri(svg):
    """SVG -> data URI apto para CSS url()."""
    s = re.sub(r"\s+", " ", svg.strip())
    return "data:image/svg+xml;utf8," + s.replace("#", "%23").replace('"', "'")


# Triángulo de esquina: coral grande + sol interior (esquina superior derecha).
TRIANGULO = svg_uri(f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
<path d="M0 0H100V100Z" fill="{CORAL}"/><path d="M46 0H100V54Z" fill="{SUN}"/></svg>""")

# Hexágono (d20 visto de frente) para el número de página.
HEXAGONO = svg_uri(f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<path d="M50 6 88 28V72L50 94 12 72V28Z" fill="{SUN}" stroke="{INK}" stroke-width="7" stroke-linejoin="round"/></svg>""")

DESTELLO = svg_uri(f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100">
<path d="M0,-50 C6,-10 10,-6 50,0 C10,6 6,10 0,50 C-6,10 -10,6 -50,0 C-10,-6 -6,-10 0,-50 Z" fill="{CORAL}"/></svg>""")

# Divisor diagonal que sube de izquierda a derecha con franja sol.
DIVISOR = svg_uri(f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 24" preserveAspectRatio="none">
<path d="M0 20 L400 8 L400 13 L0 25Z" fill="{TEAL}"/><path d="M0 15 L400 3 L400 7 L0 19Z" fill="{SUN}"/>
<path d="M0 21.5 L400 9.5" stroke="{INK}" stroke-width="1.6" fill="none"/></svg>""")

# Corte diagonal inferior de los banners (papel + franja sol + línea tinta).
CORTE_BANNER = svg_uri(f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 40" preserveAspectRatio="none">
<path d="M0 26 L400 6 L400 13 L0 33Z" fill="{SUN}"/><path d="M0 33 L400 13 L400 40 L0 40Z" fill="{PAPER}"/>
<path d="M0 26 L400 6" stroke="{INK}" stroke-width="2.4" fill="none"/><path d="M0 33 L400 13" stroke="{INK}" stroke-width="2.4" fill="none"/></svg>""")

PUNTOS = "radial-gradient(rgba(40,32,59,.10) 1.6px, transparent 1.7px) 0 0 / 22px 22px"
PUNTOS_CLAROS = "radial-gradient(rgba(247,242,232,.09) 1.6px, transparent 1.7px) 0 0 / 22px 22px"


def bloque_diagonal(color_sup, color_inf, alto_mm=297, corte=0.62, pendiente=4.0):
    """Fondo de página: dos bloques con diagonal que sube de izquierda a derecha y franja sol."""
    w, h = 210, alto_mm
    y = h * corte
    d = w * __import__("math").tan(__import__("math").radians(pendiente))
    return svg_uri(f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" preserveAspectRatio="none">
<rect width="{w}" height="{h}" fill="{color_sup}"/>
<path d="M0 {y:.1f} L{w} {y - d:.1f} L{w} {h} L0 {h}Z" fill="{SUN}"/>
<path d="M0 {y + 5:.1f} L{w} {y - d + 5:.1f} L{w} {h} L0 {h}Z" fill="{color_inf}"/>
<path d="M0 {y:.1f} L{w} {y - d:.1f} M0 {y + 5:.1f} L{w} {y - d + 5:.1f}" stroke="{INK}" stroke-width="1.1" fill="none"/></svg>""")


# --------------------------------------------------------------------------------------
# Markdown mínimo (sin dependencias)
# --------------------------------------------------------------------------------------
def inline(texto):
    t = html.escape(texto, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", t)
    t = re.sub(r"(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])", r"<em>\1</em>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", lambda m: f'<a href="{m.group(2)}">{m.group(1)}</a>', t)
    t = t.replace(" -- ", " — ").replace("  \n", "<br>")
    return t


# --------------------------------------------------------------------------------------
# Silabeo español para insertar guiones blandos (&shy;): Chrome/Edge en Windows no
# siempre trae diccionarios de partición, así que lo hacemos nosotros.
# --------------------------------------------------------------------------------------
VOCALES = set("aeiouáéíóúü")
FUERTES = set("aeoáéó")
GRUPOS = {"bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "kl", "kr", "pl", "pr", "tr", "ch", "ll", "rr", "tl"}


def silabear(palabra):
    w = palabra.lower()
    n = len(w)
    cortes = []
    i = 0
    # posiciones de núcleos vocálicos
    while i < n:
        if w[i] in VOCALES:
            j = i + 1
            while j < n and w[j] in VOCALES:
                a, b = w[j - 1], w[j]
                if (a in FUERTES and b in FUERTES) or b in "íú" or a in "íú":
                    cortes.append(j)  # hiato
                j += 1
            # consonantes hasta la siguiente vocal
            k = j
            while k < n and w[k] not in VOCALES:
                k += 1
            if k >= n:
                break
            cons = w[j:k]
            c = len(cons)
            if c == 1:
                cortes.append(j)
            elif c == 2:
                cortes.append(j if cons in GRUPOS else j + 1)
            elif c == 3:
                cortes.append(j + 1 if cons[1:] in GRUPOS else j + 2)
            elif c >= 4:
                cortes.append(j + 2)
            i = k
        else:
            i += 1
    cortes = sorted(x for x in set(cortes) if 2 <= x <= n - 3)
    if not cortes:
        return palabra
    out, prev = [], 0
    for x in cortes:
        out.append(palabra[prev:x]); prev = x
    out.append(palabra[prev:])
    return "\u00ad".join(out)


def guionar(html_):
    partes = re.split(r"(<[^>]+>|&[a-z]+;)", html_)
    for k, p in enumerate(partes):
        if p and not p.startswith(("<", "&")):
            partes[k] = re.sub(r"(?<![./:@\w-])[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{7,}(?![./:@\w-])", lambda m: silabear(m.group(0)), p)
    return "".join(partes)


def slug(texto):
    import unicodedata
    t = unicodedata.normalize("NFKD", re.sub(r"<[^>]+>", "", texto)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-") or "seccion"


def bloques_md(lineas, capitular=False):
    """Convierte líneas Markdown (sin directivas) a HTML."""
    out, parrafo, lista, cita = [], [], None, []
    estado = {"capitular": capitular}

    def cerrar_parrafo():
        if parrafo:
            clase = ' class="capitular"' if estado["capitular"] else ""
            estado["capitular"] = False
            out.append(f"<p{clase}>{guionar(inline(' '.join(parrafo)))}</p>")
            parrafo.clear()

    def cerrar_lista():
        nonlocal lista
        if lista:
            tag, items = lista
            out.append(f"<{tag}>" + "".join(f"<li>{guionar(inline(i))}</li>" for i in items) + f"</{tag}>")
            lista = None

    def cerrar_cita():
        if cita:
            out.append("<blockquote>" + bloques_md(cita) + "</blockquote>")
            cita.clear()

    for linea in lineas + [""]:
        s = linea.rstrip()
        if s.startswith(">"):
            cerrar_parrafo(); cerrar_lista()
            cita.append(s[1:].lstrip() if len(s) > 1 else "")
            continue
        cerrar_cita()
        if not s.strip():
            cerrar_parrafo(); cerrar_lista()
            continue
        m = re.match(r"^(#{1,4})\s+(.*)$", s)
        if m:
            cerrar_parrafo(); cerrar_lista()
            nivel, texto = len(m.group(1)), m.group(2).strip()
            if nivel == 1:
                if "|" in texto:
                    kicker, titulo = [x.strip() for x in texto.split("|", 1)]
                    out.append(f'<header class="capitulo" id="{slug(kicker + "-" + titulo)}"><span class="kicker">{inline(kicker)}</span>'
                               f"<h1>{inline(titulo)}</h1></header>")
                else:
                    out.append(f'<header class="capitulo" id="{slug(texto)}"><h1>{inline(texto)}</h1></header>')
                estado["capitular"] = True
            else:
                out.append(f"<h{nivel}>{inline(texto)}</h{nivel}>")
            continue
        if re.match(r"^(-{3,}|\*{3,})$", s.strip()):
            cerrar_parrafo(); cerrar_lista()
            out.append('<div class="divisor" role="separator"></div>')
            continue
        m = re.match(r"^\s*([-*+]|\d+[.)])\s+(.*)$", s)
        if m:
            cerrar_parrafo()
            tag = "ol" if m.group(1)[0].isdigit() else "ul"
            if not lista or lista[0] != tag:
                cerrar_lista(); lista = (tag, [])
            lista[1].append(m.group(2))
            continue
        if lista and linea.startswith("  "):
            lista[1][-1] += " " + s.strip()
            continue
        cerrar_lista()
        parrafo.append(s.strip() if not linea.endswith("  ") else s.strip() + "  \n")
    cerrar_parrafo(); cerrar_lista(); cerrar_cita()
    return "\n".join(out)


# --------------------------------------------------------------------------------------
# Directivas
# --------------------------------------------------------------------------------------
CON_CONTENIDO = {"recuadro", "epigrafe", "epígrafe", "cita", "apertura", "banner", "nota", "leyenda"}


class Maquetador:
    def __init__(self, md_path, web=None, tema=""):
        self.tema = tema  # CSS opcional que se aplica encima del estilo base
        self.web = Path(web).resolve() if web else None  # carpeta de salida web (rutas relativas)
        self.md_path = Path(md_path).resolve()
        self.base = self.md_path.parent
        texto = self.md_path.read_text(encoding="utf-8")
        self.meta, cuerpo = self.front_matter(texto)
        self.lineas = cuerpo.splitlines()
        self.columnas = int(self.meta.get("columnas", "1"))

    # -- utilidades ----------------------------------------------------------------
    @staticmethod
    def front_matter(texto):
        meta = {}
        if texto.startswith("---"):
            fin = texto.find("\n---", 3)
            if fin != -1:
                clave = None
                for l in texto[3:fin].splitlines():
                    if not l.strip():
                        continue
                    m = re.match(r"^([\w-]+):\s*(.*)$", l)
                    if m:
                        clave = m.group(1).lower()
                        meta[clave] = m.group(2).strip().strip('"')
                    elif clave:  # continuación multilínea
                        meta[clave] += "\n" + l.strip()
                texto = texto[fin + 4:]
        return meta, texto

    def ruta(self, r):
        if r.startswith("marca:"):
            nombre = r[6:]
            p = MARCA / (nombre if nombre.endswith(".svg") else nombre + ".svg")
        else:
            p = Path(r)
            if not p.is_absolute():
                p = (self.base / p)
        p = p.resolve()
        if not p.exists():
            print(f"  aviso: no existe la imagen {p}", file=sys.stderr)
        return self.publicar(p)

    def publicar(self, p):
        """PDF: URI file:// absoluta. Web: copia el archivo a la carpeta web y devuelve la ruta relativa."""
        p = Path(p)
        if not self.web:
            return p.as_uri()
        sub = "marca" if p.parent == MARCA else "imagenes"
        destino = self.web / sub / p.name
        destino.parent.mkdir(parents=True, exist_ok=True)
        if p.exists() and (not destino.exists() or destino.stat().st_mtime < p.stat().st_mtime
                           or destino.stat().st_size != p.stat().st_size):
            shutil.copy2(p, destino)
        return f"{sub}/{p.name}"

    @staticmethod
    def parse_args(resto):
        """'derecha fig.svg 40% sin-marco | Pie de foto' -> (tokens, opciones, pie)"""
        pie = ""
        if "|" in resto:
            resto, pie = resto.split("|", 1)
        toks = resto.split()
        opciones, libres = {}, []
        for t in toks:
            if "=" in t:
                k, v = t.split("=", 1)
                opciones[k.lower()] = v
            else:
                libres.append(t)
        return libres, opciones, pie.strip()

    @staticmethod
    def es_ruta(t):
        return t.startswith("marca:") or re.search(r"\.(svg|png|jpe?g|webp|gif)$", t, re.I)

    def figura(self, libres, op, pie, clases):
        src = next((t for t in libres if self.es_ruta(t)), None)
        if not src:
            return "<!-- figura sin imagen -->"
        ancho = next((t for t in libres if re.match(r"^\d+(\.\d+)?(%|mm|cm)$", t)), op.get("ancho"))
        estilo = []
        if ancho:
            estilo.append(f"width:{ancho}")
        if "alto" in op:
            estilo.append(f"--alto:{op['alto']}")
        if "sin-marco" in libres:
            clases.append("sin-marco")
        if "recorte" in libres or "alto" in op:
            clases.append("recorte")
        st = f' style="{";".join(estilo)}"' if estilo else ""
        cap = f"<figcaption>{inline(pie)}</figcaption>" if pie else ""
        alt = html.escape(op.get("alt", pie or "Ilustración"), quote=True)
        return (f'<figure class="{" ".join(clases)}"{st}><img src="{self.ruta(src)}" alt="{alt}">{cap}</figure>')

    # -- render --------------------------------------------------------------------
    def cuerpo(self):
        partes, buffer = [], []
        seccion_abierta = [False]
        cap_pendiente = [False]  # capitular para el primer párrafo tras un título sacado del flujo

        def volcar():
            if buffer:
                h = bloques_md(buffer, capitular=cap_pendiente[0]); buffer.clear()
                cap_pendiente[0] = False
                if h.strip():
                    partes.append(h)

        def abrir(nueva_pagina=False):
            clase = f"flujo cols-{self.columnas}" + (" nueva-pagina" if nueva_pagina else "")
            partes.append(f'<section class="{clase}">')
            seccion_abierta[0] = True

        def cerrar():
            volcar()
            if seccion_abierta[0]:
                if partes and partes[-1].startswith('<section class="flujo'):
                    partes.pop()  # sección vacía: no generar páginas en blanco
                else:
                    partes.append("</section>")
                seccion_abierta[0] = False

        abrir()
        i = 0
        L = self.lineas
        while i < len(L):
            linea = L[i]
            m = re.match(r"^:::\s*([\wáéíóúñ-]+)\s*(.*)$", linea.strip())
            if not m:
                if self.columnas > 1 and not getattr(self, "anidado", False) and re.match(r"^#\s", linea):
                    # Título de capítulo dentro de un tramo a varias columnas: va en su propia sección
                    # de una columna, unida a la siguiente (evita títulos huérfanos al pie de página).
                    cerrar()
                    partes.append(f'<section class="flujo cols-1 cabeza-capitulo">{bloques_md([linea])}</section>')
                    abrir()
                    cap_pendiente[0] = True
                    i += 1
                    continue
                buffer.append(linea); i += 1; continue
            nombre, resto = m.group(1).lower(), m.group(2)
            libres, op, pie = self.parse_args(resto)
            contenido = []
            if nombre in CON_CONTENIDO:
                i += 1
                profundidad = 0
                while i < len(L):
                    t = L[i].strip()
                    if t == ":::" and profundidad == 0:
                        break
                    if re.match(r"^:::\s*\w", t) and t.split()[0] == ":::" and \
                            re.match(r"^:::\s*([\wáéíóúñ-]+)", t).group(1).lower() in CON_CONTENIDO:
                        profundidad += 1
                    elif t == ":::":
                        profundidad -= 1
                    contenido.append(L[i]); i += 1
            i += 1

            if nombre == "columnas":
                cerrar()
                self.columnas = int(next((t for t in libres if t.isdigit()), "1"))
                abrir(nueva_pagina=("pagina" in libres or "página" in libres))
            elif nombre == "salto":
                volcar(); partes.append('<div class="salto"></div>')
            elif nombre == "espacio":
                volcar(); partes.append(f'<div style="height:{libres[0] if libres else "6mm"}"></div>')
            elif nombre in ("ornamento", "divisor"):
                volcar(); partes.append('<div class="divisor" role="separator"></div>')
            elif nombre in ("figura", "imagen"):
                volcar()
                clases = ["fig"]
                clases.append("ancha" if ("ancha" in libres or self.columnas > 1 and "columna" not in libres) else "")
                partes.append(self.figura(libres, op, pie, [c for c in clases if c]))
            elif nombre == "flotante":
                volcar()
                lado = "izquierda" if "izquierda" in libres else "derecha"
                partes.append(self.figura(libres, op, pie, ["fig", "flotante", lado]))
            elif nombre in ("pagina-imagen", "página-imagen", "sangre"):
                cerrar()
                src = next((t for t in libres if self.es_ruta(t)), "")
                portadilla, id_ = "", ""
                if "|" in pie:  # «Parte I | Título | pie opcional» -> portadilla de parte
                    trozos = [x.strip() for x in pie.split("|")]
                    kicker, titulo_p = trozos[0], trozos[1]
                    pie = trozos[2] if len(trozos) > 2 else ""
                    id_ = f' id="{slug(kicker + "-" + titulo_p)}"'
                    portadilla = (f'<div class="portadilla"><span class="kicker">{inline(kicker)}</span>'
                                  f'<h1>{inline(titulo_p)}</h1></div>')
                cap = f'<figcaption>{inline(pie)}</figcaption>' if pie else ""
                fondo = COLORES.get(op.get("fondo", ""), INK)
                ajuste = "contain" if "contener" in libres else "cover"
                partes.append(f'<section class="sangre{" parte" if portadilla else ""}"{id_} style="background:{fondo}">'
                              f'<img src="{self.ruta(src)}" style="object-fit:{ajuste}" alt="{html.escape(pie or "Ilustración")}">'
                              f'<div class="triangulo"></div>{portadilla}{cap}</section>')
                abrir()
            elif nombre in ("apertura", "banner"):
                cerrar()
                src = next((t for t in libres if self.es_ruta(t)), "")
                alto = re.sub(r"[^\d.]", "", op.get("alto", "88mm")) or "88"
                cols = int(op.get("columnas", "1"))
                cap = f'<span class="pie-banner">{inline(pie)}</span>' if pie else ""
                interior = Maquetador.desde_lineas(self, contenido, cols)
                partes.append(f'<section class="apertura"><div class="banner" style="--alto-banner:{alto}">'
                              f'<img src="{self.ruta(src)}" alt="{html.escape(pie or "Banner")}">'
                              f'<div class="corte"></div><div class="triangulo"></div>{cap}</div>'
                              f'<div class="interior cols-{cols}">{interior}</div></section>')
                abrir()
            elif nombre in ("recuadro", "nota"):
                volcar()
                color = next((t for t in libres if t in COLORES), "turquesa")
                ancho = "ancho" in libres
                titulo = " ".join(t for t in libres if t not in COLORES and t != "ancho")
                if pie:
                    titulo = (titulo + " " + pie).strip()
                tit = f'<div class="etiqueta">{inline(titulo)}</div>' if titulo else ""
                partes.append(f'<aside class="recuadro c-{color}{" ancho" if ancho else ""}">{tit}'
                              f'{Maquetador.desde_lineas(self, contenido, 1)}</aside>')
            elif nombre == "leyenda":
                volcar()
                color = next((t for t in libres if t in COLORES), "sol")
                titulo = " ".join(t for t in libres if t not in COLORES and t not in ("columna",))
                if pie:
                    titulo = (titulo + " " + pie).strip()
                idx = next((k for k, l in enumerate(contenido) if l.strip() == "+++"), len(contenido))
                izq, der = contenido[:idx], contenido[idx + 1:]
                r_izq = self.meta.get("leyenda-izquierda", "Lo que se cuenta")
                r_der = self.meta.get("leyenda-derecha", "En el Mundo de Tinieblas")
                ancho = "" if "columna" in libres else " ancho"
                partes.append(
                    f'<aside class="leyenda c-{color}{ancho}"><div class="cabeza"><span class="etiqueta">Leyenda</span>'
                    f'<b>{inline(titulo)}</b></div><div class="paneles">'
                    f'<div class="panel popular"><div class="rotulo">{inline(r_izq)}</div>{Maquetador.desde_lineas(self, izq, 1)}</div>'
                    f'<div class="panel tinieblas"><div class="rotulo">{inline(r_der)}</div>{Maquetador.desde_lineas(self, der, 1)}</div>'
                    f'</div></aside>')
            elif nombre in ("epigrafe", "epígrafe"):
                volcar()
                cuerpo_l, autor = [], ""
                for l in contenido:
                    if l.strip().startswith(("—", "--", "- ")) and not autor:
                        autor = l.strip().lstrip("—-").strip()
                    else:
                        cuerpo_l.append(l)
                partes.append(f'<div class="epigrafe">{bloques_md(cuerpo_l)}'
                              + (f'<div class="autor">{inline(autor)}</div>' if autor else "") + "</div>")
            elif nombre == "cita":
                volcar()
                ancho = " ancho" if "ancho" in libres else ""
                partes.append(f'<blockquote class="destacada{ancho}">{bloques_md(contenido)}</blockquote>')
            else:
                print(f"  aviso: directiva desconocida ':::{nombre}'", file=sys.stderr)
        cerrar()
        return "\n".join(partes)

    @staticmethod
    def desde_lineas(padre, lineas, cols):
        """Renderiza contenido anidado (recuadros, aperturas) reutilizando las directivas."""
        hijo = Maquetador.__new__(Maquetador)
        hijo.md_path, hijo.base, hijo.meta, hijo.web = padre.md_path, padre.base, padre.meta, padre.web
        hijo.lineas, hijo.columnas = lineas, cols
        hijo.anidado = True
        html_ = hijo.cuerpo()
        # quitar la envoltura <section class="flujo ..."> del hijo
        html_ = re.sub(r'^<section class="flujo[^"]*">\n?', "", html_)
        html_ = re.sub(r"\n?</section>$", "", html_)
        return html_

    def portada(self):
        m = self.meta
        if "titulo" not in m and "título" not in m:
            return ""
        titulo = m.get("titulo", m.get("título"))
        fondo = COLORES.get(m.get("color", "turquesa"), TEAL)
        inferior = COLORES.get(m.get("color-inferior", "coral"), CORAL)
        img = f'<img class="heroe" src="{self.ruta(m["portada"])}" alt="Ilustración de portada">' if m.get("portada") else ""
        return f"""
<section class="portada" style="background-image:url(&quot;{bloque_diagonal(fondo, inferior, corte=0.70)}&quot;)">
  <div class="puntos"></div>
  <div class="triangulo grande"></div>
  <header class="marca">
    <img src="{self.publicar(MARCA / 'sello.svg')}" alt="Sello Tazón para Dos">
    <div><b>TAZÓN PARA DOS</b><span>ESPACIO CULTURAL · ENGATIVÁ</span></div>
  </header>
  <div class="etiqueta-portada">{inline(m.get('etiqueta', 'HISTORIAS'))}</div>
  <h1 class="titulo-portada">{inline(titulo)}</h1>
  <p class="subtitulo-portada">{inline(m.get('subtitulo', ''))}</p>
  {img}
  <footer class="creditos">
    <span>{inline(m.get('autoria', ''))}</span>
    <span>{inline(m.get('fecha', ''))}</span>
  </footer>
</section>"""

    def contraportada(self):
        m = self.meta
        if not m.get("contraportada"):
            return ""
        parrafos = "".join(f"<p>{inline(p)}</p>" for p in m["contraportada"].split("\n") if p.strip())
        return f"""
<section class="contraportada">
  <img class="d20" src="{self.publicar(MARCA / 'd20.svg')}" alt="">
  <div class="texto">{parrafos}</div>
  {f'<div class="creditos-final">{inline(m["creditos"])}</div>' if m.get("creditos") else ""}
  <div class="cierre">
    <img src="{self.publicar(MARCA / 'logotipo-horizontal-inverso.svg')}" alt="Tazón para Dos">
    <span>JUGAR TAMBIÉN ES ESCUCHAR.</span>
  </div>
</section>"""

    def indice(self, cuerpo_html):
        """Índice de partes y capítulos (solo en la versión web)."""
        items = []
        patron = (r'<section class="sangre parte" id="([^"]+)".*?<span class="kicker">(.*?)</span><h1>(.*?)</h1>'
                  r'|<header class="capitulo" id="([^"]+)">(?:<span class="kicker">(.*?)</span>)?<h1>(.*?)</h1>')
        for mm_ in re.finditer(patron, cuerpo_html, re.S):
            if mm_.group(1):
                items.append(("parte", mm_.group(1), mm_.group(2), mm_.group(3)))
            else:
                items.append(("cap", mm_.group(4), mm_.group(5) or "", mm_.group(6)))
        if not items:
            return ""
        limpio = lambda h: re.sub("<[^>]+>", "", h).replace("\u00ad", "")
        lis = "".join(f'<li class="{t}"><a href="#{i}"><span class="k">{limpio(k)}</span>'
                      f'<span class="t">{limpio(h)}</span></a></li>' for t, i, k, h in items)
        return f'<nav class="indice" id="indice"><div class="etiqueta">Índice</div><ol>{lis}</ol></nav>'

    def html(self):
        m = self.meta
        cab_izq = m.get("coleccion", m.get("colección", "TAZÓN PARA DOS · HISTORIAS"))
        cab_der = m.get("cabecera", m.get("titulo", ""))
        pie = m.get("pie", m.get("etiqueta", ""))
        css = CSS.format(
            fuentes=FUENTES.as_uri(), ink=INK, teal=TEAL, coral=CORAL, sun=SUN, cream=CREAM,
            paper=PAPER, muted=MUTED, triangulo=TRIANGULO, hexagono=HEXAGONO, destello=DESTELLO,
            divisor=DIVISOR, corte=CORTE_BANNER, puntos=PUNTOS, puntos_claros=PUNTOS_CLAROS,
            cab_izq=css_str(cab_izq), cab_der=css_str(cab_der), pie=css_str(pie),
            nombradas=paginas_nombradas())
        titulo = html.escape(re.sub(r"[*_]", "", m.get("titulo", "Historia")))
        if not self.web:
            return (f'<!doctype html>\n<html lang="{m.get("idioma", "es")}"><head><meta charset="utf-8">'
                    f"<title>{titulo}</title><style>{css}</style><style>{self.tema}</style></head>"
                    f"<body>{self.portada()}\n{self.cuerpo()}\n{self.contraportada()}</body></html>")
        # --- versión web: CSS externo, fuentes relativas, índice y barra superior
        css = css.replace(FUENTES.as_uri(), "fuentes")
        (self.web / "estilo.css").write_text(
            css + WEB_CSS.format(ink=INK, teal=TEAL, coral=CORAL, sun=SUN, cream=CREAM, paper=PAPER, muted=MUTED,
                                 puntos=PUNTOS) + "\n" + self.tema, encoding="utf-8")
        (self.web / "fuentes").mkdir(parents=True, exist_ok=True)
        for f in FUENTES.glob("*"):
            if f.suffix in (".ttf", ".txt") and "-VF" not in f.name:
                shutil.copy2(f, self.web / "fuentes" / f.name)
        cuerpo = self.cuerpo()
        portada = self.portada()
        sello = self.publicar(MARCA / "sello.svg")
        cab = inline(m.get("cabecera", m.get("titulo", "")))
        return (f'<!doctype html>\n<html lang="{m.get("idioma", "es")}"><head><meta charset="utf-8">'
                f'<meta name="viewport" content="width=device-width, initial-scale=1">'
                f'<title>{titulo}</title><link rel="stylesheet" href="estilo.css"></head><body class="web">'
                f'<header class="barra"><a href="#indice"><img src="{sello}" alt=""><b>TAZÓN PARA DOS</b></a>'
                f'<span>{cab}</span><a class="btn" href="#indice">Índice</a></header>'
                f'<main class="libro">{portada}\n{self.indice(cuerpo)}\n{cuerpo}\n{self.contraportada()}</main>'
                f'<a class="volver" href="#indice" aria-label="Volver al índice">↑</a></body></html>')


def css_str(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def paginas_nombradas():
    """Páginas sin cabecera/pie (portada, sangre, contraportada) y la de apertura (solo pie)."""
    nada = ("@top-left{content:none;border:0;background:none} @top-center{content:none;border:0} "
            "@top-right{content:none;border:0} @top-right-corner{content:none;background:none} "
            "@bottom-left{content:none;background:none} @bottom-center{content:none} "
            "@bottom-right{content:none;background:none}")
    sin_cab = ("@top-left{content:none;border:0;background:none} @top-center{content:none;border:0} "
               "@top-right{content:none;border:0} @top-right-corner{content:none;background:none}")
    out = []
    for nombre in ("portada", "sangre", "contraportada"):
        for lado in ("", ":left", ":right"):
            out.append(f"@page {nombre}{lado} {{ margin:0; {nada} }}")
    # En la apertura la página no tiene márgenes laterales (banner a sangre): desplazamos el pie.
    num = "width:28mm;background-origin:content-box;background-clip:content-box"
    out.append(f"@page apertura {{ margin:0 0 17mm 0; {sin_cab} }}")
    out.append(f"@page apertura:left {{ margin:0 0 17mm 0; {sin_cab} @bottom-left{{{num};padding-left:17mm}} "
               f"@bottom-right{{width:28mm;padding-right:17mm;background-origin:content-box}} }}")
    out.append(f"@page apertura:right {{ margin:0 0 17mm 0; {sin_cab} @bottom-right{{{num};padding-right:17mm}} "
               f"@bottom-left{{width:28mm;padding-left:17mm;background-origin:content-box}} }}")
    return "\n".join(out)


CSS = r"""
@font-face{{font-family:'Space Grotesk';src:url('{fuentes}/SpaceGrotesk-Medium.ttf');font-weight:500}}
@font-face{{font-family:'Space Grotesk';src:url('{fuentes}/SpaceGrotesk-Bold.ttf');font-weight:700}}
@font-face{{font-family:'DM Sans';src:url('{fuentes}/DMSans-Regular.ttf');font-weight:400}}
@font-face{{font-family:'DM Sans';src:url('{fuentes}/DMSans-SemiBold.ttf');font-weight:600}}
@font-face{{font-family:'DM Sans';src:url('{fuentes}/DMSans-Bold.ttf');font-weight:700}}
@font-face{{font-family:'DM Sans';src:url('{fuentes}/DMSans-Italic.ttf');font-weight:400;font-style:italic}}
@font-face{{font-family:'DM Sans';src:url('{fuentes}/DMSans-SemiBoldItalic.ttf');font-weight:600;font-style:italic}}
@font-face{{font-family:'DM Mono';src:url('{fuentes}/DMMono-Regular.ttf');font-weight:400}}
@font-face{{font-family:'DM Mono';src:url('{fuentes}/DMMono-Medium.ttf');font-weight:500}}

:root{{--mm:1mm;--ink:{ink};--teal:{teal};--coral:{coral};--sun:{sun};--cream:{cream};--paper:{paper};--muted:{muted};
  --sombra:1.6mm 1.6mm 0 rgba(40,32,59,.18);--sombra-dura:1.4mm 1.4mm 0 {ink}}}

@page{{size:A4;margin:20mm 17mm 17mm 17mm;background:{paper};
  @top-left{{content:{cab_izq};font:500 6.6pt 'DM Mono';letter-spacing:.12em;text-transform:uppercase;color:{ink};
    vertical-align:bottom;padding-bottom:2.2mm;border-bottom:1.3pt solid {ink}}}
  @top-center{{content:"";border-bottom:1.3pt solid {ink}}}
  @top-right{{content:{cab_der};font:500 6.6pt 'DM Mono';letter-spacing:.12em;text-transform:uppercase;color:{muted};
    vertical-align:bottom;text-align:right;padding-bottom:2.2mm;border-bottom:1.3pt solid {ink}}}
  @top-right-corner{{content:"";background:url("{triangulo}") no-repeat;background-size:100% 100%}}
  @bottom-center{{content:{pie};font:400 6.4pt 'DM Mono';letter-spacing:.12em;text-transform:uppercase;color:{muted};vertical-align:middle}}
}}
@page :right{{
  @bottom-right{{content:counter(page);width:11mm;font:700 8.5pt 'Space Grotesk';color:{ink};text-align:center;vertical-align:middle;
    background:url("{hexagono}") center/10mm 10mm no-repeat}}
  @bottom-left{{content:"";width:11mm;background:url("{destello}") left center/4mm 4mm no-repeat}}
}}
@page :left{{
  @bottom-left{{content:counter(page);width:11mm;font:700 8.5pt 'Space Grotesk';color:{ink};text-align:center;vertical-align:middle;
    background:url("{hexagono}") center/10mm 10mm no-repeat}}
  @bottom-right{{content:"";width:11mm;background:url("{destello}") right center/4mm 4mm no-repeat}}
}}
{nombradas}

*{{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
html,body{{margin:0;padding:0;background:{paper};color:{ink}}}
body{{font:400 9.4pt/1.5 'DM Sans',sans-serif;font-kerning:normal;orphans:2;widows:2}}
p{{margin:0 0 .55em;text-align:justify;hyphens:auto;-webkit-hyphens:auto}}
p+p{{text-indent:1.1em}}
a{{color:{ink};text-decoration-color:{teal};text-decoration-thickness:1.2pt}}
strong{{font-weight:700}} em{{font-style:italic}}
code{{font:400 .9em 'DM Mono'}}
ul,ol{{margin:0 0 .7em;padding-left:1.2em}} li{{margin:.15em 0}}
ul li::marker{{content:"✦  ";color:{coral};font-size:.8em}}

/* --- flujo y columnas ------------------------------------------------------------- */
.flujo{{display:block}}
.flujo:empty{{display:none}}
.nueva-pagina{{break-before:page}}
.cols-2{{column-count:2;column-gap:7mm;column-rule:.6pt dotted rgba(40,32,59,.35);column-fill:balance}}
.cols-3{{column-count:3;column-gap:6mm;column-rule:.6pt dotted rgba(40,32,59,.35)}}
.salto{{break-after:page;height:0}}
.cabeza-capitulo{{break-after:avoid;break-inside:avoid}}
.cabeza-capitulo header.capitulo{{margin-bottom:5mm}}

/* --- títulos ------------------------------------------------------------------------ */
header.capitulo{{column-span:all;margin:0 0 6mm;padding-top:1mm;break-after:avoid}}
header.capitulo .kicker{{display:inline-block;font:500 7pt 'DM Mono';letter-spacing:.14em;text-transform:uppercase;
  background:{ink};color:{sun};padding:1.1mm 2.6mm;border-radius:999px;margin-bottom:2.5mm}}
h1{{font:700 25pt/1.02 'Space Grotesk';margin:0;letter-spacing:-.01em;text-shadow:.9mm .9mm 0 {teal}}}
h2{{font:700 12.5pt/1.15 'Space Grotesk';margin:1.1em 0 .5em;break-after:avoid;padding-bottom:1.2mm;
  background:linear-gradient({coral},{coral}) left bottom/14mm 1.4pt no-repeat}}
h3{{font:500 7.6pt 'DM Mono';letter-spacing:.12em;text-transform:uppercase;margin:1em 0 .4em;color:{ink};break-after:avoid}}
h4{{font:700 9.6pt 'DM Sans';margin:.8em 0 .3em;break-after:avoid}}
h2+p,h3+p,h4+p{{text-indent:0}}
p.capitular{{text-indent:0}}
p.capitular::first-letter{{float:left;font:700 33pt/0.86 'Space Grotesk';color:{coral};text-shadow:.8mm .8mm 0 {ink};
  padding:.6mm 1.6mm 0 0;margin-top:.4mm}}

/* --- ornamentos --------------------------------------------------------------------- */
.divisor{{height:6.5mm;margin:4mm 0 5mm;background:url("{divisor}") center/100% 100% no-repeat;position:relative;break-after:avoid}}
.divisor::after{{content:"";position:absolute;left:50%;top:50%;width:5mm;height:5mm;transform:translate(-50%,-62%);
  background:url("{destello}") center/contain no-repeat}}
.cols-2 .divisor,.cols-3 .divisor{{column-span:all}}

/* --- figuras -------------------------------------------------------------------------- */
figure{{margin:2mm 0 4mm;break-inside:avoid}}
figure img{{display:block;width:100%;height:auto;border:1.6pt solid {ink};border-radius:3mm;box-shadow:var(--sombra);background:{cream}}}
figure.recorte img{{height:var(--alto,60mm);object-fit:cover}}
figure.sin-marco img{{border:0;box-shadow:none;border-radius:0;background:none}}
figcaption{{font:400 6.5pt/1.4 'DM Mono';letter-spacing:.08em;text-transform:uppercase;color:{muted};margin-top:2.4mm;
  padding-left:4.4mm;background:url("{destello}") left .2mm/2.8mm 2.8mm no-repeat}}
figure.ancha{{column-span:all;margin:3mm 0 5mm}}
figure.flotante{{width:44%;margin:1mm 0 3mm}}
figure.flotante.derecha{{float:right;margin-left:4mm}}
figure.flotante.izquierda{{float:left;margin-right:4mm}}

/* --- recuadros, epígrafes y citas ----------------------------------------------------- */
aside.recuadro{{background:{cream};background-image:{puntos};border:1.6pt solid {ink};border-radius:4mm;padding:4.5mm 4.5mm 3mm;
  margin:4mm 0 5mm;box-shadow:var(--sombra);break-inside:avoid;font-size:8.6pt;line-height:1.45;position:relative}}
aside.recuadro.ancho{{column-span:all}}
aside.recuadro p{{text-align:left;text-indent:0;hyphens:manual}}
aside.recuadro .etiqueta{{display:inline-block;font:500 7pt 'DM Mono';letter-spacing:.13em;text-transform:uppercase;
  padding:1.1mm 2.6mm;border:1.3pt solid {ink};border-radius:999px;margin:-1mm 0 2.6mm;background:{teal};box-shadow:.8mm .8mm 0 {ink}}}
aside.c-coral .etiqueta{{background:{coral}}} aside.c-sol .etiqueta{{background:{sun}}}
aside.c-tinta{{background-color:{ink};background-image:{puntos_claros};color:{cream}}}
aside.c-tinta .etiqueta{{background:{sun};color:{ink};border-color:{sun}}}
aside.recuadro h2,aside.recuadro h3{{margin-top:.4em}}
aside.recuadro ul{{padding-left:1.1em}}
.epigrafe{{column-span:all;margin:0 0 6mm;padding:1mm 0 1mm 9mm;position:relative;max-width:150mm}}
.cols-2 .epigrafe{{column-span:none;max-width:none}}
.epigrafe::before{{content:"“";position:absolute;left:0;top:-3mm;font:700 30pt 'Space Grotesk';color:{coral}}}
.epigrafe p{{font-style:italic;font-size:10.2pt;line-height:1.45;text-align:left;text-indent:0}}
.epigrafe .autor{{font:500 6.8pt 'DM Mono';letter-spacing:.12em;text-transform:uppercase;color:{muted};margin-top:1.5mm}}
.epigrafe .autor::before{{content:"— "}}
blockquote{{margin:0 0 .8em;padding-left:4mm;border-left:2pt solid {sun}}}
blockquote.destacada{{border:0;padding:5mm 1mm 4mm;margin:4mm 0 5mm;break-inside:avoid;position:relative;
  background:url("{divisor}") top/100% 4.5mm no-repeat,url("{divisor}") bottom/100% 4.5mm no-repeat}}
blockquote.destacada.ancho{{column-span:all;padding:6mm 12mm 5mm}}
blockquote.destacada p{{font:500 13pt/1.25 'Space Grotesk';text-align:left;text-indent:0;margin:.8mm 0}}
blockquote.destacada p:last-child{{margin-bottom:0}}

/* --- leyendas: versión popular frente a versión del Mundo de Tinieblas ------------------ */
aside.leyenda{{border:1.6pt solid {ink};border-radius:4mm;box-shadow:var(--sombra);margin:4mm 0 6mm;break-inside:avoid;
  overflow:hidden;font-size:8.5pt;line-height:1.45;background:{cream}}}
aside.leyenda.ancho{{column-span:all}}
aside.leyenda .cabeza{{display:flex;align-items:center;gap:3mm;padding:2.6mm 4.5mm;border-bottom:1.6pt solid {ink};
  background:{sun};background-image:{puntos}}}
aside.leyenda.c-turquesa .cabeza{{background-color:{teal}}} aside.leyenda.c-coral .cabeza{{background-color:{coral}}}
aside.leyenda .cabeza .etiqueta{{font:500 6.6pt 'DM Mono';letter-spacing:.14em;text-transform:uppercase;background:{ink};color:{sun};
  padding:1mm 2.6mm;border-radius:999px;white-space:nowrap}}
aside.leyenda .cabeza b{{font:700 12.5pt/1.1 'Space Grotesk'}}
aside.leyenda .paneles{{display:grid;grid-template-columns:1fr 1fr}}
aside.leyenda:not(.ancho) .paneles{{grid-template-columns:1fr}}
aside.leyenda .panel{{padding:3.6mm 4.5mm 2.4mm}}
aside.leyenda .panel.popular{{background:{cream};background-image:{puntos}}}
aside.leyenda .panel.tinieblas{{background:{ink};background-image:{puntos_claros};color:{cream}}}
aside.leyenda .rotulo{{font:500 6.6pt 'DM Mono';letter-spacing:.13em;text-transform:uppercase;margin-bottom:2mm;color:{coral}}}
aside.leyenda .tinieblas .rotulo{{color:{sun}}}
aside.leyenda p{{text-align:left;text-indent:0;hyphens:manual;margin-bottom:.5em}}
aside.leyenda .tinieblas strong{{color:{sun}}}

/* --- páginas especiales --------------------------------------------------------------- */
.triangulo{{position:absolute;top:0;right:0;width:calc(24*var(--mm));height:calc(24*var(--mm));background:url("{triangulo}") center/100% 100% no-repeat;z-index:3}}
.triangulo.grande{{width:calc(38*var(--mm));height:calc(38*var(--mm))}}
section.sangre{{page:sangre;break-before:page;break-after:page;position:relative;width:calc(210*var(--mm));height:calc(297*var(--mm));overflow:hidden}}
section.sangre img{{position:absolute;inset:0;width:100%;height:100%}}
section.sangre .portadilla{{position:absolute;left:calc(16*var(--mm));top:calc(18*var(--mm));right:calc(30*var(--mm));z-index:3}}
section.sangre .portadilla .kicker{{display:inline-block;font:500 calc(2.8*var(--mm)) 'DM Mono';letter-spacing:.14em;text-transform:uppercase;
  background:{ink};color:{sun};padding:calc(1.4*var(--mm)) calc(3.4*var(--mm));border-radius:999px;border:calc(.5*var(--mm)) solid {cream}}}
section.sangre .portadilla h1{{font:700 calc(17*var(--mm))/.95 'Space Grotesk';color:{cream};text-shadow:calc(2*var(--mm)) calc(2*var(--mm)) 0 {ink};
  margin:calc(3*var(--mm)) 0 0;letter-spacing:-.015em}}
section.sangre figcaption{{position:absolute;left:calc(14*var(--mm));bottom:calc(14*var(--mm));max-width:calc(150*var(--mm));background:{cream};color:{ink};
  border:calc(0.564*var(--mm)) solid {ink};border-radius:999px;padding:calc(2*var(--mm)) calc(4*var(--mm)) calc(2*var(--mm)) calc(9*var(--mm));box-shadow:var(--sombra-dura);background-position:calc(3.5*var(--mm)) center;
  background-image:url("{destello}");background-size:calc(3.4*var(--mm));background-repeat:no-repeat;font-size:calc(2.470*var(--mm));margin:0}}
section.apertura{{page:apertura;break-before:page;break-after:page}}
section.apertura .banner{{position:relative;width:100%;height:calc(var(--alto-banner,88)*var(--mm));overflow:hidden;background:{ink}}}
section.apertura .banner img{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
section.apertura .corte{{position:absolute;left:0;right:0;bottom:calc(-.2*var(--mm));height:calc(15*var(--mm));background:url("{corte}") center/100% 100% no-repeat;z-index:2}}
section.apertura .pie-banner{{position:absolute;right:calc(17*var(--mm));bottom:calc(15*var(--mm));z-index:3;font:400 calc(2.258*var(--mm)) 'DM Mono';letter-spacing:.1em;text-transform:uppercase;
  background:{cream};border:calc(0.459*var(--mm)) solid {ink};border-radius:999px;padding:calc(1*var(--mm)) calc(3*var(--mm))}}
section.apertura .interior{{padding:calc(3*var(--mm)) calc(17*var(--mm)) 0}}
section.apertura header.capitulo{{margin-top:0}}

/* portada */
section.portada{{page:portada;break-after:page;position:relative;width:calc(210*var(--mm));height:calc(297*var(--mm));overflow:hidden;background-size:100% 100%;color:{ink}}}
section.portada .puntos{{position:absolute;inset:0;background:{puntos};z-index:0}}
section.portada .marca{{position:absolute;left:calc(16*var(--mm));top:calc(15*var(--mm));display:flex;align-items:center;gap:calc(3.2*var(--mm));z-index:2}}
section.portada .marca img{{width:calc(15*var(--mm));height:calc(15*var(--mm))}}
section.portada .marca b{{display:block;font:700 calc(4.586*var(--mm)) 'Space Grotesk';letter-spacing:.02em}}
section.portada .marca span{{display:block;font:500 calc(2.328*var(--mm)) 'DM Mono';letter-spacing:.14em}}
.etiqueta-portada{{position:absolute;left:calc(16*var(--mm));top:calc(44*var(--mm));z-index:2;font:500 calc(2.681*var(--mm)) 'DM Mono';letter-spacing:.14em;text-transform:uppercase;
  background:{ink};color:{sun};padding:calc(1.6*var(--mm)) calc(3.6*var(--mm));border-radius:999px}}
.titulo-portada{{position:absolute;left:calc(16*var(--mm));right:calc(16*var(--mm));top:calc(56*var(--mm));z-index:2;font:700 calc(17.640*var(--mm))/.95 'Space Grotesk';color:{cream};
  letter-spacing:-.015em;text-shadow:calc(2.2*var(--mm)) calc(2.2*var(--mm)) 0 {ink};margin:0}}
.subtitulo-portada{{position:absolute;left:calc(16*var(--mm));width:calc(120*var(--mm));top:var(--sub,calc(86*var(--mm)));z-index:2;font:500 calc(4.234*var(--mm))/1.3 'Space Grotesk';
  text-align:left;text-indent:0;background:{paper};border:calc(0.564*var(--mm)) solid {ink};border-radius:calc(3*var(--mm));padding:calc(2.5*var(--mm)) calc(4*var(--mm));box-shadow:var(--sombra-dura)}}
section.portada .heroe{{position:absolute;left:0;bottom:var(--heroe-abajo,calc(26*var(--mm)));width:calc(210*var(--mm));z-index:1}}
section.portada .creditos{{position:absolute;left:calc(16*var(--mm));right:calc(16*var(--mm));bottom:calc(15*var(--mm));z-index:2;display:flex;justify-content:space-between;
  font:500 calc(2.611*var(--mm)) 'DM Mono';letter-spacing:.12em;text-transform:uppercase;color:{ink}}}
section.portada .creditos span{{background:{cream};border:calc(0.459*var(--mm)) solid {ink};border-radius:999px;padding:calc(1.4*var(--mm)) calc(3.2*var(--mm))}}

/* contraportada */
section.contraportada{{page:contraportada;break-before:page;position:relative;width:calc(210*var(--mm));height:calc(297*var(--mm));overflow:hidden;
  background:{ink};background-image:{puntos_claros};color:{cream}}}
section.contraportada .d20{{position:absolute;right:calc(20*var(--mm));top:calc(26*var(--mm));width:calc(52*var(--mm));transform:rotate(8deg)}}
section.contraportada .texto{{position:absolute;left:calc(20*var(--mm));width:calc(118*var(--mm));top:calc(90*var(--mm))}}
section.contraportada .texto p{{font:400 calc(3.881*var(--mm))/1.55 'DM Sans';text-align:left;text-indent:0;margin-bottom:.9em}}
section.contraportada .texto p:first-child{{font:700 calc(5.998*var(--mm))/1.2 'Space Grotesk';color:{sun}}}
section.contraportada .creditos-final{{position:absolute;left:calc(20*var(--mm));right:calc(20*var(--mm));bottom:calc(48*var(--mm));font:400 calc(2.540*var(--mm))/1.5 'DM Mono';
  letter-spacing:.04em;color:{cream};opacity:.85}}
section.contraportada .cierre{{position:absolute;left:calc(20*var(--mm));right:calc(20*var(--mm));bottom:calc(22*var(--mm));display:flex;justify-content:space-between;align-items:center;
  border-top:calc(0.459*var(--mm)) solid {cream};padding-top:calc(6*var(--mm))}}
section.contraportada .cierre img{{height:calc(16*var(--mm))}}
section.contraportada .cierre span{{font:500 calc(2.611*var(--mm)) 'DM Mono';letter-spacing:.14em;color:{sun}}}
"""


WEB_CSS = r"""
/* ======================= versión web (pantalla) ======================= */
.barra,nav.indice,.volver{{display:none}}
@media screen{{
  :root{{--mm:calc(100cqw/210)}}
  html{{background:{cream};background-image:{puntos};scroll-behavior:smooth;scroll-padding-top:64px}}
  body.web{{font-size:16.5px;line-height:1.62;background:transparent}}
  .barra{{display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:20;background:{ink};color:{cream};
    padding:8px 20px;border-bottom:3px solid {sun};font:500 12px 'DM Mono';letter-spacing:.12em;text-transform:uppercase}}
  .barra a{{color:{cream};text-decoration:none;display:flex;align-items:center;gap:10px}}
  .barra img{{width:30px;height:30px}} .barra b{{font:700 15px 'Space Grotesk';letter-spacing:.02em}}
  .barra span{{flex:1;color:{sun};overflow:hidden;white-space:nowrap;text-overflow:ellipsis}}
  .barra .btn{{background:{sun};color:{ink};border:2px solid {cream};border-radius:999px;padding:4px 14px}}
  main.libro{{max-width:1080px;margin:28px auto 80px;padding:0 0 40px;background:{paper};border:2px solid {ink};
    border-radius:22px;box-shadow:10px 10px 0 rgba(40,32,59,.18);overflow:hidden}}
  main.libro>section.flujo{{padding:28px 56px 8px}}
  main.libro>section.cabeza-capitulo{{padding-bottom:0}}
  main.libro>section.cabeza-capitulo+section.flujo{{padding-top:0}}
  section.portada,section.sangre,section.contraportada{{width:100%;height:auto;aspect-ratio:210/297;container-type:inline-size;margin:0 auto}}
  section.portada{{border-bottom:3px solid {ink}}}
  section.sangre,section.contraportada{{margin:28px 0}}
  section.apertura{{container-type:inline-size;margin:28px 0 0}}
  section.apertura .interior{{padding:12px 56px 0}}
  nav.indice{{display:block;margin:36px 56px 8px;padding:22px 26px;background:{cream};background-image:{puntos};
    border:2px solid {ink};border-radius:16px;box-shadow:6px 6px 0 rgba(40,32,59,.18)}}
  nav.indice .etiqueta{{display:inline-block;font:500 12px 'DM Mono';letter-spacing:.14em;text-transform:uppercase;background:{ink};
    color:{sun};padding:4px 12px;border-radius:999px;margin-bottom:12px}}
  nav.indice ol{{list-style:none;margin:0;padding:0;columns:2;column-gap:32px}}
  nav.indice li{{break-inside:avoid;margin:0 0 6px}}
  nav.indice li.parte{{margin-top:12px}}
  nav.indice a{{display:flex;gap:10px;align-items:baseline;color:{ink};text-decoration:none;padding:3px 0;border-bottom:1px dotted rgba(40,32,59,.3)}}
  nav.indice a:hover .t{{text-decoration:underline;text-decoration-color:{coral}}}
  nav.indice .k{{font:500 11px 'DM Mono';letter-spacing:.1em;text-transform:uppercase;color:{muted};min-width:92px}}
  nav.indice li.parte .k{{color:{coral}}} nav.indice li.parte .t{{font:700 18px 'Space Grotesk'}}
  nav.indice .t{{font:500 15px 'Space Grotesk'}}
  .volver{{display:flex;position:fixed;right:18px;bottom:18px;width:46px;height:46px;align-items:center;justify-content:center;
    background:{sun};color:{ink};border:2px solid {ink};border-radius:50%;box-shadow:3px 3px 0 {ink};font:700 20px 'Space Grotesk';text-decoration:none;z-index:30}}
  .salto{{display:none}}
  h1{{font-size:clamp(28px,4.4vw,40px)}} h2{{font-size:22px}} h3{{font-size:12px}}
  figcaption{{font-size:11px}}
  aside.recuadro,aside.leyenda{{font-size:15px}}
  aside.leyenda .cabeza b{{font-size:20px}}
  aside.leyenda .rotulo,aside.leyenda .cabeza .etiqueta,aside.recuadro .etiqueta,header.capitulo .kicker{{font-size:11px}}
  blockquote.destacada p{{font-size:21px}} .epigrafe p{{font-size:17px}} .epigrafe .autor{{font-size:11px}}
}}
@media screen and (max-width:860px){{
  .cols-2,.cols-3{{column-count:1}}
  main.libro{{margin:0;border-radius:0;border-left:0;border-right:0}}
  main.libro>section.flujo,section.apertura .interior{{padding-left:20px;padding-right:20px}}
  nav.indice{{margin:24px 16px}} nav.indice ol{{columns:1}}
  figure.flotante{{float:none!important;width:100%!important;margin:14px 0!important}}
  aside.leyenda .paneles{{grid-template-columns:1fr}}
  body.web{{font-size:16px}}
}}
@media print{{.barra,nav.indice,.volver{{display:none!important}}}}
"""


# --------------------------------------------------------------------------------------
# Impresión con Edge/Chrome headless
# --------------------------------------------------------------------------------------
def navegador():
    for n in NAVEGADORES:
        if n and os.path.isfile(n):
            return n
    sys.exit("No encontré Edge ni Chrome. Define PDF_HISTORIAS_NAVEGADOR con la ruta del ejecutable.")


def imprimir(html_path, pdf_path, espera=120):
    exe = navegador()
    perfil = AQUI / "_perfil_navegador"
    tmp = AQUI / "_tmp"
    perfil.mkdir(exist_ok=True); tmp.mkdir(exist_ok=True)
    if pdf_path.exists():
        pdf_path.unlink()
    env = dict(os.environ, TMP=str(tmp), TEMP=str(tmp))
    cmd = [exe, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
           "--disable-extensions", "--no-pdf-header-footer", "--allow-file-access-from-files",
           f"--user-data-dir={perfil}", f"--disk-cache-dir={tmp / 'cache'}",
           "--run-all-compositor-stages-before-draw", "--virtual-time-budget=15000",
           f"--print-to-pdf={pdf_path}", html_path.as_uri()]
    subprocess.run(cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=espera)
    # Edge puede devolver el control antes de terminar de escribir: esperamos a que el tamaño se estabilice.
    t0, ultimo = time.time(), -1
    while time.time() - t0 < espera:
        if pdf_path.exists():
            tam = pdf_path.stat().st_size
            if tam > 0 and tam == ultimo:
                return True
            ultimo = tam
        time.sleep(0.8)
    return pdf_path.exists()


def vistas_png(pdf_path, carpeta, dpi=60):
    try:
        import fitz  # PyMuPDF
    except ImportError:
        print("  (instala PyMuPDF para generar PNG: pip install pymupdf)")
        return
    carpeta.mkdir(parents=True, exist_ok=True)
    for viejo in carpeta.glob("pagina-*.png"):
        viejo.unlink()
    doc = fitz.open(pdf_path)
    rutas = []
    for i, pag in enumerate(doc, 1):
        r = carpeta / f"pagina-{i:02d}.png"
        pag.get_pixmap(dpi=dpi).save(r)
        rutas.append(r)
    try:  # hoja de contactos
        from PIL import Image
        ims = [Image.open(r) for r in rutas]
        cols = 4
        w, h = ims[0].size
        filas = (len(ims) + cols - 1) // cols
        hoja = Image.new("RGB", (cols * (w + 12) + 12, filas * (h + 12) + 12), (102, 95, 104))
        for k, im in enumerate(ims):
            hoja.paste(im.convert("RGB"), (12 + (k % cols) * (w + 12), 12 + (k // cols) * (h + 12)))
        hoja.save(carpeta / "hoja-de-contactos.png")
    except Exception as e:  # noqa
        print("  (sin hoja de contactos:", e, ")")
    print(f"  {len(rutas)} PNG en {carpeta}")


def main():
    ap = argparse.ArgumentParser(description="Maqueta una historia en Markdown como PDF con el estilo de Tazón para Dos.")
    ap.add_argument("markdown")
    ap.add_argument("-o", "--salida", help="PDF de salida (por defecto, junto al .md)")
    ap.add_argument("--solo-html", action="store_true", help="solo genera el HTML intermedio")
    ap.add_argument("--png", help="carpeta donde guardar una vista PNG por página")
    ap.add_argument("--dpi", type=int, default=60)
    ap.add_argument("--web", help="genera además una versión web autocontenida (index.html, estilo.css, fuentes, imágenes) en esta carpeta")
    ap.add_argument("--tema", help="CSS que se aplica encima del estilo base (p. ej. D:/tazon-para-dos-tinieblas/tema-tinieblas.css)")
    ap.add_argument("--solo-web", action="store_true", help="con --web: no genera el PDF")
    a = ap.parse_args()

    if not (FUENTES / "SpaceGrotesk-Bold.ttf").exists():
        print("Preparando fuentes…")
        subprocess.run([sys.executable, "-I", str(AQUI / "preparar_fuentes.py")], check=True)

    md = Path(a.markdown).resolve()
    tema = Path(a.tema).read_text(encoding="utf-8") if a.tema else ""
    pdf = Path(a.salida).resolve() if a.salida else md.with_suffix(".pdf")
    html_path = pdf.with_suffix(".html")
    if a.web:
        web = Path(a.web).resolve()
        web.mkdir(parents=True, exist_ok=True)
        (web / "index.html").write_text(Maquetador(md, web=web, tema=tema).html(), encoding="utf-8")
        print("Web:", web / "index.html")
        if a.solo_web:
            return
    m = Maquetador(md, tema=tema)
    html_path.write_text(m.html(), encoding="utf-8")
    print("HTML:", html_path)
    if a.solo_html:
        return
    if not imprimir(html_path, pdf):
        sys.exit("No se generó el PDF.")
    try:
        import fitz
        with fitz.open(pdf) as d:
            print(f"PDF: {pdf}  ({d.page_count} páginas)")
    except ImportError:
        print("PDF:", pdf)
    if a.png:
        vistas_png(pdf, Path(a.png).resolve(), a.dpi)


if __name__ == "__main__":
    main()
