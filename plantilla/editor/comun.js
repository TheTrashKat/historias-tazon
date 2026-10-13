'use strict';
/* Código común de los editores de Tazón para Dos (historias y pancartas): utilidades, imágenes,
   formularios, guardado en el navegador, deshacer, menús y descargas. Cada editor define S, pintar(),
   cambio()/actualizarVista(), resumir() y la vista previa (#vista). */
const R = window.R;
const INK = '#28203B', SUN = '#F8CB67';
const COLORES = R.colores;

/* ===================================================================== utilidades */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v;
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const nuevoId = () => 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
let avisoT;
function aviso(txt) {
  const a = $('#aviso'); a.textContent = txt; a.classList.add('ver');
  clearTimeout(avisoT); avisoT = setTimeout(() => a.classList.remove('ver'), 2600);
}

function slug(t) {
  t = t.replace(/<[^>]+>/g, '').normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase();
  return t.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'seccion';
}

function svgUri(svg) {
  return 'data:image/svg+xml;utf8,' + svg.trim().replace(/\s+/g, ' ').replace(/#/g, '%23').replace(/"/g, "'");
}

const VACIA = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260"><rect width="400" height="260" fill="#F7F2E8"/>
<g fill="none" stroke="#28203B" stroke-width="3" opacity=".35"><rect x="150" y="80" width="100" height="76" rx="8"/><circle cx="178" cy="106" r="9"/><path d="M156 150l30-30 22 20 14-12 24 22"/></g>
<text x="200" y="196" text-anchor="middle" font-family="DM Mono, monospace" font-size="15" letter-spacing="2" fill="#28203B" opacity=".55">PEGA O SUBE UNA IMAGEN</text></svg>`);

const cssStr = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
let FONTCSS_DATA = null;
function fontCss() {
  if (!FONTCSS_DATA) FONTCSS_DATA = R.fontcss.replace(/__FUENTES__\/([\w-]+\.ttf)/g, (_, f) => R.fuentes[f] || '');
  return FONTCSS_DATA;
}
const urlsVista = {};
function urlImagen(id, vista) {
  const d = S.imgs[id]; if (!d) return VACIA;
  if (!vista || d.length < 200000) return d;
  if (!urlsVista[id]) {
    try {
      const [cab, b64] = d.split(','); const bin = atob(b64), u = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
      urlsVista[id] = URL.createObjectURL(new Blob([u], { type: cab.slice(5).split(';')[0] }));
    } catch (e) { return d; }
  }
  return urlsVista[id];
}
function resolver(vista) {
  return r => {
    if (r.startsWith('marca:')) return R.marca[r.slice(6).replace(/\.svg$/, '')] || VACIA;
    if (r.startsWith('img:')) return urlImagen(r.slice(4), vista);
    return VACIA;
  };
}

/* ===================================================================== deshacer */
const pila = [];
function instantanea() {
  pila.push(JSON.stringify({ ajustes: S.ajustes, bloques: S.bloques }));
  if (pila.length > 50) pila.shift();
  actualizarDeshacer();
}
function deshacer() {
  const p = pila.pop();
  if (!p) return aviso('No hay nada que deshacer');
  const o = JSON.parse(p);
  S.ajustes = o.ajustes; S.bloques = o.bloques;
  const tema = $('#s-tema'); if (tema) tema.value = S.ajustes.tema;
  pintar(); cambio(); actualizarDeshacer(); aviso('Deshecho');
}
function actualizarDeshacer() { const b = $('#b-deshacer'); if (b) b.disabled = !pila.length; }
const escribiendo = el => !!el && (el.matches?.('input,textarea,select') || el.isContentEditable);
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !escribiendo(document.activeElement)) { e.preventDefault(); deshacer(); }
});

/* ===================================================================== guardado (IndexedDB) */
let db = null;
function abrirDB() {
  return new Promise(res => {
    try {
      const rq = indexedDB.open(typeof NOMBRE_DB === 'string' ? NOMBRE_DB : 'editor-historias-tazon', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('p');
      rq.onsuccess = () => { db = rq.result; res(db); };
      rq.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}
function guardarLocal() {
  if (!db) return;
  try { db.transaction('p', 'readwrite').objectStore('p').put(JSON.parse(JSON.stringify(S)), 'actual'); } catch (e) { /* sin guardado local */ }
}
function leerLocal() {
  return new Promise(res => {
    if (!db) return res(null);
    try { const rq = db.transaction('p').objectStore('p').get('actual'); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); }
    catch (e) { res(null); }
  });
}
let tVista, tGuardar;
function cambio() {
  clearTimeout(tVista); tVista = setTimeout(actualizarVista, 280);
  clearTimeout(tGuardar); tGuardar = setTimeout(guardarLocal, 900);
}

/* ===================================================================== imágenes */
function leerArchivo(f) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
}
async function prepararImagen(f) {
  const d = await leerArchivo(f);
  if (/svg/.test(f.type) || f.type === 'image/gif') return d;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = d; });
  const max = 2400, esc_ = Math.min(1, max / Math.max(img.width, img.height));
  if (esc_ === 1 && f.size < 1_500_000) return d;
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * esc_); c.height = Math.round(img.height * esc_);
  const x = c.getContext('2d');
  const png = f.type === 'image/png' && f.size < 4_000_000;
  if (!png) { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
  x.drawImage(img, 0, 0, c.width, c.height);
  return png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.88);
}
async function ponerImagen(destino, archivo) {
  try {
    const d = await prepararImagen(archivo);
    const id = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    instantanea(); S.imgs[id] = d; destino.set('img:' + id);
    limpiarImagenes(); pintar(); cambio(); aviso('Imagen lista');
  } catch (e) { aviso('No pude leer esa imagen'); }
}
function limpiarImagenes() {
  // Se conservan las imágenes que usa el proyecto o que «Deshacer» todavía puede recuperar.
  const usadas = new Set();
  for (const p of [JSON.stringify({ a: S.ajustes, b: S.bloques }), ...pila]) for (const m of p.matchAll(/img:([a-z0-9]+)/g)) usadas.add(m[1]);
  for (const id of Object.keys(S.imgs)) if (!usadas.has(id)) { delete S.imgs[id]; if (urlsVista[id]) { URL.revokeObjectURL(urlsVista[id]); delete urlsVista[id]; } }
}
let destinoArchivo = null;
$('#f-imagen').addEventListener('change', e => {
  const f = e.target.files[0]; if (f && destinoArchivo) ponerImagen(destinoArchivo, f); e.target.value = '';
});
const NOMBRES_MARCA = Object.keys(R.marca).filter(k => !k.startsWith('logotipo')).sort((a, b) => {
  const g = k => k.startsWith('ilus-') ? 2 : k.startsWith('tinieblas-') ? 1 : 0; return g(a) - g(b) || a.localeCompare(b);
});
const etiquetaMarca = k => k.startsWith('ilus-') ? 'Ilustración · ' + k.slice(5).replace(/-/g, ' ')
  : k.startsWith('tinieblas-') ? 'Tinieblas · ' + k.slice(10).replace(/-/g, ' ') : 'Tazón · ' + k.replace(/-/g, ' ');
function slotImagen(valor, set, etiqueta) {
  const destino = { set };
  const src = valor ? resolver(true)(valor) : '';
  const mini = h('div', { class: 'mini-img', style: src ? `background-image:url("${src}")` : null }, src ? '' : '＋');
  const sel = h('select', { 'aria-label': 'Usar una imagen de la marca', onchange: e => { if (e.target.value) { instantanea(); set('marca:' + e.target.value); limpiarImagenes(); pintar(); cambio(); } } },
    h('option', { value: '' }, 'o usa una de la marca…'),
    NOMBRES_MARCA.map(k => h('option', { value: k, selected: valor === 'marca:' + k }, etiquetaMarca(k))));
  const slot = h('div', { class: 'slot', tabindex: '0', title: 'Clic para subir, Ctrl+V para pegar, o arrastra una imagen' },
    mini,
    h('div', { class: 'txt' },
      h('b', {}, etiqueta || 'Imagen'),
      h('span', {}, 'Clic para subir · Ctrl+V para pegar · arrastra aquí'),
      h('div', { class: 'fila' }, sel,
        valor ? h('button', { class: 'mini', type: 'button', onclick: e => { e.stopPropagation(); instantanea(); set(''); limpiarImagenes(); pintar(); cambio(); } }, 'Quitar') : null)));
  slot._destino = destino;
  slot.addEventListener('click', e => { if (e.target.closest('select,button')) return; destinoArchivo = destino; $('#f-imagen').click(); });
  slot.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); destinoArchivo = destino; $('#f-imagen').click(); } });
  slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('sobre'); });
  slot.addEventListener('dragleave', () => slot.classList.remove('sobre'));
  slot.addEventListener('drop', e => {
    e.preventDefault(); slot.classList.remove('sobre');
    const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/')); if (f) ponerImagen(destino, f);
  });
  return slot;
}

/* ===================================================================== formulario */
function campo(obj, def, alCambiar) {
  const [k, tipo, label, o = {}] = def;
  const set = v => { obj[k] = v; (alCambiar || cambio)(); };
  const cls = 'campo' + (o.medio ? ' medio' : '');
  if (tipo === 'img') return slotImagen(obj[k], v => { obj[k] = v; }, label);
  if (tipo === 'check') return h('label', { class: 'check' + (o.medio ? ' medio' : '') },
    h('input', { type: 'checkbox', checked: !!obj[k], onchange: e => set(e.target.checked) }), label);
  if (tipo === 'select') return h('label', { class: cls }, label,
    h('select', { onchange: e => set(e.target.value) }, o.opc.map(([v, t]) => h('option', { value: v, selected: String(obj[k]) === v }, t))));
  if (tipo === 'range') {
    const out = h('output', {}, `${obj[k]}${o.suf || ''}`);
    return h('label', { class: cls }, label, h('div', { class: 'rango' },
      h('input', { type: 'range', min: o.min, max: o.max, step: o.paso || 1, value: obj[k], oninput: e => { out.textContent = e.target.value + (o.suf || ''); set(+e.target.value); } }), out));
  }
  if (tipo === 'area') {
    const ta = h('textarea', { 'data-k': k, class: o.corta ? 'corta' : null, placeholder: o.ph || '', spellcheck: 'true', oninput: e => { set(e.target.value); resumir(obj); } });
    ta.value = obj[k] || '';
    return h('label', { class: cls }, label, ta);
  }
  return h('label', { class: cls }, label, h('input', { type: 'text', 'data-k': k, value: obj[k] || '', placeholder: o.ph || '', oninput: e => { set(e.target.value); resumir(obj); } }));
}

/* ===================================================================== menús */
function posicionar(menu, ancla) {
  menu.hidden = false;
  const r = ancla.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(r.left, innerWidth - mw - 8)) + 'px';
  menu.style.top = (r.bottom + mh + 8 < innerHeight ? r.bottom + 6 : Math.max(8, r.top - mh - 6)) + 'px';
  setTimeout(() => menu.querySelector('button')?.focus(), 0);
}
function cerrarMenus() { $$('.menu').forEach(m => m.hidden = true); }
document.addEventListener('click', e => { if (!e.target.closest('.menu,[aria-haspopup],.insertar')) cerrarMenus(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { cerrarMenus(); $$('.modal').forEach(m => m.hidden = true); } });

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = h('a', { href: url, download: nombre }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ===================================================================== pestañas y ancho de vista */
$$('.pestanas button').forEach(b => b.addEventListener('click', () => {
  $$('.pestanas button').forEach(x => x.classList.toggle('activa', x === b));
  $('.area').classList.toggle('ver-vista', b.dataset.p === 'vista');
}));
$$('.vista-barra .mini').forEach(b => b.addEventListener('click', () => {
  $$('.vista-barra .mini').forEach(x => x.classList.toggle('activa', x === b)); vista.style.width = b.dataset.ancho;
}));
