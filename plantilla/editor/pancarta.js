'use strict';
/* Editor de pancartas · Tazón para Dos
   Reutiliza comun.js (formularios, imágenes, guardado, deshacer, descargas) del editor de historias.
   La pancarta se dibuja como un SVG en milímetros reales: la vista previa, el HTML descargado y el PDF
   impreso son el mismo dibujo, a tamaño de imprenta. Sigue las reglas del kit de marca: 2–3 bloques con
   diagonales que suben a la derecha, franja crema o sol entre bloques, trama de puntos, esquina sol + coral,
   cabecera con el sello y titular en Barlow Condensed 800 con la última línea destacada. */
const NOMBRE_DB = 'editor-pancartas-tazon';

/* ===================================================================== formatos y recetas */
const FORMATOS = [
  ['rollup80', 'Roll-up', 800, 1800], ['rollup85', 'Roll-up grande', 850, 2000], ['pendon', 'Pendón', 600, 1200],
  ['a3', 'Afiche A3', 297, 420], ['a2', 'Afiche A2', 420, 594],
  ['h200', 'Pancarta', 2000, 800], ['h300', 'Pancarta grande', 3000, 1000], ['h150', 'Pasacalle', 1500, 500],
];
const T_ = { tinta: '#28203B', turquesa: '#55C4BF', coral: '#EA6077', sol: '#F8CB67', crema: '#F7F2E8', papel: '#FFFDF8' };
const N_ = { abismo: '#110D18', noche: '#1C1629', niebla: '#2B2340', pergamino: '#E9DDC1', musgo: '#7FA68C', musgoP: '#3E5E50',
  sangre: '#9E3A48', ceniza: '#E07D84', vela: '#E3B35C', luna: '#CFCADF' };
// a = bloque superior, b = bloque de imagen, c = cierre; f1/f2 = franjas; tit/des/som = titular, línea destacada y su sombra
const RECETAS = {
  general: { n: 'General · rol', a: T_.turquesa, b: T_.coral, c: T_.tinta, f1: T_.crema, f2: T_.sol, tit: T_.tinta, des: T_.crema, som: T_.tinta,
    pill: T_.tinta, pillT: T_.crema, cta: T_.crema, cta2: T_.sol, ic: [T_.turquesa, T_.coral, T_.sol], icT: T_.tinta, us: T_.sol,
    esq: [T_.sol, T_.coral], pt: 'rgba(40,32,59,.10)', ptC: 'rgba(247,242,232,.08)', texto: T_.tinta, oscuro: false },
  mesa: { n: 'Juegos de mesa', a: T_.coral, b: T_.turquesa, c: T_.tinta, f1: T_.crema, f2: T_.sol, tit: T_.tinta, des: T_.crema, som: T_.tinta,
    pill: T_.tinta, pillT: T_.crema, cta: T_.crema, cta2: T_.sol, ic: [T_.coral, T_.turquesa, T_.sol], icT: T_.tinta, us: T_.sol,
    esq: [T_.sol, T_.turquesa], pt: 'rgba(40,32,59,.10)', ptC: 'rgba(247,242,232,.08)', texto: T_.tinta, oscuro: false },
  convocatoria: { n: 'Convocatoria', a: T_.sol, b: T_.coral, c: T_.tinta, f1: T_.crema, f2: T_.turquesa, tit: T_.tinta, des: T_.crema, som: T_.tinta,
    pill: T_.tinta, pillT: T_.sol, cta: T_.crema, cta2: T_.sol, ic: [T_.sol, T_.coral, T_.turquesa], icT: T_.tinta, us: T_.sol,
    esq: [T_.turquesa, T_.coral], pt: 'rgba(40,32,59,.10)', ptC: 'rgba(247,242,232,.08)', texto: T_.tinta, oscuro: false },
  podcast: { n: 'Podcast', a: T_.tinta, b: T_.turquesa, c: T_.tinta, f1: T_.sol, f2: T_.coral, tit: T_.crema, des: T_.sol, som: T_.turquesa,
    pill: T_.sol, pillT: T_.tinta, cta: T_.crema, cta2: T_.sol, ic: [T_.turquesa, T_.coral, T_.sol], icT: T_.tinta, us: T_.sol,
    esq: [T_.sol, T_.coral], pt: 'rgba(247,242,232,.09)', ptC: 'rgba(247,242,232,.08)', texto: T_.tinta, oscuro: true },
  niebla: { n: 'Tinieblas · niebla', a: N_.noche, b: N_.musgoP, c: N_.abismo, f1: N_.vela, f2: N_.sangre, tit: N_.pergamino, des: N_.vela, som: N_.sangre,
    pill: N_.vela, pillT: N_.abismo, cta: N_.pergamino, cta2: N_.vela, ic: [N_.musgo, N_.ceniza, N_.vela], icT: N_.abismo, us: N_.vela,
    esq: [N_.sangre, N_.vela], pt: 'rgba(207,202,223,.09)', ptC: 'rgba(207,202,223,.07)', texto: N_.pergamino, oscuro: true, tinieblas: true },
  sangre: { n: 'Tinieblas · sangre', a: N_.sangre, b: N_.noche, c: N_.abismo, f1: N_.pergamino, f2: N_.vela, tit: N_.pergamino, des: N_.vela, som: N_.abismo,
    pill: N_.abismo, pillT: N_.vela, cta: N_.pergamino, cta2: N_.vela, ic: [N_.ceniza, N_.musgo, N_.vela], icT: N_.abismo, us: N_.vela,
    esq: [N_.vela, N_.abismo], pt: 'rgba(17,13,24,.16)', ptC: 'rgba(207,202,223,.07)', texto: N_.pergamino, oscuro: true, tinieblas: true },
  vela: { n: 'Tinieblas · vela', a: N_.niebla, b: N_.vela, c: N_.abismo, f1: N_.pergamino, f2: N_.sangre, tit: N_.pergamino, des: N_.vela, som: N_.sangre,
    pill: N_.vela, pillT: N_.abismo, cta: N_.pergamino, cta2: N_.vela, ic: [N_.vela, N_.ceniza, N_.musgo], icT: N_.abismo, us: N_.vela,
    esq: [N_.vela, N_.sangre], pt: 'rgba(207,202,223,.09)', ptC: 'rgba(207,202,223,.07)', texto: N_.abismo, oscuro: true, tinieblas: true },
};
const ICONOS = Object.keys(R.iconos || {});
const etiquetaIcono = k => (k.startsWith('tinieblas-') ? 'Tinieblas · ' + k.slice(10) : k).replace(/-/g, ' ');

const AJUSTES_DEF = {
  formato: 'rollup80', receta: 'general',
  cabecera: true, subMarca: 'ESPACIO CULTURAL · ENGATIVÁ', esquina: true, puntos: true, destellos: true,
  l1: 'TU HISTORIA', l2: 'EMPIEZA', l3: 'AQUÍ.', destacada: 'ultima', tamano: 100, pill: 'JUEGOS DE ROL', datos: '',
  img: 'marca:d20', modoImg: 'ilustracion', pie: 'Imagina un personaje. Vive su aventura.',
  cta1: 'VEN A JUGAR.', cta2: 'QUÉDATE A COMPARTIR.',
  i1: 'd20', t1: 'ROL', i2: 'meeple', t2: 'JUEGOS DE MESA', i3: 'microfono', t3: 'PODCAST',
  usuario: '@tazonparados', qr: '', qrTexto: 'ÚNETE AL GRUPO',
};
let S = { v: 1, ajustes: { ...AJUSTES_DEF }, bloques: [], imgs: {} };
let activo = null;
function resumir() { /* sin tarjetas de bloque */ }

/* ===================================================================== tipografía y medidas */
const FUENTES = [['Barlow Condensed', 'BarlowCondensed-ExtraBold.ttf', '800', 'normal'], ['Barlow', 'Barlow-Medium.ttf', '500', 'normal'],
  ['Barlow', 'Barlow-SemiBold.ttf', '600', 'normal'], ['Barlow', 'Barlow-Bold.ttf', '700', 'normal'], ['Barlow', 'Barlow-SemiBoldItalic.ttf', '600', 'italic']];
const fontCssCampana = () => FUENTES.filter(f => R.campana[f[1]])
  .map(([fam, arch, w, st]) => `@font-face{font-family:'${fam}';src:url(${R.campana[arch]}) format('truetype');font-weight:${w};font-style:${st}}`).join('\n');
async function cargarFuentes() {
  const st = h('style'); st.textContent = fontCssCampana() + '\n' + fontCss(); document.head.append(st);
  try { await Promise.all(FUENTES.map(([fam, , w, s]) => document.fonts.load(`${s} ${w} 100px "${fam}"`))); } catch (e) { /* usa la de respaldo */ }
}
const lienzoMedida = document.createElement('canvas').getContext('2d');
function ancho(texto, tam, peso = '800', fam = 'Barlow Condensed', ls = 0) {
  lienzoMedida.font = `${peso} ${tam}px "${fam}"`;
  return lienzoMedida.measureText(texto).width + Math.max(0, texto.length - 1) * ls;
}
function ajustar(texto, max, tamMax, peso, fam, ls = 0) {
  if (!texto) return tamMax;
  return Math.min(tamMax, max / ancho(texto, 100, peso, fam, ls * 100 / tamMax) * 100);
}
function partir(texto, tam, max, peso, fam) {
  const out = []; let linea = '';
  for (const p of String(texto).split(/\s+/).filter(Boolean)) {
    const prueba = linea ? linea + ' ' + p : p;
    if (linea && ancho(prueba, tam, peso, fam) > max) { out.push(linea); linea = p; } else linea = prueba;
  }
  if (linea) out.push(linea);
  return out;
}

/* ===================================================================== dibujo */
const e = s => esc(String(s ?? ''));
function txt(t, x, y, tam, o = {}) {
  const a = o.anchor ? ` text-anchor="${o.anchor}"` : '';
  const ls = o.ls ? ` letter-spacing="${o.ls.toFixed(2)}"` : '';
  const c = o.campo ? ` data-campo="${o.campo}"` : '';
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${o.fam || 'Barlow Condensed'}" font-weight="${o.peso || 800}"` +
    `${o.italica ? ' font-style="italic"' : ''} font-size="${tam.toFixed(1)}" fill="${o.fill}"${a}${ls}${c}>${e(t)}</text>`;
}
function destelloSvg(cx, cy, r, fill, borde, sw) {
  const k1 = r * .12, k2 = r * .2;
  return `<path d="M${cx},${cy - r} C${cx + k1},${cy - k2} ${cx + k2},${cy - k1} ${cx + r},${cy} C${cx + k2},${cy + k1} ${cx + k1},${cy + k2} ${cx},${cy + r} ` +
    `C${cx - k1},${cy + k2} ${cx - k2},${cy + k1} ${cx - r},${cy} C${cx - k2},${cy - k1} ${cx - k1},${cy - k2} ${cx},${cy - r}Z" fill="${fill}"` +
    (borde ? ` stroke="${borde}" stroke-width="${sw}" stroke-linejoin="round"` : '') + '/>';
}
function icono(nombre, cx, cy, d, fondo, trazo, borde, u) {
  const k = d * .56 / 64;
  return `<circle cx="${cx + 5 * u}" cy="${cy + 5 * u}" r="${d / 2}" fill="${borde}"/><circle cx="${cx}" cy="${cy}" r="${d / 2}" fill="${fondo}" stroke="${borde}" stroke-width="${4 * u}"/>` +
    `<g transform="translate(${cx - 32 * k} ${cy - 32 * k}) scale(${k})" fill="none" stroke="${trazo}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" style="color:${trazo}">${R.iconos[nombre] || ''}</g>`;
}
function imagenEn(src, x, y, w, hh, modo, rc, u, campo) {
  if (!src) return '';
  if (modo === 'foto') {
    const id = 'f' + Math.random().toString(36).slice(2, 7), r = 26 * u;
    return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="${r}"/></clipPath>` +
      `<rect x="${x + 16 * u}" y="${y + 16 * u}" width="${w}" height="${hh}" rx="${r}" fill="${rc.c}"/>` +
      `<image href="${src}" x="${x}" y="${y}" width="${w}" height="${hh}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})" data-campo="${campo}"/>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="${r}" fill="none" stroke="${T_.tinta}" stroke-width="${7 * u}"/>`;
  }
  return `<ellipse cx="${x + w / 2}" cy="${y + hh * .96}" rx="${w * .3}" ry="${hh * .045}" fill="#28203B" opacity=".22"/>` +
    `<image href="${src}" x="${x}" y="${y}" width="${w}" height="${hh * .94}" preserveAspectRatio="xMidYMid meet" data-campo="${campo}"/>`;
}
function titular(a, rc, x, yTop, maxW, maxH, tamMax, u, alinear = 'start') {
  const L = [a.l1, a.l2, a.l3].map(l => String(l || '').toUpperCase().trim()).filter(Boolean);
  if (!L.length) return { svg: '', alto: 0 };
  let tam = Math.min(tamMax, ...L.map(l => ajustar(l, maxW, tamMax)));
  tam = Math.min(tam, maxH / (L.length * .95));
  const dest = a.destacada === 'ninguna' ? -1 : a.destacada === 'ultima' ? L.length - 1 : Math.min(+a.destacada - 1, L.length - 1);
  const campos = ['l1', 'l2', 'l3'].filter(k => String(a[k] || '').trim());
  let svg = '', y = yTop + tam * .82;
  const off = Math.max(6 * u, tam * .07);
  const ax = alinear === 'middle' ? { anchor: 'middle' } : {};
  L.forEach((l, i) => {
    if (i === dest) {
      svg += txt(l, x + off, y + off, tam, { fill: rc.som, ...ax });
      svg += txt(l, x, y, tam, { fill: rc.des, campo: campos[i], ...ax });
    } else svg += txt(l, x, y, tam, { fill: rc.tit, campo: campos[i], ...ax });
    y += tam * .95;
  });
  return { svg, alto: L.length * tam * .95, tam };
}
function pildora(t, x, y, tam, rc, u, campo, centro = false) {
  if (!t) return { svg: '', alto: 0 };
  const ls = tam * .12, w = ancho(t.toUpperCase(), tam, '700', 'Barlow', ls) + tam * 2.2, hh = tam * 2.1;
  const x0 = centro ? x - w / 2 : x;
  return { svg: `<rect x="${x0}" y="${y}" width="${w}" height="${hh}" rx="${hh / 2}" fill="${rc.pill}"/>` +
    txt(t.toUpperCase(), x0 + w / 2, y + hh * .66, tam, { fam: 'Barlow', peso: 700, fill: rc.pillT, anchor: 'middle', ls, campo }), alto: hh, ancho: w };
}
function cabecera(a, rc, x, y, u) {
  if (!a.cabecera) return '';
  const sello = rc.tinieblas ? (R.marca['logo-sello-tinieblas'] || R.marca['sello-inverso']) : (rc.oscuro ? R.marca['sello-inverso'] : R.marca.sello);
  const col = rc.tit;
  return `<image href="${sello}" x="${x}" y="${y}" width="${110 * u}" height="${110 * u}"/>` +
    txt('TAZÓN PARA DOS', x + 132 * u, y + 58 * u, 52 * u, { fill: col }) +
    txt(String(a.subMarca || '').toUpperCase(), x + 134 * u, y + 94 * u, 19 * u, { fam: 'Barlow', peso: 600, fill: col, ls: 2.4 * u, campo: 'subMarca' });
}
function cierreIconos(a, rc, cx, y, anchoMax, u) {
  const items = [[a.i1, a.t1], [a.i2, a.t2], [a.i3, a.t3]].filter(([i]) => i && i !== 'ninguno');
  if (!items.length) return { svg: '', alto: 0 };
  const d = Math.min(118 * u, anchoMax / items.length * .5), paso = Math.min(anchoMax / items.length, d * 2.6);
  let svg = '';
  items.forEach(([ic, et], k) => {
    const x = cx + (k - (items.length - 1) / 2) * paso;
    svg += icono(ic, x, y + d / 2, d, rc.ic[k % 3], rc.icT, rc.icT === N_.abismo ? N_.abismo : T_.tinta, u);
    const tam = Math.min(24 * u, ajustar(String(et || '').toUpperCase(), paso * .92, 24 * u, '700', 'Barlow'));
    svg += txt(String(et || '').toUpperCase(), x, y + d + 40 * u, tam, { fam: 'Barlow', peso: 700, fill: rc.cta, anchor: 'middle', ls: 1.2 * u, campo: 't' + (k + 1) });
  });
  return { svg, alto: d + 52 * u };
}
function qrSvg(a, rc, x, y, lado, u, res) {
  if (!a.qr) return '';
  const pad = 16 * u;
  return `<rect x="${x + 10 * u}" y="${y + 10 * u}" width="${lado}" height="${lado + 46 * u}" rx="${18 * u}" fill="${rc.ic[0]}"/>` +
    `<rect x="${x}" y="${y}" width="${lado}" height="${lado + 46 * u}" rx="${18 * u}" fill="${T_.crema}" stroke="${T_.tinta}" stroke-width="${4 * u}"/>` +
    `<image href="${res(a.qr)}" x="${x + pad}" y="${y + pad}" width="${lado - 2 * pad}" height="${lado - 2 * pad}" preserveAspectRatio="xMidYMid meet" data-campo="qr"/>` +
    txt(String(a.qrTexto || '').toUpperCase(), x + lado / 2, y + lado + 26 * u, Math.min(20 * u, ajustar(String(a.qrTexto || '').toUpperCase(), lado * .9, 20 * u, '700', 'Barlow')),
      { fam: 'Barlow', peso: 700, fill: T_.tinta, anchor: 'middle', ls: 1 * u, campo: 'qrTexto' });
}
function fondoComun(W, H, rc, a, u) {
  const p = 16 * u * 1.25;
  return `<defs><pattern id="pt" width="${p}" height="${p}" patternUnits="userSpaceOnUse"><circle cx="${p / 2}" cy="${p / 2}" r="${1.6 * u * 1.25}" fill="${rc.pt}"/></pattern>` +
    `<pattern id="ptc" width="${p}" height="${p}" patternUnits="userSpaceOnUse"><circle cx="${p / 2}" cy="${p / 2}" r="${1.6 * u * 1.25}" fill="${rc.ptC}"/></pattern></defs>`;
}
function esquina(W, u, rc, a) {
  if (!a.esquina) return '';
  const g = 300 * u, p = 170 * u;
  return `<path d="M${W - g} 0 H${W} V${g}Z" fill="${rc.esq[0]}"/><path d="M${W - p} 0 H${W} V${p}Z" fill="${rc.esq[1]}"/>` +
    `<path d="M${W - g} 0 L${W} ${g}" stroke="${T_.tinta}" stroke-width="${4 * u}"/>`;
}

function dibujar(vista) {
  const a = S.ajustes, rc = RECETAS[a.receta] || RECETAS.general;
  const [, , W, H] = FORMATOS.find(f => f[0] === a.formato) || FORMATOS[0];
  const res = resolver(vista);
  const img = a.img ? res(a.img) : '';
  return (W >= H * 1.4 ? horizontal : vertical)(W, H, a, rc, img, res);
}

function vertical(W, H, a, rc, img, res) {
  const u = W / 1000, M = 60 * u, dy = W * Math.tan(4 * Math.PI / 180);
  const r = H / W;                                  // 2.25 roll-up · 1.41 afiche
  const yA = H * (r > 1.8 ? .42 : .49), yB = H * (r > 1.8 ? .765 : .775);  // afiches: más alto para el titular
  const fr1 = 30 * u, fr2 = 24 * u;
  let s = fondoComun(W, H, rc, a, u);
  // bloques: A arriba, franja, B imagen, franja, C cierre
  s += `<rect width="${W}" height="${H}" fill="${rc.a}"/>`;
  if (a.puntos) s += `<rect width="${W}" height="${yA + dy}" fill="url(#pt)"/>`;
  s += `<path d="M0 ${yA + dy / 2 - fr1} L${W} ${yA - dy / 2 - fr1} V${H} H0Z" fill="${rc.f1}"/>`;
  s += `<path d="M0 ${yA + dy / 2} L${W} ${yA - dy / 2} V${H} H0Z" fill="${rc.b}"/>`;
  if (a.puntos) s += `<path d="M0 ${yA + dy / 2} L${W} ${yA - dy / 2} V${yB + dy} H0Z" fill="url(#pt)"/>`;
  s += `<path d="M0 ${yB + dy / 2 - fr2} L${W} ${yB - dy / 2 - fr2} V${H} H0Z" fill="${rc.f2}"/>`;
  s += `<path d="M0 ${yB + dy / 2} L${W} ${yB - dy / 2} V${H} H0Z" fill="${rc.c}"/>`;
  if (a.puntos) s += `<path d="M0 ${yB + dy / 2} L${W} ${yB - dy / 2} V${H} H0Z" fill="url(#ptc)"/>`;
  s += esquina(W, u, rc, a);
  // cabecera
  s += cabecera(a, rc, M, M, u);
  const yCab = a.cabecera ? M + 150 * u : M;
  if (a.cabecera) s += `<path d="M${M} ${yCab - 14 * u} H${W - 330 * u}" stroke="${rc.tit}" stroke-width="${3 * u}" opacity=".85"/>`;
  // titular + píldora + datos
  const yTit = yCab + 40 * u, finA = yA - dy / 2 - fr1 - 50 * u;
  const pTam = 30 * u, altoPill = a.pill ? pTam * 2.1 + 40 * u : 0, altoDatos = a.datos ? 70 * u : 0;
  const tamMax = 210 * u * (a.tamano / 100);
  const T = titular(a, rc, M, yTit, W - 2 * M - 40 * u, finA - yTit - altoPill - altoDatos, tamMax, u);
  s += T.svg;
  let y = yTit + T.alto + 34 * u;
  if (a.pill) { const P = pildora(a.pill, M, y, pTam, rc, u, 'pill'); s += P.svg; y += P.alto + 26 * u; }
  if (a.datos) s += txt(a.datos, M, y + 34 * u, Math.min(34 * u, ajustar(a.datos, W - 2 * M, 34 * u, '600', 'Barlow')), { fam: 'Barlow', peso: 600, fill: rc.tit, campo: 'datos' });
  if (a.destellos) {
    s += destelloSvg(W - 150 * u, yTit + T.alto * .55, 40 * u, rc.f2 === T_.sol ? T_.sol : rc.des, T_.tinta, 3 * u)
      + destelloSvg(W - 230 * u, yTit + T.alto * .9, 18 * u, rc.f1, null) + destelloSvg(W - 90 * u, yCab + 70 * u, 14 * u, rc.tit, null);
  }
  // bloque de imagen
  const topB = yA + dy / 2 + 40 * u, pieTam = 30 * u;
  const pieL = a.pie ? partir(a.pie, pieTam, W - 2 * M, '500', 'Barlow').slice(0, 2) : [];
  const finB = yB - dy / 2 - fr2 - 30 * u - pieL.length * pieTam * 1.25;
  s += imagenEn(img, M + 20 * u, topB, W - 2 * M - 40 * u, finB - topB - 10 * u, a.modoImg, rc, u, 'img');
  pieL.forEach((l, k) => { s += txt(l, W / 2, finB + pieTam * (1 + k * 1.25), pieTam, { fam: 'Barlow', peso: 500, fill: rc.texto, anchor: 'middle', campo: 'pie' }); });
  if (a.destellos) s += destelloSvg(M + 40 * u, topB + 50 * u, 28 * u, rc.f1, T_.tinta, 3 * u) + destelloSvg(W - M - 50 * u, topB + 30 * u, 16 * u, rc.f2, null);
  // cierre
  const topC = yB + dy / 2 + 46 * u, disp = H - topC - M;
  const qrLado = a.qr ? Math.min(250 * u, disp * .62) : 0;
  const anchoUtil = W - 2 * M - (a.qr ? qrLado + 40 * u : 0), cx = M + anchoUtil / 2;
  const t1 = Math.min(120 * u, ajustar(String(a.cta1 || '').toUpperCase(), anchoUtil, 120 * u));
  const t2 = Math.min(72 * u, ajustar(String(a.cta2 || '').toUpperCase(), anchoUtil, 72 * u));
  const alturas = (a.cta1 ? t1 : 0) + (a.cta2 ? t2 * 1.1 : 0) + 150 * u + (a.usuario ? 60 * u : 0) + 40 * u;
  const f = Math.min(1, disp / alturas);
  let yc = topC + (disp - alturas * f) / 2;
  if (a.cta1) { yc += t1 * f * .85; s += txt(String(a.cta1).toUpperCase(), cx, yc, t1 * f, { fill: rc.cta, anchor: 'middle', campo: 'cta1' }); yc += t1 * f * .2; }
  if (a.cta2) { yc += t2 * f * .95; s += txt(String(a.cta2).toUpperCase(), cx, yc, t2 * f, { fill: rc.cta2, anchor: 'middle', campo: 'cta2' }); }
  yc += 36 * u * f;
  const I = cierreIconos(a, rc, cx, yc, anchoUtil * .9, u * f); s += I.svg; yc += I.alto;
  if (a.usuario) s += txt(a.usuario, cx, yc + 44 * u * f, 32 * u * f, { fam: 'Barlow', peso: 700, fill: rc.us, anchor: 'middle', campo: 'usuario' });
  if (a.qr) s += qrSvg(a, rc, W - M - qrLado, topC + (disp - qrLado - 46 * u) / 2, qrLado, u, res);
  return { W, H, svg: s };
}

function horizontal(W, H, a, rc, img, res) {
  const u = H / 1000, M = 60 * u, pend = Math.tan(2 * Math.PI / 180);
  const yC = H * .72, dyC = W * pend, xB = W * .58, dxB = (yC) * Math.tan(8 * Math.PI / 180);
  const fr = 26 * u;
  let s = fondoComun(W, H, rc, a, u);
  s += `<rect width="${W}" height="${H}" fill="${rc.a}"/>`;
  if (a.puntos) s += `<rect width="${W}" height="${H}" fill="url(#pt)"/>`;
  // panel B a la derecha (borde inclinado) con franja crema
  s += `<path d="M${xB - fr} 0 H${W} V${yC} H${xB - dxB - fr}Z" fill="${rc.f1}"/>`;
  s += `<path d="M${xB} 0 H${W} V${yC} H${xB - dxB}Z" fill="${rc.b}"/>`;
  if (a.puntos) s += `<path d="M${xB} 0 H${W} V${yC} H${xB - dxB}Z" fill="url(#pt)"/>`;
  // franja inferior C con diagonal que sube a la derecha
  s += `<path d="M0 ${yC + dyC / 2 - fr} L${W} ${yC - dyC / 2 - fr} V${H} H0Z" fill="${rc.f2}"/>`;
  s += `<path d="M0 ${yC + dyC / 2} L${W} ${yC - dyC / 2} V${H} H0Z" fill="${rc.c}"/>`;
  if (a.puntos) s += `<path d="M0 ${yC + dyC / 2} L${W} ${yC - dyC / 2} V${H} H0Z" fill="url(#ptc)"/>`;
  s += esquina(W, u, rc, a);
  // izquierda: cabecera, titular, píldora, datos
  s += cabecera(a, rc, M, M, u);
  const yCab = a.cabecera ? M + 150 * u : M, anchoIzq = xB - dxB - fr - 2 * M;
  const pTam = 28 * u, altoPill = a.pill ? pTam * 2.1 + 30 * u : 0, altoDatos = a.datos ? 56 * u : 0;
  const finA = yC + dyC / 2 * (xB / W) - fr - 40 * u;
  const T = titular(a, rc, M, yCab + 10 * u, anchoIzq, finA - yCab - 10 * u - altoPill - altoDatos, 190 * u * (a.tamano / 100), u);
  s += T.svg;
  let y = yCab + 10 * u + T.alto + 30 * u;
  if (a.pill) { const P = pildora(a.pill, M, y, pTam, rc, u, 'pill'); s += P.svg; y += P.alto + 20 * u; }
  if (a.datos) s += txt(a.datos, M, y + 30 * u, Math.min(30 * u, ajustar(a.datos, anchoIzq, 30 * u, '600', 'Barlow')), { fam: 'Barlow', peso: 600, fill: rc.tit, campo: 'datos' });
  // derecha: imagen y pie
  const pieTam = 28 * u, xi = xB + 40 * u, wi = W - xi - (a.esquina ? 170 * u : 60 * u);
  const pieL = a.pie ? partir(a.pie, pieTam, wi, '500', 'Barlow').slice(0, 2) : [];
  const finImg = yC - dyC / 2 - fr - 30 * u - pieL.length * pieTam * 1.25;
  s += imagenEn(img, xi, 60 * u, wi, finImg - 70 * u, a.modoImg, rc, u, 'img');
  pieL.forEach((l, k) => { s += txt(l, xi + wi / 2, finImg + pieTam * (1 + k * 1.25), pieTam, { fam: 'Barlow', peso: 500, fill: rc.texto, anchor: 'middle', campo: 'pie' }); });
  if (a.destellos) s += destelloSvg(xB - 70 * u, yCab + 40 * u, 34 * u, rc.f1, T_.tinta, 3 * u) + destelloSvg(xi + 20 * u, 90 * u, 16 * u, rc.f2, null);
  // franja de cierre: CTA a la izquierda, íconos al centro, usuario y QR a la derecha
  const topC = yC + 20 * u, disp = H - topC - 40 * u, cy = topC + disp / 2;
  const qrLado = a.qr ? Math.min(disp * .78, 230 * u) : 0;
  const zonaCta = W * .42;
  const t1 = Math.min(disp * .42, ajustar(String(a.cta1 || '').toUpperCase(), zonaCta - M, 100 * u));
  const t2 = Math.min(disp * .26, ajustar(String(a.cta2 || '').toUpperCase(), zonaCta - M, 60 * u));
  const bloqueCta = (a.cta1 ? t1 * .85 : 0) + (a.cta2 ? t2 * 1.05 : 0);
  let yc = cy - bloqueCta / 2;
  if (a.cta1) { yc += t1 * .85; s += txt(String(a.cta1).toUpperCase(), M, yc, t1, { fill: rc.cta, campo: 'cta1' }); }
  if (a.cta2) { yc += t2 * 1.05; s += txt(String(a.cta2).toUpperCase(), M, yc, t2, { fill: rc.cta2, campo: 'cta2' }); }
  const finIconos = W - M - (a.qr ? qrLado + 40 * u : 0) - (a.usuario ? ancho(a.usuario, 34 * u, '700', 'Barlow') + 50 * u : 0);
  const anchoIc = finIconos - zonaCta;
  const fI = Math.min(1, disp / (180 * u));
  const I = cierreIconos(a, rc, zonaCta + anchoIc / 2, cy - (118 * u * fI + 52 * u * fI) / 2, anchoIc, u * fI); s += I.svg;
  if (a.usuario) s += txt(a.usuario, W - M - (a.qr ? qrLado + 40 * u : 0), cy + 12 * u, 34 * u, { fam: 'Barlow', peso: 700, fill: rc.us, anchor: 'end', campo: 'usuario' });
  if (a.qr) s += qrSvg(a, rc, W - M - qrLado, cy - (qrLado + 46 * u) / 2, qrLado, u, res);
  return { W, H, svg: s };
}

const svgCompleto = (d, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.W} ${d.H}" width="${d.W}mm" height="${d.H}mm" role="img" aria-label="${e(S.ajustes.l1 + ' ' + S.ajustes.l2 + ' ' + S.ajustes.l3)}">${extra}${d.svg}</svg>`;

/* ===================================================================== vista previa */
const lienzo = $('#lienzo');
const vista = lienzo;  // comun.js cambia su ancho en móvil
let listo = false;
function actualizarVista() {
  if (!listo) return;
  const d = dibujar(true);
  lienzo.innerHTML = svgCompleto(d);
  const f = FORMATOS.find(x => x[0] === S.ajustes.formato);
  $('#medida').textContent = `${f[1]} · ${d.W / 10} × ${d.H / 10} cm`;
}
lienzo.addEventListener('click', ev => {
  const el = ev.target.closest('[data-campo]'); if (!el) return;
  const k = el.dataset.campo;
  const campoEl = document.querySelector(`[data-k="${k}"]`) || document.querySelector(`[data-slot="${k}"]`);
  if (!campoEl) return;
  const tarjetaEl = campoEl.closest('.tarjeta'); if (tarjetaEl) { tarjetaEl.classList.remove('plegada'); plegados.delete(tarjetaEl.dataset.fija); }
  campoEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  setTimeout(() => { campoEl.focus(); if (campoEl.select) campoEl.select(); }, 250);
  if (innerWidth <= 900) $$('.pestanas button')[0].click();
});

/* ===================================================================== formulario */
const plegados = new Set();
function fija(titulo, ico, contenido, clave) {
  const el = h('section', { class: 'tarjeta fija' + (plegados.has(clave) ? ' plegada' : ''), 'data-fija': clave },
    h('header', { onclick: () => { plegados.has(clave) ? plegados.delete(clave) : plegados.add(clave); el.classList.toggle('plegada'); } },
      h('span', { class: 'tipo' }, ico + ' ' + titulo)),
    h('div', { class: 'campos' }, contenido));
  return el;
}
const conCambio = fn => () => { instantanea(); fn(); pintar(); cambio(); };
function selectorFormato() {
  return h('div', { class: 'formatos' }, FORMATOS.map(([id, n, w, hh]) => {
    const k = 46 / Math.max(w, hh);
    return h('button', { type: 'button', class: 'formato' + (S.ajustes.formato === id ? ' activo' : ''), onclick: conCambio(() => { S.ajustes.formato = id; }) },
      h('i', { style: `width:${Math.round(w * k)}px;height:${Math.round(hh * k)}px` }), n, h('small', {}, `${w / 10} × ${hh / 10} cm`));
  }));
}
function selectorReceta() {
  return h('div', { class: 'recetas' }, Object.entries(RECETAS).map(([id, rc]) =>
    h('button', { type: 'button', class: 'receta' + (S.ajustes.receta === id ? ' activa' : ''), onclick: conCambio(() => { S.ajustes.receta = id; }) },
      h('span', { class: 'tiras' }, [rc.a, rc.b, rc.c].map(c => h('span', { style: `background:${c}` }))), h('b', {}, rc.n))));
}
function selectorIconos() {
  const opc = [['ninguno', '— ninguno —'], ...ICONOS.map(k => [k, etiquetaIcono(k)])];
  return h('div', { class: 'iconos-sel' }, [1, 2, 3].map(n => h('div', { class: 'icono-item' },
    h('select', { 'aria-label': 'Ícono ' + n, onchange: ev => { S.ajustes['i' + n] = ev.target.value; cambio(); } },
      opc.map(([v, t]) => h('option', { value: v, selected: S.ajustes['i' + n] === v }, t))),
    h('input', { type: 'text', 'data-k': 't' + n, value: S.ajustes['t' + n] || '', placeholder: 'Rótulo', oninput: ev => { S.ajustes['t' + n] = ev.target.value; cambio(); } }))));
}
function slotDe(k, etiqueta) {
  const el = slotImagen(S.ajustes[k], v => { S.ajustes[k] = v; }, etiqueta);
  el.dataset.slot = k; return el;
}
function pintar() {
  const a = S.ajustes, ed = $('#editor'), y = ed.scrollTop;
  ed.replaceChildren(...[
    h('h2', { class: 'seccion' }, 'Pancarta'),
    fija('Formato', '▭', [selectorFormato(), h('p', { class: 'ayuda' }, 'El PDF sale a tamaño real. Pregunta a la imprenta si necesita sangrado.')], 'formato'),
    fija('Colores', '◐', [selectorReceta()], 'receta'),
    fija('Titular', 'T', [
      campo(a, ['l1', 'text', 'Línea 1', { ph: 'TU HISTORIA' }]), campo(a, ['l2', 'text', 'Línea 2', { ph: 'EMPIEZA' }]),
      campo(a, ['l3', 'text', 'Línea 3', { ph: 'AQUÍ.' }]),
      campo(a, ['destacada', 'select', 'Línea destacada', { opc: [['ultima', 'La última'], ['1', 'La 1'], ['2', 'La 2'], ['3', 'La 3'], ['ninguna', 'Ninguna']], medio: 1 }]),
      campo(a, ['tamano', 'range', 'Tamaño máximo', { min: 50, max: 130, paso: 5, suf: '%', medio: 1 }]),
      campo(a, ['pill', 'text', 'Etiqueta (píldora)', { ph: 'JUEGOS DE ROL', medio: 1 }]),
      campo(a, ['datos', 'text', 'Fecha, hora o lugar', { ph: '[FECHA] · [HORA] · [LUGAR]', medio: 1 }]),
      h('p', { class: 'ayuda' }, 'Titulares cortos que terminan en punto. El tamaño se ajusta solo para que quepa.')], 'titular'),
    fija('Imagen', '▣', [slotDe('img', 'Imagen principal'),
      campo(a, ['modoImg', 'select', 'Tratamiento', { opc: [['ilustracion', 'Ilustración (sin marco, con sombra)'], ['foto', 'Foto (marco redondeado con sombra)']], medio: 1 }]),
      campo(a, ['pie', 'text', 'Texto bajo la imagen', { ph: 'Imagina un personaje. Vive su aventura.', medio: 1 }]),
      h('p', { class: 'ayuda' }, 'Fotos con personas: solo con su permiso. Puedes usar una de manos y dados.')], 'imagen'),
    fija('Cierre', '◆', [
      campo(a, ['cta1', 'text', 'Llamado grande', { ph: 'VEN A JUGAR.', medio: 1 }]), campo(a, ['cta2', 'text', 'Llamado secundario', { ph: 'QUÉDATE A COMPARTIR.', medio: 1 }]),
      selectorIconos(), campo(a, ['usuario', 'text', 'Usuario o web', { ph: '@tazonparados', medio: 1 }]),
      campo(a, ['qrTexto', 'text', 'Texto del QR', { ph: 'ÚNETE AL GRUPO', medio: 1 }]), slotDe('qr', 'Código QR (opcional)')], 'cierre'),
    fija('Marca', '★', [
      campo(a, ['cabecera', 'check', 'Cabecera con el sello', { medio: 1 }]), campo(a, ['esquina', 'check', 'Esquina de color', { medio: 1 }]),
      campo(a, ['puntos', 'check', 'Trama de puntos', { medio: 1 }]), campo(a, ['destellos', 'check', 'Destellos', { medio: 1 }]),
      campo(a, ['subMarca', 'text', 'Texto bajo el nombre', { ph: 'ESPACIO CULTURAL · ENGATIVÁ' }])], 'marca'),
  ].flat(Infinity).filter(Boolean));
  ed.scrollTop = y;
}

/* ===================================================================== plantillas */
const PLANTILLAS = {
  rol: { n: 'Ven a jugar · roll-up', d: 'La pancarta de la casa: rol, juegos de mesa y podcast.', a: {} },
  leyendas: { n: 'Noche de leyendas · Tinieblas', d: 'Roll-up oscuro para crónicas del Mundo de Tinieblas.', a: {
    receta: 'niebla', l1: 'NOCHE DE', l2: 'LEYENDAS', l3: 'EN ENGATIVÁ.', pill: 'MUNDO DE TINIEBLAS', img: 'marca:ilus-parte2-humedal', modoImg: 'ilustracion',
    pie: 'Mago, Hombre Lobo y Changeling junto al humedal.', cta1: 'TRAE TU HISTORIA.', cta2: 'LA NIEBLA ESCUCHA.',
    i1: 'tinieblas-espiral', t1: 'MAGO', i2: 'tinieblas-huella', t2: 'HOMBRE LOBO', i3: 'tinieblas-hongo', t3: 'CHANGELING' } },
  convocatoria: { n: 'Convocatoria · afiche A3', d: 'Afiche para pedir historias de la comunidad.', a: {
    formato: 'a3', receta: 'convocatoria', l1: 'CUÉNTANOS', l2: 'TU', l3: 'HISTORIA.', pill: 'CONVOCATORIA ABIERTA', img: 'marca:d20-turquesa',
    pie: 'Mi historia trata sobre…', cta1: 'ESCRÍBENOS.', cta2: 'TODAS LAS VOCES CUENTAN.',
    i1: 'historia', t1: 'ESCRIBE', i2: 'microfono', t2: 'GRABA', i3: 'comunidad', t3: 'COMPARTE' } },
  mesa: { n: 'Juegos de mesa · pancarta 2 × 0,8 m', d: 'Pancarta horizontal para la fachada o un evento.', a: {
    formato: 'h200', receta: 'mesa', l1: 'NOCHE DE', l2: 'JUEGOS', l3: 'DE MESA.', pill: 'TRAE A TU PARCHE', img: 'marca:d6',
    pie: 'Tablero, risas y algo caliente para tomar.', datos: '[FECHA] · Tv. 76 B # 81 B - 43, Engativá',
    cta1: 'VEN A JUGAR.', cta2: 'ENTRADA LIBRE.', i1: 'dado', t1: 'MESA', i2: 'carta', t2: 'CARTAS', i3: 'comunidad', t3: 'COMUNIDAD' } },
  podcast: { n: 'Podcast · pendón', d: 'Pendón para grabaciones en vivo del podcast.', a: {
    formato: 'pendon', receta: 'podcast', l1: 'ESCUCHA', l2: 'NUESTRAS', l3: 'HISTORIAS.', pill: 'PODCAST NARRATIVO', img: 'marca:mascota',
    pie: 'Cada episodio es un platillo distinto.', cta1: 'DALE PLAY.', cta2: 'SERVIMOS ROL CADA SEMANA.',
    i1: 'audifonos', t1: 'ESCUCHA', i2: 'microfono', t2: 'GRABA', i3: 'corazon', t3: 'COMPARTE' } },
};
function usarPlantilla(k) {
  instantanea();
  S = { v: 1, ajustes: { ...AJUSTES_DEF, ...PLANTILLAS[k].a }, bloques: [], imgs: S.imgs };
  pintar(); cambio(); aviso('Plantilla «' + PLANTILLAS[k].n + '» lista: cambia los textos y la imagen');
}
$('#b-plantillas').addEventListener('click', ev => {
  const m = $('#menu-plantillas');
  m.replaceChildren(...Object.entries(PLANTILLAS).map(([k, p]) => h('button', { type: 'button', onclick: () => { cerrarMenus(); usarPlantilla(k); } },
    h('b', {}, p.n), h('span', {}, p.d))));
  posicionar(m, ev.currentTarget);
});

/* ===================================================================== pegar imágenes */
document.addEventListener('paste', ev => {
  const f = [...(ev.clipboardData?.files || [])].find(x => x.type.startsWith('image/'));
  if (!f) return;
  if (document.activeElement?.matches?.('textarea,input') && ev.clipboardData.getData('text/plain').trim()) return;
  ev.preventDefault();
  const slot = document.activeElement?.closest?.('.slot');
  ponerImagen(slot ? slot._destino : { set: v => { S.ajustes.img = v; } }, f);
});

/* ===================================================================== exportar */
const nombreArchivo = ext => slug([S.ajustes.l1, S.ajustes.l2, S.ajustes.l3].join(' ') || 'pancarta') + '-' + S.ajustes.formato + ext;
function documento({ imprimir = false } = {}) {
  const d = dibujar(false), titulo = [S.ajustes.l1, S.ajustes.l2, S.ajustes.l3].filter(Boolean).join(' ');
  return `<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${e(titulo || 'Pancarta')}</title><meta name="generator" content="Editor de pancartas · Tazón para Dos">` +
    `<style>${fontCssCampana()}\n@page{size:${d.W}mm ${d.H}mm;margin:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
    `html,body{margin:0;background:#E9E3D6}@media screen{body{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}` +
    `svg{max-width:100%;max-height:calc(100vh - 48px);width:auto;height:auto;box-shadow:8px 8px 0 rgba(40,32,59,.3)}}` +
    `@media print{body{background:none}svg{display:block;width:${d.W}mm;height:${d.H}mm}}</style>` +
    (imprimir ? `<script>addEventListener('load',()=>document.fonts.ready.then(()=>setTimeout(()=>print(),500)))<\/script>` : '') +
    `</head><body>${svgCompleto(d)}</body></html>`;
}
async function exportarPng() {
  const d = dibujar(false), lado = 2400, k = lado / Math.max(d.W, d.H);
  const w = Math.round(d.W * k), hh = Math.round(d.H * k);
  const svg = svgCompleto(d, `<style>${fontCssCampana()}</style>`).replace(`width="${d.W}mm" height="${d.H}mm"`, `width="${w}" height="${hh}"`);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    await new Promise(r => setTimeout(r, 300));  // deja que el SVG termine de cargar sus fuentes
    const c = document.createElement('canvas'); c.width = w; c.height = hh;
    c.getContext('2d').drawImage(im, 0, 0, w, hh);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    descargar(nombreArchivo('.png'), blob, 'image/png');
    aviso(`PNG de ${w} × ${hh} px para redes o pantalla. Para imprimir usa «Imprimir / PDF».`);
  } catch (err) { aviso('No pude crear el PNG en este navegador; usa «Descargar HTML» o «Imprimir / PDF»'); }
  finally { URL.revokeObjectURL(url); }
}
$('#b-png').addEventListener('click', exportarPng);
$('#b-html').addEventListener('click', () => { descargar(nombreArchivo('.html'), documento(), 'text/html'); aviso('HTML descargado: ábrelo en el navegador y usa Ctrl+P para el PDF a tamaño real'); });
$('#b-pdf').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([documento({ imprimir: true })], { type: 'text/html' }));
  const w = window.open(url, '_blank');
  if (!w) { aviso('Permite las ventanas emergentes, o descarga el HTML y usa Ctrl+P'); return; }
  const f = FORMATOS.find(x => x[0] === S.ajustes.formato);
  aviso(`En el diálogo: «Guardar como PDF», márgenes «Ninguno» y «Gráficos de fondo» activado. Sale a ${f[2] / 10} × ${f[3] / 10} cm.`);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});
$('#b-guardar').addEventListener('click', () => { descargar(nombreArchivo('.pancarta.json'), JSON.stringify(S), 'application/json'); aviso('Proyecto guardado (incluye las imágenes)'); });
$('#b-abrir').addEventListener('click', () => $('#f-proyecto').click());
$('#f-proyecto').addEventListener('change', async ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  try {
    const p = JSON.parse(await f.text());
    if (!p || !p.ajustes || !('l1' in p.ajustes)) throw 0;
    instantanea(); S = { v: 1, ajustes: { ...AJUSTES_DEF, ...p.ajustes }, bloques: [], imgs: p.imgs || {} };
    pintar(); cambio(); aviso('Proyecto abierto');
  } catch (err) { aviso('Ese archivo no es un proyecto de pancarta'); }
});

/* ===================================================================== inicio */
(async () => {
  $('#sello-ed').src = R.marca['sello-inverso'] || R.marca.sello;
  await cargarFuentes();
  const conLimite = (pr, ms) => Promise.race([pr, new Promise(r => setTimeout(() => r(null), ms))]);
  await conLimite(abrirDB(), 1500);
  const previo = await conLimite(leerLocal(), 1500);
  const pedida = (location.hash.match(/plantilla=(\w+)/) || [])[1];
  if (pedida && PLANTILLAS[pedida]) S = { v: 1, ajustes: { ...AJUSTES_DEF, ...PLANTILLAS[pedida].a }, bloques: [], imgs: {} };
  else if (previo && previo.ajustes) S = { v: 1, ajustes: { ...AJUSTES_DEF, ...previo.ajustes }, bloques: [], imgs: previo.imgs || {} };
  $('#b-deshacer').addEventListener('click', deshacer);
  actualizarDeshacer();
  listo = true;
  pintar(); actualizarVista();
})();
