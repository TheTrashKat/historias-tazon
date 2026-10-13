'use strict';
// Usa comun.js (se inserta antes al generar index.html).
/* Editor de historias · Tazón para Dos
   Bloques (pegar texto + imágenes) -> Markdown con directivas -> mismo HTML que genera maquetar.py.
   El HTML descargado es autocontenido (fuentes, imágenes y estilo dentro) y se imprime a PDF con las
   mismas páginas que la herramienta de línea de comandos. */
/* ===================================================================== Markdown (port de maquetar.py) */
const W = '\\p{L}\\p{N}_';
const RE_EM1 = new RegExp(`(?<![${W}*])\\*(?!\\s)(.+?)(?<!\\s)\\*(?![${W}*])`, 'gu');
const RE_EM2 = new RegExp(`(?<![${W}])_(?!\\s)(.+?)(?<!\\s)_(?![${W}])`, 'gu');
function inline(t) {
  t = esc(t);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(RE_EM1, '<em>$1</em>');
  t = t.replace(RE_EM2, '<em>$1</em>');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  return t.split(' -- ').join(' — ').split('  \n').join('<br>');
}

const VOC = new Set('aeiouáéíóúü'), FUE = new Set('aeoáéó');
const GRU = new Set(['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'kl', 'kr', 'pl', 'pr', 'tr', 'ch', 'll', 'rr', 'tl']);
function silabear(p) {
  const w = p.toLowerCase(), n = w.length; let cortes = [], i = 0;
  while (i < n) {
    if (VOC.has(w[i])) {
      let j = i + 1;
      while (j < n && VOC.has(w[j])) {
        const a = w[j - 1], b = w[j];
        if ((FUE.has(a) && FUE.has(b)) || 'íú'.includes(b) || 'íú'.includes(a)) cortes.push(j);
        j++;
      }
      let k = j; while (k < n && !VOC.has(w[k])) k++;
      if (k >= n) break;
      const cons = w.slice(j, k), c = cons.length;
      if (c === 1) cortes.push(j);
      else if (c === 2) cortes.push(GRU.has(cons) ? j : j + 1);
      else if (c === 3) cortes.push(GRU.has(cons.slice(1)) ? j + 1 : j + 2);
      else cortes.push(j + 2);
      i = k;
    } else i++;
  }
  cortes = [...new Set(cortes)].filter(x => x >= 2 && x <= n - 3).sort((a, b) => a - b);
  if (!cortes.length) return p;
  const out = []; let prev = 0;
  for (const x of cortes) { out.push(p.slice(prev, x)); prev = x; }
  out.push(p.slice(prev)); return out.join('­');
}
const RE_PALABRA = /(?<![./:@\p{L}\p{N}_-])[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{7,}(?![./:@\p{L}\p{N}_-])/gu;
const guionar = html => html.split(/(<[^>]+>|&[a-z]+;)/).map(p =>
  p && !p.startsWith('<') && !p.startsWith('&') ? p.replace(RE_PALABRA, m => silabear(m)) : p).join('');

// Divisores de la marca: ::: divisor cinta | luna…; sin nombre, el del documento o la diagonal clásica.
const DIVISORES = new Set(R.divisores || []);
let divisorDefecto = '';
const htmlDivisor = (n = '') => { n = n || divisorDefecto; if (n === 'diagonal') n = ''; return `<div class="divisor${DIVISORES.has(n) ? ' d-' + n : ''}" role="separator"></div>`; };
function bloquesMd(lineas, capitular = false) {
  const out = []; let parrafo = [], lista = null, cita = [], cap = capitular;
  const cP = () => { if (parrafo.length) { out.push(`<p${cap ? ' class="capitular"' : ''}>${guionar(inline(parrafo.join(' ')))}</p>`); cap = false; parrafo = []; } };
  const cL = () => { if (lista) { const [tag, items] = lista; out.push(`<${tag}>` + items.map(i => `<li>${guionar(inline(i))}</li>`).join('') + `</${tag}>`); lista = null; } };
  const cC = () => { if (cita.length) { out.push('<blockquote>' + bloquesMd(cita) + '</blockquote>'); cita = []; } };
  for (const linea of [...lineas, '']) {
    const s = linea.replace(/\s+$/, '');
    if (s.startsWith('>')) { cP(); cL(); cita.push(s.length > 1 ? s.slice(1).replace(/^\s+/, '') : ''); continue; }
    cC();
    if (!s.trim()) { cP(); cL(); continue; }
    let m = s.match(/^(#{1,4})\s+(.*)$/);
    if (m) {
      cP(); cL();
      const nivel = m[1].length, texto = m[2].trim();
      if (nivel === 1) {
        const i = texto.indexOf('|');
        if (i >= 0) {
          const k = texto.slice(0, i).trim(), ti = texto.slice(i + 1).trim();
          out.push(`<header class="capitulo" id="${slug(k + '-' + ti)}"><span class="kicker">${inline(k)}</span><h1>${inline(ti)}</h1></header>`);
        } else out.push(`<header class="capitulo" id="${slug(texto)}"><h1>${inline(texto)}</h1></header>`);
        cap = true;
      } else out.push(`<h${nivel}>${inline(texto)}</h${nivel}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(s.trim())) { cP(); cL(); out.push(htmlDivisor()); continue; }
    m = s.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    if (m) {
      cP();
      const tag = /\d/.test(m[1][0]) ? 'ol' : 'ul';
      if (!lista || lista[0] !== tag) { cL(); lista = [tag, []]; }
      lista[1].push(m[2]); continue;
    }
    if (lista && linea.startsWith('  ')) { lista[1][lista[1].length - 1] += ' ' + s.trim(); continue; }
    cL();
    parrafo.push(linea.endsWith('  ') ? s.trim() + '  \n' : s.trim());
  }
  cP(); cL(); cC();
  return out.join('\n');
}

/* ===================================================================== directivas (port de Maquetador) */
const CON = new Set(['recuadro', 'epigrafe', 'epígrafe', 'cita', 'apertura', 'banner', 'nota', 'leyenda']);
function parseArgs(resto) {
  let pie = ''; const i = resto.indexOf('|');
  if (i >= 0) { pie = resto.slice(i + 1); resto = resto.slice(0, i); }
  const op = {}, libres = [];
  for (const t of resto.split(/\s+/).filter(Boolean)) {
    const e = t.indexOf('=');
    if (e >= 0) op[t.slice(0, e).toLowerCase()] = t.slice(e + 1); else libres.push(t);
  }
  return [libres, op, pie.trim()];
}
const esRuta = t => /^(marca|img):/.test(t) || /\.(svg|png|jpe?g|webp|gif)$/i.test(t);

function bloqueDiagonal(sup, inf, alto = 297, corte = 0.62, pend = 4.0) {
  const w = 210, hh = alto, y = hh * corte, d = w * Math.tan(pend * Math.PI / 180), f = x => x.toFixed(1);
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none">
<rect width="${w}" height="${hh}" fill="${sup}"/>
<path d="M0 ${f(y)} L${w} ${f(y - d)} L${w} ${hh} L0 ${hh}Z" fill="${SUN}"/>
<path d="M0 ${f(y + 5)} L${w} ${f(y - d + 5)} L${w} ${hh} L0 ${hh}Z" fill="${inf}"/>
<path d="M0 ${f(y)} L${w} ${f(y - d)} M0 ${f(y + 5)} L${w} ${f(y - d + 5)}" stroke="${INK}" stroke-width="1.1" fill="none"/></svg>`);
}
class Render {
  constructor(meta, lineas, resolver, columnas) {
    this.meta = meta; this.lineas = lineas; this.resolver = resolver;
    this.columnas = columnas || parseInt(meta.columnas || '1', 10) || 1; this.anidado = false;
  }
  ruta(r) { return this.resolver(r); }
  figura(libres, op, pie, clases) {
    const src = libres.find(esRuta);
    if (!src) return '<!-- figura sin imagen -->';
    const ancho = libres.find(t => /^\d+(\.\d+)?(%|mm|cm)$/.test(t)) || op.ancho;
    const est = [];
    if (ancho) est.push('width:' + ancho);
    if ('alto' in op) est.push('--alto:' + op.alto);
    if (libres.includes('sin-marco')) clases.push('sin-marco');
    if (libres.includes('recorte') || 'alto' in op) clases.push('recorte');
    const st = est.length ? ` style="${est.join(';')}"` : '';
    const cap = pie ? `<figcaption>${inline(pie)}</figcaption>` : '';
    return `<figure class="${clases.join(' ')}"${st}><img src="${this.ruta(src)}" alt="${escAttr(op.alt || pie || 'Ilustración')}">${cap}</figure>`;
  }
  hijo(lineas, cols) {
    const r = new Render(this.meta, lineas, this.resolver, cols); r.anidado = true;
    return r.cuerpo().replace(/^<section class="flujo[^"]*">\n?/, '').replace(/\n?<\/section>$/, '');
  }
  cuerpo() {
    const partes = [], buffer = []; let abierta = false, capPend = false;
    const volcar = () => {
      if (buffer.length) { const x = bloquesMd(buffer, capPend); buffer.length = 0; capPend = false; if (x.trim()) partes.push(x); }
    };
    const abrir = (nueva = false) => { partes.push(`<section class="flujo cols-${this.columnas}${nueva ? ' nueva-pagina' : ''}">`); abierta = true; };
    const cerrar = () => {
      volcar();
      if (abierta) {
        if (partes.length && partes[partes.length - 1].startsWith('<section class="flujo')) partes.pop();
        else partes.push('</section>');
        abierta = false;
      }
    };
    abrir();
    const L = this.lineas; let i = 0;
    while (i < L.length) {
      const linea = L[i];
      const m = linea.trim().match(/^:::\s*([\p{L}\p{N}_-]+)\s*(.*)$/u);
      if (!m) {
        if (this.columnas > 1 && !this.anidado && /^#\s/.test(linea)) {
          cerrar();
          partes.push(`<section class="flujo cols-1 cabeza-capitulo">${bloquesMd([linea])}</section>`);
          abrir(); capPend = true; i++; continue;
        }
        buffer.push(linea); i++; continue;
      }
      const nombre = m[1].toLowerCase();
      let [libres, op, pie] = parseArgs(m[2]);
      const contenido = [];
      if (CON.has(nombre)) {
        i++; let prof = 0;
        while (i < L.length) {
          const t = L[i].trim();
          if (t === ':::' && prof === 0) break;
          const mm = t.match(/^:::\s*([\p{L}\p{N}_-]+)/u);
          if (mm && t.split(/\s+/)[0] === ':::' && CON.has(mm[1].toLowerCase())) prof++;
          else if (t === ':::') prof--;
          contenido.push(L[i]); i++;
        }
      }
      i++;
      if (nombre === 'columnas') {
        cerrar();
        this.columnas = parseInt(libres.find(t => /^\d+$/.test(t)) || '1', 10);
        abrir(libres.includes('pagina') || libres.includes('página'));
      } else if (nombre === 'salto') { volcar(); partes.push('<div class="salto"></div>'); }
      else if (nombre === 'espacio') { volcar(); partes.push(`<div style="height:${escAttr(libres[0] || '6mm')}"></div>`); }
      else if (nombre === 'ornamento' || nombre === 'divisor') { volcar(); partes.push(htmlDivisor(libres.find(t => DIVISORES.has(t) || t === 'diagonal') || '')); }
      else if (nombre === 'ancla') { volcar(); partes.push(`<span class="ancla-editor" id="ed-${escAttr(libres[0] || '')}"></span>`); }
      else if (nombre === 'figura' || nombre === 'imagen') {
        volcar();
        const clases = ['fig'];
        if (libres.includes('ancha') || (this.columnas > 1 && !libres.includes('columna'))) clases.push('ancha');
        partes.push(this.figura(libres, op, pie, clases));
      } else if (nombre === 'flotante') {
        volcar();
        partes.push(this.figura(libres, op, pie, ['fig', 'flotante', libres.includes('izquierda') ? 'izquierda' : 'derecha']));
      } else if (['pagina-imagen', 'página-imagen', 'sangre'].includes(nombre)) {
        cerrar();
        const src = libres.find(esRuta) || '';
        let portadilla = '', id = '';
        if (pie.includes('|')) {
          const tr = pie.split('|').map(x => x.trim());
          id = ` id="${slug(tr[0] + '-' + tr[1])}"`;
          portadilla = `<div class="portadilla"><span class="kicker">${inline(tr[0])}</span><h1>${inline(tr[1])}</h1></div>`;
          pie = tr.length > 2 ? tr[2] : '';
        }
        const cap = pie ? `<figcaption>${inline(pie)}</figcaption>` : '';
        const fondo = COLORES[op.fondo || ''] || INK;
        const ajuste = libres.includes('contener') ? 'contain' : 'cover';
        partes.push(`<section class="sangre${portadilla ? ' parte' : ''}"${id} style="background:${fondo}">` +
          `<img src="${this.ruta(src)}" style="object-fit:${ajuste}" alt="${escAttr(pie || 'Ilustración')}">` +
          `<div class="triangulo"></div>${portadilla}${cap}</section>`);
        abrir();
      } else if (nombre === 'apertura' || nombre === 'banner') {
        cerrar();
        const src = libres.find(esRuta) || '';
        const alto = String(op.alto || '88mm').replace(/[^\d.]/g, '') || '88';
        const cols = parseInt(op.columnas || '1', 10) || 1;
        const cap = pie ? `<span class="pie-banner">${inline(pie)}</span>` : '';
        partes.push(`<section class="apertura"><div class="banner" style="--alto-banner:${alto}">` +
          `<img src="${this.ruta(src)}" alt="${escAttr(pie || 'Banner')}">` +
          `<div class="corte"></div><div class="triangulo"></div>${cap}</div>` +
          `<div class="interior cols-${cols}">${this.hijo(contenido, cols)}</div></section>`);
        abrir();
      } else if (nombre === 'recuadro' || nombre === 'nota') {
        volcar();
        const color = libres.find(t => t in COLORES) || 'turquesa';
        const ancho = libres.includes('ancho');
        let titulo = libres.filter(t => !(t in COLORES) && t !== 'ancho').join(' ');
        if (pie) titulo = (titulo + ' ' + pie).trim();
        const tit = titulo ? `<div class="etiqueta">${inline(titulo)}</div>` : '';
        partes.push(`<aside class="recuadro c-${color}${ancho ? ' ancho' : ''}">${tit}${this.hijo(contenido, 1)}</aside>`);
      } else if (nombre === 'leyenda') {
        volcar();
        const color = libres.find(t => t in COLORES) || 'sol';
        let titulo = libres.filter(t => !(t in COLORES) && t !== 'columna').join(' ');
        if (pie) titulo = (titulo + ' ' + pie).trim();
        let idx = contenido.findIndex(l => l.trim() === '+++'); if (idx < 0) idx = contenido.length;
        const izq = contenido.slice(0, idx), der = contenido.slice(idx + 1);
        const rI = this.meta['leyenda-izquierda'] || 'Lo que se cuenta';
        const rD = this.meta['leyenda-derecha'] || 'En el Mundo de Tinieblas';
        const ancho = libres.includes('columna') ? '' : ' ancho';
        partes.push(`<aside class="leyenda c-${color}${ancho}"><div class="cabeza"><span class="etiqueta">Leyenda</span>` +
          `<b>${inline(titulo)}</b></div><div class="paneles">` +
          `<div class="panel popular"><div class="rotulo">${inline(rI)}</div>${this.hijo(izq, 1)}</div>` +
          `<div class="panel tinieblas"><div class="rotulo">${inline(rD)}</div>${this.hijo(der, 1)}</div></div></aside>`);
      } else if (nombre === 'epigrafe' || nombre === 'epígrafe') {
        volcar();
        const cuerpoL = []; let autor = '';
        for (const l of contenido) {
          const t = l.trim();
          if ((t.startsWith('—') || t.startsWith('--') || t.startsWith('- ')) && !autor) autor = t.replace(/^[—-]+/, '').trim();
          else cuerpoL.push(l);
        }
        partes.push(`<div class="epigrafe">${bloquesMd(cuerpoL)}` + (autor ? `<div class="autor">${inline(autor)}</div>` : '') + '</div>');
      } else if (nombre === 'cita') {
        volcar();
        partes.push(`<blockquote class="destacada${libres.includes('ancho') ? ' ancho' : ''}">${bloquesMd(contenido)}</blockquote>`);
      }
    }
    cerrar();
    return partes.join('\n');
  }
}

/* ===================================================================== estado */
const COLOR_OPC = [['turquesa', 'Turquesa'], ['coral', 'Coral'], ['sol', 'Sol'], ['tinta', 'Tinta'], ['crema', 'Crema']];
const NOMBRE_DIVISOR = { cinta: 'Cinta de colores', destellos: 'Destellos', dados: 'Dados', puntos: 'Puntos', escalon: 'Escalones',
  camino: 'Camino con meeple', tazon: 'Tazón con vapor', luna: 'Luna y estrellas', greca: 'Greca muisca', zarpazo: 'Zarpazo' };
const OPC_DIVISOR = [['diagonal', 'Diagonal clásica'], ...(R.divisores || []).map(n => [n, NOMBRE_DIVISOR[n] || n])];
const COLS_OPC = [['1', 'Una columna'], ['2', 'Dos columnas'], ['3', 'Tres columnas']];

const TIPOS = {
  capitulo: { n: 'Capítulo', ico: '§', d: 'Título con letra capitular y su texto.',
    campos: [['kicker', 'text', 'Antetítulo', { ph: 'Capítulo 1', medio: 1 }], ['titulo', 'text', 'Título', { ph: 'El árbol', medio: 1 }],
      ['texto', 'area', 'Texto', { ph: 'Pega aquí el texto. Cada línea es un párrafo. **negrita**, *cursiva*, ## subtítulo, - lista' }]] },
  texto: { n: 'Texto', ico: '¶', d: 'Párrafos sueltos, sin título.',
    campos: [['texto', 'area', 'Texto', { ph: 'Pega aquí el texto…' }]] },
  columnas: { n: 'Columnas', ico: '‖', d: 'Cambia a 1, 2 o 3 columnas desde aquí.',
    campos: [['cols', 'select', 'Columnas', { opc: COLS_OPC, medio: 1 }], ['pagina', 'check', 'Empezar en página nueva', { medio: 1 }]] },
  imagen: { n: 'Imagen', ico: '▣', d: 'En el texto, a todo el ancho o flotante con texto alrededor.',
    campos: [['img', 'img', 'Imagen'], ['pie', 'text', 'Pie de imagen', { ph: 'Opcional' }],
      ['modo', 'select', 'Posición', { opc: [['normal', 'En el texto'], ['ancha', 'A todo el ancho (cruza columnas)'], ['columna', 'Dentro de una columna'],
        ['izquierda', 'Flotante a la izquierda'], ['derecha', 'Flotante a la derecha']], medio: 1 }],
      ['ancho', 'range', 'Ancho', { min: 20, max: 100, paso: 2, suf: '%', medio: 1 }],
      ['alto', 'text', 'Recortar a un alto', { ph: 'ej. 60mm (vacío = natural)', medio: 1 }], ['marco', 'check', 'Con marco y sombra', { medio: 1 }]] },
  sangre: { n: 'Página completa', ico: '◼', d: 'Imagen a toda la página. Con título se vuelve portadilla de parte.',
    campos: [['img', 'img', 'Imagen'], ['kicker', 'text', 'Parte (opcional)', { ph: 'Parte I', medio: 1 }],
      ['titulo', 'text', 'Título de la parte', { ph: 'El humedal.', medio: 1 }], ['pie', 'text', 'Pie de imagen', { ph: 'Opcional' }],
      ['fondo', 'select', 'Color de fondo', { opc: COLOR_OPC, medio: 1 }],
      ['ajuste', 'select', 'Ajuste', { opc: [['cover', 'Llenar toda la página'], ['contain', 'Mostrar la imagen completa']], medio: 1 }]] },
  apertura: { n: 'Apertura con banner', ico: '▀', d: 'Página que abre con un banner a sangre y el capítulo debajo.',
    campos: [['img', 'img', 'Imagen del banner'], ['alto', 'range', 'Alto del banner', { min: 50, max: 160, paso: 2, suf: ' mm', medio: 1 }],
      ['pie', 'text', 'Pie del banner', { ph: 'Opcional', medio: 1 }], ['kicker', 'text', 'Antetítulo', { ph: 'Capítulo 2', medio: 1 }],
      ['titulo', 'text', 'Título', { ph: 'La casa de las puertas', medio: 1 }], ['texto', 'area', 'Texto', { ph: 'Pega aquí el texto…' }],
      ['cols', 'select', 'Columnas del texto', { opc: COLS_OPC, medio: 1 }]] },
  recuadro: { n: 'Recuadro', ico: '▢', d: 'Caja destacada: notas, reglas, consejos para la mesa.',
    campos: [['titulo', 'text', 'Etiqueta', { ph: 'Para la mesa', medio: 1 }], ['color', 'select', 'Color', { opc: COLOR_OPC, medio: 1 }],
      ['texto', 'area', 'Texto', { ph: 'Pega aquí el texto…' }], ['ancho', 'check', 'A todo el ancho (cruza columnas)']] },
  leyenda: { n: 'Leyenda', ico: '◧', d: 'Dos paneles: lo que se cuenta y su versión en el Mundo de Tinieblas.',
    campos: [['titulo', 'text', 'Título', { ph: 'La Llorona', medio: 1 }], ['color', 'select', 'Color', { opc: COLOR_OPC, medio: 1 }],
      ['popular', 'area', 'Panel izquierdo (lo que se cuenta)', { corta: 1 }], ['tinieblas', 'area', 'Panel derecho (en el Mundo de Tinieblas)', { corta: 1 }],
      ['ancho', 'check', 'A todo el ancho, paneles lado a lado']] },
  cita: { n: 'Cita destacada', ico: '❝', d: 'Frase grande entre dos divisores.',
    campos: [['texto', 'area', 'Cita', { corta: 1 }], ['ancho', 'check', 'A todo el ancho']] },
  epigrafe: { n: 'Epígrafe', ico: '“', d: 'Cita breve en cursiva con su autor.',
    campos: [['texto', 'area', 'Texto', { corta: 1 }], ['autor', 'text', 'Autor o fuente', { ph: 'Dicho popular' }]] },
  divisor: { n: 'Divisor', ico: '⟋', d: 'Separa escenas: cinta, destellos, dados, luna, greca…',
    campos: [['estilo', 'select', 'Estilo', { opc: [['', 'Como el documento'], ...OPC_DIVISOR] }]] },
  salto: { n: 'Salto de página', ico: '⤓', d: 'Lo siguiente empieza en una página nueva.', campos: [] },
  espacio: { n: 'Espacio', ico: '↕', d: 'Aire vertical.', campos: [['alto', 'text', 'Alto', { ph: '10mm' }]] },
};
const DEFECTOS = {
  capitulo: { kicker: '', titulo: '', texto: '' }, texto: { texto: '' }, columnas: { cols: '2', pagina: false },
  imagen: { img: '', pie: '', modo: 'normal', ancho: 100, alto: '', marco: true },
  sangre: { img: '', kicker: '', titulo: '', pie: '', fondo: 'tinta', ajuste: 'cover' },
  apertura: { img: '', alto: 88, pie: '', kicker: '', titulo: '', texto: '', cols: '1' },
  recuadro: { titulo: '', color: 'turquesa', texto: '', ancho: false },
  leyenda: { titulo: '', color: 'sol', popular: '', tinieblas: '', ancho: true },
  cita: { texto: '', ancho: false }, epigrafe: { texto: '', autor: '' }, divisor: { estilo: '' }, salto: {}, espacio: { alto: '10mm' },
};
const AJUSTES_DEF = {
  portadaOn: true, titulo: 'Título de la historia', subtitulo: '', etiqueta: 'Historias', autoria: '', fecha: '',
  color: 'turquesa', colorInf: 'coral', portadaImg: '', coleccion: 'Tazón para Dos · Historias', cabecera: '', pie: '',
  columnas: '1', divisor: 'diagonal', leyIzq: 'Lo que se cuenta', leyDer: 'En el Mundo de Tinieblas',
  contraOn: true, contraTexto: '', creditos: '', tema: 'tazon',
};
let S = { v: 1, ajustes: { ...AJUSTES_DEF }, bloques: [], imgs: {} };
let activo = null;
const bloque = (tipo, datos = {}) => ({ id: nuevoId(), tipo, ...structuredClone(DEFECTOS[tipo]), ...datos });

/* ===================================================================== bloques -> Markdown */
const una = s => String(s || '').replace(/[|\r\n]+/g, ' / ').trim();
const seguro = s => String(s || '').replace(/\r/g, '').replace(/ /g, ' ').replace(/^(\s*):::/gm, '$1::​:');
function parrafos(t) {
  // Texto pegado (Word, Docs, WhatsApp…): cada salto de línea es un párrafo nuevo, salvo listas y citas seguidas.
  const L = seguro(t).split('\n'), out = [];
  const esLista = l => /^\s*([-*+]|\d+[.)])\s+/.test(l), esCita = l => /^\s*>/.test(l);
  for (let k = 0; k < L.length; k++) {
    const l = L[k].replace(/\t/g, ' ');
    out.push(l);
    const sig = L[k + 1];
    if (sig === undefined || !l.trim() || !sig.trim()) continue;
    if ((esLista(l) && esLista(sig)) || (esCita(l) && esCita(sig)) || l.endsWith('  ')) continue;
    out.push('');
  }
  return out.join('\n');
}
const ref = b => b.img || '';
// En la vista previa los campos vacíos muestran un texto guía, para poder hacer clic y escribir ahí.
const GUIA = 'Escribe aquí…', GUIA_TITULO = 'Título';
function aMarkdown(b, ancla) {
  const L = [];
  if (ancla) {
    L.push(`::: ancla ${b.id}`);
    const g = {};
    for (const k of ['texto', 'popular', 'tinieblas']) if (k in b && !String(b[k]).trim()) g[k] = GUIA;
    if (b.tipo === 'capitulo' && !String(b.titulo).trim()) g.titulo = GUIA_TITULO;
    b = { ...b, ...g };
  }
  const tit = (k, t) => t ? (k ? `# ${una(k)} | ${una(t)}` : `# ${una(t)}`) : '';
  switch (b.tipo) {
    case 'capitulo': L.push('', tit(b.kicker, b.titulo), '', parrafos(b.texto), ''); break;
    case 'texto': L.push('', parrafos(b.texto), ''); break;
    case 'columnas': L.push(`::: columnas ${b.cols}${b.pagina ? ' pagina' : ''}`); break;
    case 'imagen': {
      const src = ref(b) || 'marca:__vacia';
      const ops = [src];
      if (b.modo === 'izquierda' || b.modo === 'derecha') ops.unshift(b.modo);
      else if (b.modo === 'ancha' || b.modo === 'columna') ops.push(b.modo);
      if (b.modo === 'izquierda' || b.modo === 'derecha' || +b.ancho < 100) ops.push(`${+b.ancho || 44}%`);
      if (!b.marco) ops.push('sin-marco');
      if (una(b.alto)) ops.push(`alto=${una(b.alto).replace(/\s+/g, '')}`);
      const dir = (b.modo === 'izquierda' || b.modo === 'derecha') ? 'flotante' : 'figura';
      L.push(`::: ${dir} ${ops.join(' ')}${b.pie ? ' | ' + una(b.pie) : ''}`);
      break;
    }
    case 'sangre': {
      const ops = [ref(b) || 'marca:__vacia', `fondo=${b.fondo}`];
      if (b.ajuste === 'contain') ops.push('contener');
      let p = '';
      if (b.kicker || b.titulo) p = ` | ${una(b.kicker) || ' '} | ${una(b.titulo)}${b.pie ? ' | ' + una(b.pie) : ''}`;
      else if (b.pie) p = ` | ${una(b.pie)}`;
      L.push(`::: pagina-imagen ${ops.join(' ')}${p}`);
      break;
    }
    case 'apertura':
      L.push(`::: apertura ${ref(b) || 'marca:__vacia'} alto=${+b.alto || 88}mm columnas=${b.cols}${b.pie ? ' | ' + una(b.pie) : ''}`,
        tit(b.kicker, b.titulo), '', parrafos(b.texto), ':::');
      break;
    case 'recuadro':
      L.push(`::: recuadro ${b.color}${b.ancho ? ' ancho' : ''}${b.titulo ? ' | ' + una(b.titulo) : ''}`, parrafos(b.texto), ':::');
      break;
    case 'leyenda':
      L.push(`::: leyenda ${b.color}${b.ancho ? '' : ' columna'} | ${una(b.titulo)}`, parrafos(b.popular), '+++', parrafos(b.tinieblas), ':::');
      break;
    case 'cita': L.push(`::: cita${b.ancho ? ' ancho' : ''}`, parrafos(b.texto), ':::'); break;
    case 'epigrafe': L.push('::: epigrafe', parrafos(b.texto), ...(b.autor ? ['— ' + una(b.autor)] : []), ':::'); break;
    case 'divisor': L.push(`::: divisor ${b.estilo || ''}`.trim()); break;
    case 'salto': L.push('::: salto'); break;
    case 'espacio': L.push(`::: espacio ${una(b.alto).replace(/\s+/g, '') || '10mm'}`); break;
  }
  return L.join('\n');
}

/* ===================================================================== HTML del documento */
function construir(vista) {
  const a = S.ajustes;
  divisorDefecto = a.divisor === 'diagonal' ? '' : (a.divisor || '');
  const meta = { titulo: a.titulo, columnas: a.columnas, 'leyenda-izquierda': a.leyIzq, 'leyenda-derecha': a.leyDer };
  const res = resolver(vista);
  const lineas = S.bloques.map(b => aMarkdown(b, vista)).join('\n').split('\n');
  const rd = new Render(meta, lineas, res);
  const cuerpo = rd.cuerpo();
  const portada = a.portadaOn && a.titulo ? `
<section class="portada" style="background-image:url(&quot;${bloqueDiagonal(COLORES[a.color] || COLORES.turquesa, COLORES[a.colorInf] || COLORES.coral, 297, 0.70)}&quot;)">
  <div class="puntos"></div>
  <div class="triangulo grande"></div>
  <header class="marca">
    <img src="${R.marca.sello}" alt="Sello Tazón para Dos">
    <div><b>TAZÓN PARA DOS</b><span>ESPACIO CULTURAL · ENGATIVÁ</span></div>
  </header>
  <div class="etiqueta-portada">${inline(a.etiqueta || 'HISTORIAS')}</div>
  <h1 class="titulo-portada">${inline(a.titulo)}</h1>
  <p class="subtitulo-portada" style="${a.subtitulo ? '' : 'display:none;'}--sub:calc(${altoSub(a.titulo)}*var(--mm))">${inline(a.subtitulo || '')}</p>
  ${a.portadaImg ? `<img class="heroe" src="${res(a.portadaImg)}" alt="Ilustración de portada">` : ''}
  <footer class="creditos">
    <span${a.autoria ? '' : ' style="visibility:hidden"'}>${inline(a.autoria || '')}</span>
    <span${a.fecha ? '' : ' style="visibility:hidden"'}>${inline(a.fecha || '')}</span>
  </footer>
</section>` : '';
  const parrafosC = String(a.contraTexto || '').split('\n').filter(p => p.trim()).map(p => `<p>${inline(p)}</p>`).join('');
  const contra = a.contraOn && (parrafosC || a.creditos) ? `
<section class="contraportada">
  <img class="d20" src="${R.marca.d20}" alt="">
  <div class="texto">${parrafosC}</div>
  ${a.creditos ? `<div class="creditos-final">${inline(a.creditos)}</div>` : ''}
  <div class="cierre">
    <img src="${R.marca['logotipo-horizontal-inverso']}" alt="Tazón para Dos">
    <span>JUGAR TAMBIÉN ES ESCUCHAR.</span>
  </div>
</section>` : '';
  const indice = indiceDe(cuerpo);
  const cab = a.cabecera || a.titulo || '';
  const html = `<header class="barra"><a href="#indice"><img src="${R.marca.sello}" alt=""><b>TAZÓN PARA DOS</b></a>` +
    `<span>${inline(cab)}</span><a class="btn" href="#indice">Índice</a></header>` +
    `<main class="libro">${portada}\n${indice}\n${cuerpo}\n${contra}</main>` +
    `<a class="volver" href="#indice" aria-label="Volver al índice">↑</a>`;
  const base = R.css.replace('"__CAB_IZQ__"', cssStr(a.coleccion || 'TAZÓN PARA DOS · HISTORIAS'))
    .replace('"__CAB_DER__"', cssStr(cab)).replace('"__PIE__"', cssStr(a.pie || a.etiqueta || '')) + R.webcss;
  return { html, base, tema: R.temas[a.tema] || '' };
}
// El subtítulo baja según las líneas que ocupa el título (≈18 caracteres por línea en la portada).
function lineasTitulo(t, por = 18) {
  let n = 1, ancho = 0;
  for (const w of String(t).replace(/[*_`]/g, '').split(/\s+/).filter(Boolean)) {
    if (ancho && ancho + 1 + w.length > por) { n++; ancho = w.length; } else ancho += (ancho ? 1 : 0) + w.length;
  }
  return n;
}
const altoSub = t => Math.max(86, 56 + lineasTitulo(t) * 16.8 + 8).toFixed(1);
function indiceDe(cuerpo) {
  const items = [];
  const re = /<section class="sangre parte" id="([^"]+)".*?<span class="kicker">(.*?)<\/span><h1>(.*?)<\/h1>|<header class="capitulo" id="([^"]+)">(?:<span class="kicker">(.*?)<\/span>)?<h1>(.*?)<\/h1>/gs;
  for (const m of cuerpo.matchAll(re)) items.push(m[1] ? ['parte', m[1], m[2], m[3]] : ['cap', m[4], m[5] || '', m[6]]);
  if (!items.length) return '';
  const limpio = x => x.replace(/<[^>]+>/g, '').replace(/­/g, '');
  return `<nav class="indice" id="indice"><div class="etiqueta">Índice</div><ol>` +
    items.map(([t, i, k, hh]) => `<li class="${t}"><a href="#${i}"><span class="k">${limpio(k)}</span><span class="t">${limpio(hh)}</span></a></li>`).join('') +
    `</ol></nav>`;
}
function documento({ imprimir = false } = {}) {
  const r = construir(false), a = S.ajustes;
  return `<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${esc(a.titulo || 'Historia')}</title><meta name="generator" content="Editor de historias · Tazón para Dos">` +
    `<style>${fontCss()}</style><style>${r.base}</style><style>${r.tema}</style>` +
    (imprimir ? `<script>addEventListener('load',()=>setTimeout(()=>print(),700))<\/script>` : '') +
    `</head><body class="web">${r.html}</body></html>`;
}

/* ===================================================================== vista previa */
const vista = $('#vista');
let vistaLista = false, ultBase = '', ultTema = '';
function prepararVista() {
  vista.srcdoc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${fontCss()}</style><style id="base"></style><style id="tema"></style>` +
    `<style>.ancla-editor{display:block;height:0;scroll-margin-top:70px}` +
    `[contenteditable]{cursor:text;border-radius:3px}` +
    `[contenteditable]:hover{outline:1.5px dashed rgba(234,96,119,.85);outline-offset:3px}` +
    `[contenteditable]:focus{outline:2.5px solid #55C4BF;outline-offset:3px}` +
    `[data-guia]{opacity:.45;font-style:italic}` +
    `img.img-editable{cursor:pointer} img.img-editable:hover{filter:brightness(.9)}</style></head><body class="web"></body></html>`;
  vista.addEventListener('load', () => { vistaLista = true; ultBase = ultTema = ''; conectarVista(vista.contentDocument); actualizarVista(); }, { once: true });
}
function actualizarVista() {
  if (!vistaLista) return;
  const d = vista.contentDocument; if (!d || !d.getElementById('base')) return;
  if (escribiendo(d.activeElement)) { pendienteVista = true; return; }  // no maquetar bajo el cursor
  const r = construir(true);
  if (r.base !== ultBase) { d.getElementById('base').textContent = r.base; ultBase = r.base; }
  if (r.tema !== ultTema) { d.getElementById('tema').textContent = r.tema; ultTema = r.tema; }
  const se = d.scrollingElement, y = se ? se.scrollTop : 0;
  d.body.innerHTML = r.html;
  marcarEditables(d);
  if (se) se.scrollTop = y;
  d.querySelectorAll('a[href^="#"]').forEach(x => x.addEventListener('click', e => {
    e.preventDefault(); const t = d.getElementById(x.getAttribute('href').slice(1)); if (t) t.scrollIntoView({ behavior: 'smooth' });
  }));
}
function irA(id) {
  const d = vista.contentDocument; const t = d && d.getElementById('ed-' + id);
  if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ===================================================================== editar el texto en la vista previa */
// Cada texto de la vista se marca con su bloque (data-b) y su campo (data-f). Al escribir en la vista se
// reconstruye el campo y se copia al formulario; al salir del texto se vuelve a maquetar (guiones, capitular…).
const EDITABLES = 'p,li,h1,h2,h3,h4,figcaption,.kicker,.etiqueta,.cabeza b,.autor,.pie-banner';
const MULTI = new Set(['texto', 'popular', 'tinieblas', 'contraTexto']);
function campoDe(b, el) {
  const t = b.tipo;
  if (el.matches('header.capitulo h1, .portadilla h1')) return 'titulo';
  if (el.matches('header.capitulo .kicker, .portadilla .kicker')) return 'kicker';
  if (el.matches('figcaption, .pie-banner')) return 'pie';
  if (t === 'recuadro') return el.matches('.etiqueta') ? 'titulo' : 'texto';
  if (t === 'leyenda') {
    if (el.matches('.cabeza b')) return 'titulo';
    if (el.closest('.rotulo') || el.matches('.cabeza .etiqueta')) return null;
    return el.closest('.panel.popular') ? 'popular' : el.closest('.panel.tinieblas') ? 'tinieblas' : null;
  }
  if (t === 'epigrafe') return el.matches('.autor') ? 'autor' : 'texto';
  if (['capitulo', 'texto', 'apertura', 'cita'].includes(t)) return el.matches('.etiqueta,.autor') ? null : 'texto';
  return null;
}
function marcarEditables(d) {
  const libro = d.querySelector('main.libro'); if (!libro) return;
  const fijos = [['.titulo-portada', 'titulo'], ['.subtitulo-portada', 'subtitulo'], ['.etiqueta-portada', 'etiqueta'],
    ['.portada .creditos span:first-child', 'autoria'], ['.portada .creditos span:last-child', 'fecha'],
    ['.contraportada .texto p', 'contraTexto'], ['.contraportada .creditos-final', 'creditos']];
  for (const [sel, f] of fijos) libro.querySelectorAll(sel).forEach(el => { el.contentEditable = 'true'; el.dataset.b = '@'; el.dataset.f = f; });
  let actual = null;
  const tw = d.createTreeWalker(libro, NodeFilter.SHOW_ELEMENT);
  for (let el = tw.nextNode(); el; el = tw.nextNode()) {
    if (el.classList.contains('ancla-editor')) { actual = S.bloques.find(b => 'ed-' + b.id === el.id) || null; continue; }
    if (!actual || el.closest('section.portada,section.contraportada,nav.indice')) continue;
    if (el.tagName === 'IMG' && 'img' in actual) { el.dataset.b = actual.id; el.classList.add('img-editable'); el.title = 'Clic para cambiar la imagen'; continue; }
    if (!el.matches(EDITABLES) || el.parentElement.closest('[data-f]')) continue;
    const f = campoDe(actual, el); if (!f) continue;
    el.contentEditable = 'true'; el.spellcheck = true; el.dataset.b = actual.id; el.dataset.f = f;
    const txt = el.textContent.replace(/­/g, '').trim();
    if ((txt === GUIA || (f === 'titulo' && txt === GUIA_TITULO)) && !String(actual[f] || '').trim()) el.dataset.guia = '1';
  }
}
function lineasDe(el) {
  const inl = n => {
    if (n.nodeType === 3) return n.nodeValue;
    if (n.nodeType !== 1) return '';
    if (n.tagName === 'BR') return '\n';
    const dentro = [...n.childNodes].map(inl).join('');
    if (!dentro.trim()) return dentro;
    switch (n.tagName) {
      case 'STRONG': case 'B': return `**${dentro}**`;
      case 'EM': case 'I': return `*${dentro}*`;
      case 'CODE': return '`' + dentro + '`';
      case 'A': return `[${dentro}](${n.getAttribute('href') || ''})`;
      case 'DIV': case 'P': return '\n' + dentro + '\n';
      default: return dentro;
    }
  };
  return [...el.childNodes].map(inl).join('').split('\n')
    .map(l => l.replace(/­/g, '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
}
function valorCampo(d, id, f, el) {
  if (!MULTI.has(f)) return lineasDe(el).join(' ');
  const L = [];
  for (const x of d.querySelectorAll(`[data-b="${id}"][data-f="${f}"]`)) {
    let pre = '';
    if (x.tagName === 'LI') pre = x.parentElement.tagName === 'OL' ? '1. ' : '- ';
    else if (/^H[2-4]$/.test(x.tagName)) pre = '#'.repeat(+x.tagName[1]) + ' ';
    else if (x.tagName === 'P' && x.closest('blockquote:not(.destacada)')) pre = '> ';
    lineasDe(x).forEach((l, k) => L.push((k === 0 || pre === '> ' ? pre : '') + l));
  }
  return L.join('\n');
}
function sincronizarFormulario(id, f, v) {
  const tarjetaEl = id === '@' ? $$('.tarjeta.fija').find(t => t.querySelector(`[data-k="${f}"]`)) : document.querySelector(`.tarjeta[data-id="${id}"]`);
  const campoEl = tarjetaEl?.querySelector(`[data-k="${f}"]`);
  if (campoEl && campoEl !== document.activeElement) campoEl.value = v;
  const b = S.bloques.find(x => x.id === id); if (b) resumir(b);
}
let pendienteVista = false;
function conectarVista(d) {
  d.addEventListener('input', e => {
    const el = e.target.closest?.('[data-f]'); if (!el) return;
    const id = el.dataset.b, f = el.dataset.f, v = valorCampo(d, id, f, el);
    if (id === '@') S.ajustes[f] = v;
    else { const b = S.bloques.find(x => x.id === id); if (!b) return; b[f] = v; }
    pendienteVista = true;
    sincronizarFormulario(id, f, v);
    clearTimeout(tGuardar); tGuardar = setTimeout(guardarLocal, 900);
  });
  d.addEventListener('focusin', e => {
    const el = e.target.closest?.('[data-f]'); if (!el) return;
    if (el.dataset.b !== '@') activar(el.dataset.b, true);
    if (el.dataset.guia) { el.textContent = ''; delete el.dataset.guia; }
    if (!pendienteVista) instantanea();
  });
  d.addEventListener('focusout', () => setTimeout(() => {
    if (escribiendo(d.activeElement)) return;  // pasó a otro texto de la vista: se maqueta al salir del todo
    if (pendienteVista) { pendienteVista = false; actualizarVista(); }
  }, 120));
  d.addEventListener('keydown', e => {
    const el = e.target.closest?.('[data-f]'); if (!el) return;
    if (e.key === 'Escape') { el.blur(); return; }
    if (e.key === 'Enter' && !MULTI.has(el.dataset.f)) { e.preventDefault(); el.blur(); }
    if ((e.ctrlKey || e.metaKey) && ['b', 'i'].includes(e.key.toLowerCase())) { e.preventDefault(); d.execCommand(e.key.toLowerCase() === 'b' ? 'bold' : 'italic'); }
  });
  d.addEventListener('paste', e => {
    const el = e.target.closest?.('[data-f]'); if (!el) return;
    e.preventDefault();  // solo texto: el formato pegado de otra app rompería la plantilla
    d.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  });
  d.addEventListener('click', e => {
    const img = e.target.closest?.('img.img-editable'); if (!img) return;
    const b = S.bloques.find(x => x.id === img.dataset.b); if (!b) return;
    activar(b.id, true);
    destinoArchivo = { set: v => { b.img = v; } }; $('#f-imagen').click();
  });
}

document.addEventListener('paste', e => {
  const f = [...(e.clipboardData?.files || [])].find(x => x.type.startsWith('image/'));
  if (!f) return;
  // Word y otros copian el texto también como imagen: en un campo de texto manda el texto.
  if (document.activeElement?.matches?.('textarea,input') && e.clipboardData.getData('text/plain').trim()) return;
  const slot = document.activeElement?.closest?.('.slot');
  e.preventDefault();
  if (slot) return ponerImagen(slot._destino, f);
  // Imagen pegada fuera de un hueco: va al bloque activo si tiene imagen, o se crea un bloque Imagen debajo.
  const b = S.bloques.find(x => x.id === activo);
  if (b && 'img' in b) return ponerImagen({ set: v => { b.img = v; } }, f);
  const nb = bloque('imagen');
  const i = b ? S.bloques.indexOf(b) + 1 : S.bloques.length;
  instantanea(); S.bloques.splice(i, 0, nb); activo = nb.id;
  ponerImagen({ set: v => { nb.img = v; } }, f);
});

function resumenDe(b) {
  const t = b.titulo || b.texto || b.pie || b.popular || '';
  if (b.tipo === 'columnas') return `${b.cols} columna${b.cols === '1' ? '' : 's'}${b.pagina ? ' · página nueva' : ''}`;
  if (b.tipo === 'imagen') return (b.img ? '' : 'sin imagen · ') + ({ normal: 'en el texto', ancha: 'a todo el ancho', columna: 'en la columna', izquierda: 'flotante izquierda', derecha: 'flotante derecha' })[b.modo];
  return String(t).replace(/\s+/g, ' ').slice(0, 70);
}
function resumir(b) { const el = document.querySelector(`[data-id="${b.id}"] .resumen`); if (el) el.textContent = resumenDe(b); }

const plegados = new Set();
function tarjeta(b, i) {
  const T = TIPOS[b.tipo];
  const mover = d => { const j = i + d; if (j < 0 || j >= S.bloques.length) return; instantanea(); [S.bloques[i], S.bloques[j]] = [S.bloques[j], S.bloques[i]]; pintar(); cambio(); };
  const ctl = (txt, title, fn, cls) => h('button', { class: 'ic' + (cls ? ' ' + cls : ''), type: 'button', title, 'aria-label': title, onclick: e => { e.stopPropagation(); fn(); } }, txt);
  const el = h('section', { class: 'tarjeta' + (plegados.has(b.id) ? ' plegada' : '') + (activo === b.id ? ' activa' : ''), 'data-id': b.id },
    h('header', { onclick: () => { plegados.has(b.id) ? plegados.delete(b.id) : plegados.add(b.id); el.classList.toggle('plegada'); activar(b.id); } },
      h('span', { class: 'tipo' }, T.ico + ' ' + T.n), h('span', { class: 'resumen' }, resumenDe(b)),
      h('span', { class: 'ctl' },
        ctl('↑', 'Subir', () => mover(-1)), ctl('↓', 'Bajar', () => mover(1)),
        ctl('⧉', 'Duplicar', () => { instantanea(); const c = { ...structuredClone(b), id: nuevoId() }; S.bloques.splice(i + 1, 0, c); activo = c.id; pintar(); cambio(); aviso('Bloque duplicado'); }),
        ctl('✕', 'Borrar', () => { instantanea(); S.bloques.splice(i, 1); if (activo === b.id) activo = null; pintar(); cambio(); aviso('Bloque borrado · «Deshacer» o Ctrl+Z lo recupera'); }, 'borrar'))),
    T.campos.length ? h('div', { class: 'campos' }, T.campos.map(c => campo(b, c))) : h('div', { class: 'campos' }, h('p', { class: 'ayuda' }, T.d)));
  el.addEventListener('focusin', () => activar(b.id));
  return el;
}
function activar(id, desdeVista = false) {
  if (activo === id) return;
  activo = id;
  $$('.tarjeta[data-id]').forEach(t => t.classList.toggle('activa', t.dataset.id === id));
  if (desdeVista) document.querySelector(`.tarjeta[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  else irA(id);
}
function insertador(pos) {
  return h('div', { class: 'insertar' }, h('button', { type: 'button', onclick: e => abrirMenuBloques(e.currentTarget, pos) }, '+ insertar aquí'));
}
function agregar(tipo, pos = S.bloques.length) {
  instantanea();
  const b = bloque(tipo); S.bloques.splice(pos, 0, b); activo = b.id; plegados.delete(b.id); pintar(); cambio();
  aviso(TIPOS[tipo].n + ' añadido');
  setTimeout(() => irA(b.id), 400);
  requestAnimationFrame(() => { const t = document.querySelector(`[data-id="${b.id}"]`); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.querySelector('textarea,input[type=text],.slot')?.focus({ preventScroll: true }); } });
}

const A_PORTADA = [
  ['portadaOn', 'check', 'Mostrar portada'], ['titulo', 'text', 'Título', { ph: 'La Puerta del Sol.' }],
  ['subtitulo', 'text', 'Subtítulo', { ph: 'Leyendas de Engativá…' }], ['etiqueta', 'text', 'Etiqueta', { ph: 'Historias', medio: 1 }],
  ['fecha', 'text', 'Fecha', { ph: 'Octubre 2026', medio: 1 }], ['autoria', 'text', 'Autoría', { ph: 'Texto e ilustraciones: …' }],
  ['color', 'select', 'Color de arriba', { opc: COLOR_OPC, medio: 1 }], ['colorInf', 'select', 'Color de abajo', { opc: COLOR_OPC, medio: 1 }],
  ['portadaImg', 'img', 'Ilustración de portada'],
];
const A_DOC = [
  ['columnas', 'select', 'Columnas al empezar', { opc: COLS_OPC, medio: 1 }], ['divisor', 'select', 'Estilo de divisor', { opc: OPC_DIVISOR, medio: 1 }], ['coleccion', 'text', 'Cabecera izquierda', { medio: 1 }],
  ['cabecera', 'text', 'Cabecera derecha', { ph: 'Por defecto, el título', medio: 1 }], ['pie', 'text', 'Pie de página', { ph: 'Por defecto, la etiqueta', medio: 1 }],
  ['leyIzq', 'text', 'Leyendas · rótulo izquierdo', { medio: 1 }], ['leyDer', 'text', 'Leyendas · rótulo derecho', { medio: 1 }],
];
const A_CONTRA = [
  ['contraOn', 'check', 'Mostrar contraportada'],
  ['contraTexto', 'area', 'Texto (la primera línea va grande)', { corta: 1, ph: 'Una frase que invite a leer.\nUn párrafo de resumen.' }],
  ['creditos', 'text', 'Créditos', { ph: 'Texto: … · Ilustraciones: … · Fuentes: …' }],
];
function fija(titulo, ico, defs, clave) {
  const el = h('section', { class: 'tarjeta fija' + (plegados.has(clave) ? ' plegada' : '') },
    h('header', { onclick: () => { plegados.has(clave) ? plegados.delete(clave) : plegados.add(clave); el.classList.toggle('plegada'); if (clave === 'portada') vista.contentDocument?.scrollingElement?.scrollTo({ top: 0, behavior: 'smooth' }); } },
      h('span', { class: 'tipo' }, ico + ' ' + titulo), h('span', { class: 'resumen' }, clave === 'portada' ? S.ajustes.titulo : clave === 'contra' ? 'Cierre con el logo' : 'Cabeceras, pies y columnas')),
    h('div', { class: 'campos' }, defs.map(d => campo(S.ajustes, d))));
  return el;
}
function pintar() {
  const ed = $('#editor'), y = ed.scrollTop;
  // replaceChildren no aplana listas: sin .flat() las tarjetas de bloque no se dibujaban.
  ed.replaceChildren(...[
    h('h2', { class: 'seccion' }, 'Inicio'),
    fija('Portada', '★', A_PORTADA, 'portada'),
    fija('Documento', '⚙', A_DOC, 'doc'),
    h('h2', { class: 'seccion' }, 'Historia'),
    S.bloques.length ? null : h('p', { class: 'ayuda' }, 'Aún no hay bloques. Añade uno abajo, elige una plantilla o usa «Pegar historia completa».'),
    S.bloques.flatMap((b, i) => [insertador(i), tarjeta(b, i)]),
    S.bloques.length ? insertador(S.bloques.length) : null,
    h('div', { class: 'anadir' }, h('h3', {}, 'Añadir bloque'),
      h('div', { class: 'botones' }, Object.entries(TIPOS).map(([t, T]) => h('button', { class: 'btn', type: 'button', title: T.d, onclick: () => agregar(t) }, T.ico + ' ' + T.n)))),
    h('h2', { class: 'seccion' }, 'Final'),
    fija('Contraportada', '◆', A_CONTRA, 'contra')].flat(Infinity).filter(Boolean));
  ed.scrollTop = y;
}

function abrirMenuBloques(ancla, pos) {
  const m = $('#menu-bloques');
  m.replaceChildren(...Object.entries(TIPOS).map(([t, T]) => h('button', { type: 'button', onclick: () => { cerrarMenus(); agregar(t, pos); } }, h('b', {}, T.ico + ' ' + T.n), h('span', {}, T.d))));
  posicionar(m, ancla);
}

/* ===================================================================== plantillas */
const TXT = {
  p1: 'Esta es una plantilla: cambia los textos por los tuyos. Pega aquí tu historia; cada línea se vuelve un párrafo y el primero lleva letra capitular.\nPuedes escribir **negrita**, *cursiva* y subtítulos empezando la línea con ## . Las palabras largas se parten solas al justificar.\nLas imágenes se pegan con Ctrl+V dentro del hueco de imagen, se suben con un clic o se arrastran.',
  p2: 'En Engativá dicen que la niebla baja del humedal a las tres de la mañana y que, si uno la escucha con cuidado, cuenta los nombres de quienes vivieron allí antes del cemento.\nLa abuela lo repetía mientras servía el agua de panela: no se le contesta a la niebla, mijo, porque ella siempre quiere conversación.\nEsa noche, sin embargo, la niebla tocó tres veces la puerta.',
};
const PLANTILLAS = {
  corta: { n: 'Historia corta', d: 'Portada, dos capítulos, imagen flotante, cita y contraportada.', f: () => ({
    ajustes: { ...AJUSTES_DEF, titulo: 'La niebla que conversa.', subtitulo: 'Un cuento corto para leer antes de la partida.', etiqueta: 'Historias · relato',
      autoria: 'Texto: tu nombre', fecha: 'Octubre 2026', color: 'turquesa', colorInf: 'coral', portadaImg: 'marca:ilus-portada',
      contraTexto: 'Jugar también es escuchar.\nUn relato de la comunidad Tazón para Dos para leer en voz alta y luego jugar.', creditos: 'Texto: … · Ilustraciones: …' },
    bloques: [bloque('capitulo', { kicker: 'Capítulo 1', titulo: 'Tres golpes.', texto: TXT.p2 + '\n' + TXT.p1 }),
      bloque('imagen', { img: 'marca:ilus-lechuza', modo: 'derecha', ancho: 40, pie: 'La lechuza del Cortijo' }),
      bloque('texto', { texto: TXT.p1 }),
      bloque('cita', { texto: 'No se le contesta a la niebla, porque ella siempre quiere conversación.' }),
      bloque('capitulo', { kicker: 'Capítulo 2', titulo: 'La conversación.', texto: TXT.p2 }),
      bloque('recuadro', { titulo: 'Para la mesa', color: 'sol', texto: 'Usa este recuadro para reglas, consejos o ganchos de partida.\n- Una pista\n- Un personaje\n- Una pregunta abierta' })],
  }) },
  cronica: { n: 'Crónica a dos columnas', d: 'Partes con portadilla, apertura con banner, leyendas, epígrafe e imagen ancha.', f: () => ({
    ajustes: { ...AJUSTES_DEF, titulo: 'Crónicas de la niebla.', subtitulo: 'Leyendas urbanas adaptadas al Mundo de Tinieblas.', etiqueta: 'Historias · Mundo de Tinieblas',
      autoria: 'Texto e ilustraciones: …', fecha: 'Octubre 2026', color: 'tinta', colorInf: 'coral', portadaImg: 'marca:ilus-portada', columnas: '2', tema: 'tinieblas',
      contraTexto: 'Cuando la niebla baja, la ciudad recuerda.\nUna crónica en varias partes para leer y para jugar en Mago, Hombre Lobo y Changeling.', creditos: 'Texto: … · Ilustraciones: … · Fuentes: …' },
    bloques: [bloque('sangre', { img: 'marca:ilus-parte1-arbol', kicker: 'Parte I', titulo: 'El árbol.', fondo: 'tinta', pie: 'La plaza fundacional' }),
      bloque('apertura', { img: 'marca:ilus-banner-equinoccio', alto: 88, kicker: 'Capítulo 1', titulo: 'Duendes en trasteo.', texto: TXT.p2, cols: '2' }),
      bloque('epigrafe', { texto: 'Al árbol viejo no se le cuentan secretos: los repite cuando sopla el viento.', autor: 'Dicho de la plaza' }),
      bloque('texto', { texto: TXT.p1 + '\n' + TXT.p2 }),
      bloque('leyenda', { titulo: 'La Llorona', color: 'coral', popular: 'Una mujer que llora junto al agua buscando a sus hijos. Quien la oye cerca, está lejos; quien la oye lejos, la tiene encima.',
        tinieblas: 'Un espíritu atado a un Nodo del humedal. Los Garou la protegen; la Tecnocracia quiere secarla con el caño.' }),
      bloque('imagen', { img: 'marca:ilus-placa', modo: 'ancha', pie: 'Imagen a todo el ancho, cruzando las dos columnas' }),
      bloque('capitulo', { kicker: 'Capítulo 2', titulo: 'La casa de las puertas.', texto: TXT.p2 }),
      bloque('imagen', { img: 'marca:ilus-casa-puertas', modo: 'izquierda', ancho: 44, pie: 'Flotante con texto alrededor' }),
      bloque('texto', { texto: TXT.p1 }),
      bloque('recuadro', { titulo: 'Ganchos para jugar', color: 'turquesa', ancho: false, texto: '**Mago:** un Nodo despierta bajo la plaza.\n**Hombre Lobo:** el caerne del humedal pierde fuerza.\n**Changeling:** los duendes buscan casa nueva.' })],
  }) },
  todo: { n: 'Todos los bloques', d: 'Un ejemplo de cada tipo, con explicación. Ideal para aprender.', f: () => ({
    ajustes: { ...AJUSTES_DEF, titulo: 'Guía de bloques.', subtitulo: 'Un ejemplo de cada tipo de bloque del editor.', etiqueta: 'Plantilla', autoria: 'Tazón para Dos', fecha: '2026',
      portadaImg: 'marca:ilus-portada', contraTexto: 'Ya conoces todos los bloques.\nAhora borra esta guía, elige una plantilla o pega tu historia completa.', creditos: 'Editor de historias · Tazón para Dos' },
    bloques: [
      bloque('capitulo', { kicker: 'Bloque', titulo: 'Capítulo.', texto: 'Un capítulo tiene antetítulo, título y texto. El primer párrafo lleva letra capitular.\n' + TXT.p1 }),
      bloque('epigrafe', { texto: 'El epígrafe es una cita breve en cursiva con su autor.', autor: 'Bloque Epígrafe' }),
      bloque('texto', { texto: 'El bloque **Texto** añade párrafos sin título.\n## Subtítulo dentro del texto\nTambién admite listas:\n- primer punto\n- segundo punto' }),
      bloque('imagen', { img: 'marca:ilus-bobo-tranvia', modo: 'derecha', ancho: 38, pie: 'Imagen flotante a la derecha' }),
      bloque('texto', { texto: 'Las imágenes flotantes dejan que el texto corra a su alrededor. ' + TXT.p2 }),
      bloque('cita', { texto: 'La cita destacada va grande, entre dos divisores.', ancho: true }),
      bloque('recuadro', { titulo: 'Recuadro', color: 'coral', texto: 'Para notas, reglas o consejos. Elige color y si cruza las columnas.' }),
      bloque('leyenda', { titulo: 'Leyenda', color: 'sol', popular: 'Panel de la versión popular.', tinieblas: 'Panel de la versión en el Mundo de Tinieblas.' }),
      bloque('divisor'),
      bloque('texto', { texto: 'Arriba hay un **divisor**, para separar escenas. El **salto de página** obliga a empezar en una página nueva al imprimir, y el **espacio** añade aire vertical.' }),
      bloque('columnas', { cols: '2', pagina: true }),
      bloque('capitulo', { kicker: 'Bloque', titulo: 'Dos columnas.', texto: 'Desde el bloque **Columnas** el texto corre en dos columnas. ' + TXT.p2 + '\n' + TXT.p1 }),
      bloque('imagen', { img: 'marca:ilus-mohan', modo: 'ancha', pie: 'Imagen ancha: cruza las dos columnas', ancho: 70 }),
      bloque('texto', { texto: TXT.p2 }),
      bloque('columnas', { cols: '1' }),
      bloque('sangre', { img: 'marca:ilus-parte2-humedal', kicker: 'Parte II', titulo: 'Página completa.', pie: 'Portadilla de parte, a sangre' }),
      bloque('apertura', { img: 'marca:ilus-banner-equinoccio', kicker: 'Bloque', titulo: 'Apertura con banner.', texto: 'Una página que empieza con un banner a sangre.\n' + TXT.p1 }),
    ],
  }) },
  blanco: { n: 'En blanco', d: 'Portada y contraportada vacías y un capítulo para empezar.', f: () => ({
    ajustes: { ...AJUSTES_DEF, titulo: 'Título de la historia.', contraTexto: '' }, bloques: [bloque('capitulo', { kicker: 'Capítulo 1' })] }) },
};
function usarPlantilla(k) {
  const p = PLANTILLAS[k].f();
  instantanea();
  S = { v: 1, ajustes: p.ajustes, bloques: p.bloques, imgs: S.imgs };
  activo = null; plegados.clear(); $('#s-tema').value = S.ajustes.tema;
  pintar(); cambio(); vista.contentDocument?.scrollingElement?.scrollTo(0, 0);
  aviso('Plantilla «' + PLANTILLAS[k].n + '» lista: cambia los textos y las imágenes');
}
$('#b-plantillas').addEventListener('click', e => {
  const m = $('#menu-plantillas');
  m.replaceChildren(...Object.entries(PLANTILLAS).map(([k, p]) => h('button', { type: 'button', onclick: () => {
    cerrarMenus();
    usarPlantilla(k);
  } }, h('b', {}, p.n), h('span', {}, p.d))));
  posicionar(m, e.currentTarget);
});

/* ===================================================================== pegar historia completa */
const modal = $('#modal-importar');
$('#b-importar').addEventListener('click', () => { modal.hidden = false; $('#t-importar').focus(); });
modal.addEventListener('click', e => { if (e.target === modal || e.target.hasAttribute('data-cerrar')) modal.hidden = true; });
$('#b-importar-ok').addEventListener('click', () => {
  const txt = $('#t-importar').value.replace(/\r/g, '');
  if (!txt.trim()) return aviso('Pega primero el texto');
  const RE = /^\s*(#\s+.+|(cap[ií]tulo|parte|pr[oó]logo|ep[ií]logo|interludio)\b.{0,90})$/i;
  const nuevos = []; let actual = null;
  for (const linea of txt.split('\n')) {
    if (RE.test(linea) && linea.trim().length < 110) {
      let t = linea.trim().replace(/^#+\s*/, ''), k = '';
      const m = t.match(/^((?:cap[ií]tulo|parte)\s+[\wivxlc]+)\s*[:.\-–—|]?\s*(.*)$/i);
      if (m && m[2]) { k = m[1]; t = m[2]; } else if (m) { k = ''; t = m[1]; }
      actual = bloque('capitulo', { kicker: k, titulo: t, texto: '' }); nuevos.push(actual);
    } else {
      if (!actual) { if (!linea.trim()) continue; actual = bloque('texto', { texto: '' }); nuevos.push(actual); }
      actual.texto += (actual.texto ? '\n' : '') + linea;
    }
  }
  nuevos.forEach(b => { b.texto = b.texto.replace(/\n{2,}/g, '\n').trim(); });
  instantanea();
  if ($('#c-reemplazar').checked) S.bloques = nuevos; else S.bloques.push(...nuevos);
  modal.hidden = true; $('#t-importar').value = '';
  pintar(); cambio();
  aviso(`${nuevos.filter(b => b.tipo === 'capitulo').length} capítulos creados`);
});

/* ===================================================================== exportar */
const nombreArchivo = ext => slug(S.ajustes.titulo || 'historia') + ext;
$('#b-html').addEventListener('click', () => { descargar(nombreArchivo('.html'), documento(), 'text/html'); aviso('HTML descargado: ábrelo en cualquier navegador, también sin internet'); });
$('#b-pdf').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([documento({ imprimir: true })], { type: 'text/html' }));
  const w = window.open(url, '_blank');
  if (!w) { aviso('Permite las ventanas emergentes, o descarga el HTML y usa Ctrl+P'); return; }
  aviso('En el diálogo: «Guardar como PDF», tamaño A4, márgenes predeterminados y «Gráficos de fondo» activado');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});
$('#b-guardar').addEventListener('click', () => { descargar(nombreArchivo('.historia.json'), JSON.stringify(S), 'application/json'); aviso('Proyecto guardado (incluye las imágenes)'); });
$('#b-abrir').addEventListener('click', () => $('#f-proyecto').click());
$('#f-proyecto').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const p = JSON.parse(await f.text());
    if (!p || !Array.isArray(p.bloques)) throw 0;
    S = { v: 1, ajustes: { ...AJUSTES_DEF, ...p.ajustes }, bloques: p.bloques.filter(b => TIPOS[b.tipo]).map(b => ({ ...DEFECTOS[b.tipo], ...b })), imgs: p.imgs || {} };
    $('#s-tema').value = S.ajustes.tema; pintar(); cambio(); aviso('Proyecto abierto');
  } catch (err) { aviso('Ese archivo no es un proyecto del editor'); }
});
$('#s-tema').addEventListener('change', e => { S.ajustes.tema = e.target.value; cambio(); });

/* ===================================================================== inicio */
(async () => {
  const st = h('style'); st.textContent = fontCss(); document.head.append(st);
  $('#sello-ed').src = R.marca['sello-inverso'] || R.marca.sello;
  const conLimite = (pr, ms) => Promise.race([pr, new Promise(r => setTimeout(() => r(null), ms))]);
  await conLimite(abrirDB(), 1500);
  const previo = await conLimite(leerLocal(), 1500);
  const pedida = (location.hash.match(/plantilla=(\w+)/) || [])[1];  // enlace directo: index.html#plantilla=cronica
  if (pedida && PLANTILLAS[pedida]) {
    const p = PLANTILLAS[pedida].f(); S = { v: 1, ajustes: p.ajustes, bloques: p.bloques, imgs: {} };
  } else if (previo && Array.isArray(previo.bloques)) {
    S = { v: 1, ajustes: { ...AJUSTES_DEF, ...previo.ajustes }, bloques: previo.bloques.filter(b => TIPOS[b.tipo]), imgs: previo.imgs || {} };
  } else {
    const p = PLANTILLAS.corta.f(); S = { v: 1, ajustes: p.ajustes, bloques: p.bloques, imgs: {} };
  }
  $('#s-tema').value = S.ajustes.tema;
  $('#b-deshacer').addEventListener('click', deshacer);
  actualizarDeshacer();
  pintar(); prepararVista();
})();
