# pdf-historias

Maquetador de historias en PDF con el estándar visual de **Tazón para Dos**. Escribes la historia en Markdown, añades unas pocas directivas `:::` para las columnas, las imágenes y los recuadros, y la herramienta genera un PDF A4 con portada, cabeceras, pies con número de página, ornamentos de marca y contraportada.

Funciona con Python 3 y con Microsoft Edge (o Chrome) en modo *headless*, que imprime el HTML a PDF. El perfil del navegador, los temporales y la caché se guardan en esta carpeta (`_perfil_navegador/`, `_tmp/`), nunca en C:.

## Uso

```bash
cd D:\herramientas\pdf-historias
python -I maquetar.py ruta\historia.md                       # crea ruta\historia.pdf (y el .html intermedio)
python -I maquetar.py historia.md -o otra\salida.pdf         # elige dónde guardar el PDF
python -I maquetar.py historia.md --png vistas --dpi 70      # además, un PNG por página y hoja-de-contactos.png
python -I maquetar.py historia.md --solo-html                # solo el HTML, para revisarlo en el navegador
```

Ejemplo incluido: `python -I maquetar.py ejemplo\ejemplo.md --png ejemplo\vistas` (6 páginas con todas las directivas).

Historias reales hechas con la herramienta:
- `D:\historias\mago-la-ascension\la-marea-detenida.md` → `la-marea-detenida.pdf` (13 páginas).
- `D:\historias\mitos-engativa\la-puerta-del-sol.md` → `la-puerta-del-sol.pdf` (35 páginas) y `web\index.html`.

## Plantilla web (HTML autocontenido)

```bash
python -I maquetar.py historia.md --web carpeta\web               # PDF + versión web
python -I maquetar.py historia.md --web carpeta\web --solo-web    # solo la versión web
```

La carpeta de salida contiene:
- `index.html` y `estilo.css`;
- `fuentes\` (TTF, con su licencia OFL);
- `imagenes\` y `marca\` (copias de las imágenes que usa la historia).

Funciona sin conexión: basta con abrir `index.html` en el navegador, copiar la carpeta a otro equipo o subirla a cualquier hosting estático.

**En pantalla:**
- barra superior fija;
- índice automático de partes y capítulos, con enlaces;
- botón ↑ para volver al índice;
- dos columnas en pantallas anchas y una en el celular (menos de 860 px). En el celular, las imágenes flotantes pasan a ocupar todo el ancho.

La portada, las páginas a sangre, los banners, los recuadros de leyenda y las figuras quedan en las mismas posiciones que en el PDF. Para eso, las páginas especiales usan una unidad relativa (`--mm`) que escala con el ancho.

**Para imprimir:** usa *Imprimir → Guardar como PDF* en Edge o Chrome, con tamaño A4, márgenes *predeterminados*, *Gráficos de fondo* activado y *Encabezados y pies de página* desactivado. Sale el mismo diseño de página que el PDF, con cabeceras, números en hexágono y páginas a sangre, porque el CSS de impresión es el mismo. Probado con *La Puerta del Sol*: 35 páginas en los dos casos.

Para usar la plantilla con otra historia no hace falta tocar nada: cualquier `.md` con el formato de abajo produce su propia web.

## Editor visual (pegar texto e imágenes)

`editor/index.html` es la forma fácil de usar las plantillas: se abre con doble clic en el navegador, sin instalar nada y sin internet.

1. Elige una **plantilla** (Historia corta, Crónica a dos columnas, Todos los bloques o En blanco) o usa **Pegar historia completa**: las líneas que empiezan por «Capítulo», «Parte», «Prólogo», «Epílogo» o `#` se vuelven capítulos.
2. Rellena la **portada**, añade **bloques** y la **contraportada**: capítulo, texto, columnas (1/2/3), imagen (en el texto, ancha, en la columna, flotante izquierda/derecha), página completa / portadilla de parte, apertura con banner, recuadro, leyenda (dos paneles), cita destacada, epígrafe, divisor, salto de página y espacio.
3. Imágenes: clic en el hueco para subir, **Ctrl+V** para pegar, arrastrar y soltar, o elegir una pieza de la marca (Tazón, Tinieblas e ilustraciones de ejemplo). Las fotos grandes se reducen a 2400 px.
4. **Estilo**: Tazón (claro), Tinieblas (oscuro) o Tinieblas pergamino.
5. **Descargar HTML** da un archivo autocontenido (fuentes, imágenes y estilo dentro). **Imprimir / PDF** abre el diálogo del navegador: «Guardar como PDF», A4, «Gráficos de fondo» activado. Las páginas salen igual que con `maquetar.py`.
6. El trabajo se guarda solo en el navegador; **Guardar proyecto** descarga un `.json` (con las imágenes) para seguir en otro equipo con **Abrir proyecto**.

Enlace directo a una plantilla: `editor/index.html#plantilla=cronica` (también `corta`, `todo`, `blanco`).

El editor usa el mismo CSS que `maquetar.py`. Si cambias el maquetador, la marca o los temas, regenéralo:

```
python -I editor/generar_editor.py
```

## Temas (p. ej. Tinieblas)

`--tema archivo.css` aplica un CSS encima del estilo base, tanto en el PDF como en la versión `--web`. La marca oscura **Tazón para Dos · Tinieblas** trae dos temas (https://thetrashkat.github.io/tazon-para-dos-tinieblas/):

```
python -I maquetar.py historia.md --tema D:/tazon-para-dos-tinieblas/tema-tinieblas.css --web web-tinieblas
python -I maquetar.py historia.md --tema D:/tazon-para-dos-tinieblas/tema-tinieblas-pergamino.css   # para imprimir
```

### Requisitos

- Python 3.10 o superior. `fonttools` solo hace falta la primera vez, para preparar las fuentes. `pymupdf` y `Pillow` son opcionales y sirven para `--png`.
- Microsoft Edge o Google Chrome. Se buscan en las rutas habituales; si no, define `PDF_HISTORIAS_NAVEGADOR` con la ruta del ejecutable.
- Fuentes: Space Grotesk (títulos), DM Sans (texto) y DM Mono (etiquetas), en `fuentes/`, con licencia SIL OFL (`fuentes/OFL.txt`). Si faltan, `python -I preparar_fuentes.py` las descarga desde el repositorio de Google Fonts y crea instancias estáticas, para que el PDF incruste TrueType.
- Elementos de marca en `marca/` (copiados de `D:\tazon-para-dos-marca\assets`): `d20`, `d20-turquesa`, `destello`, `d6`, `carta`, `sello`, `logotipo-horizontal(-inverso)` y `mascota`.

## Formato del Markdown

### Cabecera (front matter)

```yaml
---
titulo: La marea detenida.             # activa la portada
subtitulo: Una historia alternativa…
etiqueta: Mago: La Ascensión · Historia alternativa   # píldora sobre el título
autoria: Texto e ilustraciones · Tazón para Dos
fecha: Octubre 2026
portada: imagenes/portada.svg          # ilustración principal de la portada (a sangre, abajo)
color: turquesa                        # bloque superior: turquesa | coral | sol | tinta | crema
color-inferior: coral                  # bloque inferior, tras la diagonal y la franja sol
coleccion: Tazón para Dos · Historias  # cabecera izquierda
cabecera: La marea detenida            # cabecera derecha
pie: Mago: La Ascensión · historia alternativa   # texto central del pie
columnas: 1                            # columnas al empezar (por defecto 1)
creditos: Texto pequeño en la contraportada
contraportada: Primer párrafo (grande, en sol).
  Párrafos siguientes: continúa con líneas sangradas con espacios.
---
```

Sin `titulo` no hay portada; sin `contraportada` no hay contraportada.

### Markdown admitido

`#`, `##`, `###` y `####`, párrafos, `**negrita**`, `*cursiva*`, `` `código` ``, `[enlace](url)`, listas `-` y `1.`, citas `>` y `---`, que se convierte en divisor diagonal con franja sol y destello.

- `# Capítulo 1 | La Capilla.` crea una píldora («Capítulo 1») y un título grande con sombra dura. El párrafo siguiente lleva **letra capitular**. Cada título recibe un `id`, que es el que usa el índice web. Si el título cae dentro de un tramo a dos columnas, la herramienta lo saca a su propia franja de una columna, unida al texto que sigue, para que no quede huérfano al pie de una página.
- El texto se justifica y la herramienta inserta guiones blandos con un silabeador español, porque Edge en Windows no trae diccionarios de partición.

### Directivas

Las directivas de una línea terminan en la propia línea. Las de bloque se cierran con `:::` en su propia línea. Todo lo que va tras `|` es el **pie de imagen** (o el título, en los recuadros).

| Directiva | Qué hace |
|---|---|
| `::: columnas 2` / `::: columnas 1` | Cambia el número de columnas (1, 2 o 3) desde ese punto, incluso a mitad de página. Con `::: columnas 2 pagina` empieza además una página nueva. |
| `::: salto` | Salto de página. |
| `::: espacio 8mm` | Espacio vertical. |
| `::: ornamento` | Divisor diagonal (igual que `---`). |
| `::: figura ruta.svg \| pie` | Figura a todo el ancho. En 2 columnas **ocupa las dos** (`column-span`). Opciones: `60%` (ancho), `recorte alto=60mm` (recorta tipo banda), `sin-marco` (sin borde ni sombra), `columna` (en 2 columnas, solo una). |
| `::: flotante derecha ruta.svg 45% \| pie` | Imagen flotante a la `izquierda` o a la `derecha`, con el texto alrededor. |
| `::: pagina-imagen ruta.svg \| pie` | Página completa a sangre (sin cabecera ni pie), con triángulo de esquina y pie en píldora. Opciones: `contener` (no recorta) y `fondo=tinta`. Con dos o tres tramos (`\| Parte I \| El árbol. \| pie opcional`) se convierte en **portadilla de parte**: píldora y título grande sobre la imagen. Entra en el índice web. |
| `::: leyenda coral \| Título` … `+++` … `:::` | Recuadro de **leyenda en dos paneles**: a la izquierda «Lo que se cuenta» (crema) y a la derecha «En el Mundo de Tinieblas» (tinta). La línea `+++` separa los dos textos. Ocupa todas las columnas; con `columna`, una sola, con los paneles apilados. Colores de cabecera: `sol` (por defecto), `turquesa` y `coral`. Los rótulos se cambian con `leyenda-izquierda:` y `leyenda-derecha:` en la cabecera. |
| `::: apertura ruta.svg alto=90mm columnas=2 \| pie` … `:::` | **Banner superior a sangre** con corte diagonal y franja sol. El contenido del bloque (título, epígrafe, primeros párrafos) va en esa misma página, con pie de página. Conviene que quepa en una página. |
| `::: recuadro sol \| Título` … `:::` | Recuadro lateral (sidebar) en crema con puntos, borde tinta y sombra dura. Colores: `turquesa`, `coral`, `sol` y `tinta` (oscuro). Con `ancho` ocupa todas las columnas. Admite Markdown y figuras dentro. |
| `::: epigrafe` … `— Autoría` … `:::` | Epígrafe en cursiva con comilla coral. La línea que empieza por `—` es la autoría. |
| `::: cita` … `:::` | Cita destacada en Space Grotesk, entre dos divisores diagonales. Con `ancho` ocupa todas las columnas. |

**Rutas de imagen:** son relativas al `.md`, aunque también valen rutas absolutas sin espacios. `marca:d20` apunta a `marca/d20.svg`. Admite SVG, PNG, JPG, WEBP y GIF. Si una ruta tiene espacios, copia el archivo junto al `.md`.

## Estándar visual aplicado

- **Paleta:** tinta `#28203B`, turquesa `#55C4BF`, coral `#EA6077`, sol `#F8CB67`, crema `#F7F2E8` y papel `#FFFDF8`, sin degradados.
- **Tipografía:** Space Grotesk para títulos, DM Sans para el texto y DM Mono para etiquetas en mayúsculas con un espaciado de 0,12 em.
- **Sombras** duras desplazadas, sin desenfoque. **Patrón de puntos** de 22 px en recuadros, portada y contraportada.
- **Diagonales** que suben de izquierda a derecha con franja sol: divisores, corte de banners y bloques de portada.
- **Triángulo sol + coral** en la esquina superior derecha de cada página.
- **Portada** con sello, nombre y `ESPACIO CULTURAL · ENGATIVÁ` arriba a la izquierda. **Contraportada** en tinta, con d20, logotipo inverso y lema.
- **Cabecera** con colección y título sobre una línea tinta. **Pie** con el número dentro de un hexágono sol y un destello coral, alternado en páginas pares e impares.

## Consejos

- Revisa siempre las vistas (`--png`). La hoja de contactos permite ver de un vistazo los huecos al final de un capítulo, sobre todo antes de una `pagina-imagen` o una `apertura`, que siempre empiezan en página nueva.
- Una imagen flotante necesita texto suficiente alrededor. En un tramo de 2 columnas muy corto, Edge puede no dibujarla.
- Para rellenar un hueco, mueve párrafos dentro o fuera de una `apertura`, cambia el `alto=` de un banner o añade una `figura` ancha.
- No uses fotos de rostros reales sin consentimiento. Las ilustraciones de marca son planas y con contorno tinta.

## Archivos

```
maquetar.py           herramienta (Markdown -> HTML -> PDF; PNG y versión web opcionales)
preparar_fuentes.py   descarga e instancia las fuentes de Google Fonts
fuentes/              Space Grotesk, DM Sans, DM Mono (OFL)
marca/                elementos SVG del kit de marca
ejemplo/              ejemplo.md + ilustraciones + ejemplo.pdf
_maquetar_v1_respaldo.py  versión anterior (sin modo web), por si hiciera falta comparar
_perfil_navegador/    perfil temporal de Edge (se puede borrar)
_tmp/                 temporales de Edge (se puede borrar)
```
