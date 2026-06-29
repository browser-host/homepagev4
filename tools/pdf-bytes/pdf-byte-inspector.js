// ============ State ============
let pdfBytes = null;
let pdfName = '';
let viewStart = 0;
let viewEnd = 2048;
let selStart = -1;
let selEnd = -1;
let isSelecting = false;

// ============ Drop zone ============
const drop = document.getElementById('drop');
const fileInput = document.getElementById('file');

drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
drop.addEventListener('drop', e => {
  e.preventDefault();
  drop.classList.remove('dragover');
  if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => {
  if (e.target.files.length) loadFile(e.target.files[0]);
});

function loadFile(file) {
  pdfName = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    pdfBytes = new Uint8Array(e.target.result);
    onLoaded();
  };
  reader.readAsArrayBuffer(file);
}

// ============ Raw bytes input ============
document.getElementById('raw-load').addEventListener('click', () => {
  const text = document.getElementById('raw-text').value;
  const format = document.getElementById('raw-format').value;
  if (!text.trim()) { setRawHint('Paste some bytes first.', 'bad'); return; }
  try {
    const bytes = parseRawBytes(text, format);
    if (!bytes || bytes.length === 0) { setRawHint('No bytes parsed.', 'bad'); return; }
    pdfBytes = bytes;
    pdfName = `pasted bytes (${format})`;
    setRawHint(`Loaded ${bytes.length.toLocaleString()} bytes.`, 'ok');
    onLoaded();
  } catch (err) {
    setRawHint('Parse error: ' + err.message, 'bad');
  }
});

document.getElementById('raw-clear').addEventListener('click', () => {
  document.getElementById('raw-text').value = '';
  setRawHint('Paste any of: hex dump, base64, raw text, or escape sequences.', '');
});

function setRawHint(msg, kind) {
  const el = document.getElementById('raw-hint');
  el.textContent = msg;
  el.style.color = kind === 'ok' ? 'var(--color-success)' : kind === 'bad' ? 'var(--color-error)' : 'var(--color-text-subtle)';
}

function parseRawBytes(text, format) {
  if (format === 'auto') format = detectFormat(text);
  if (format === 'hex') return parseHex(text);
  if (format === 'base64') return parseBase64(text);
  if (format === 'ascii') return new TextEncoder().encode(text);
  if (format === 'escaped') return parseEscaped(text);
  throw new Error('Unknown format: ' + format);
}

function detectFormat(text) {
  const trimmed = text.trim();
  if (/(\\x[0-9a-f]{2}|%[0-9a-f]{2})/i.test(trimmed)) return 'escaped';
  const hexClean = trimmed.replace(/[\s\-:,]/g, '');
  if (/^[0-9a-f]+$/i.test(hexClean) && hexClean.length % 2 === 0 && hexClean.length >= 2) return 'hex';
  const b64Clean = trimmed.replace(/\s/g, '');
  if (/^[A-Za-z0-9+/=]+$/.test(b64Clean) && b64Clean.length % 4 === 0 && b64Clean.length >= 4) return 'base64';
  return 'ascii';
}

function parseHex(text) {
  let clean = text.replace(/0x/gi, '').replace(/[\s\-:,_|]/g, '');
  if (text.includes('\n') && /\|/.test(text)) {
    const lines = text.split('\n');
    clean = '';
    for (const line of lines) {
      let l = line.replace(/^[0-9a-f]+:?\s+/i, '');
      const pipeIdx = l.indexOf('|');
      if (pipeIdx >= 0) l = l.slice(0, pipeIdx);
      clean += l.replace(/[\s\-:,_]/g, '');
    }
    clean = clean.replace(/0x/gi, '');
  }
  if (!/^[0-9a-f]*$/i.test(clean)) {
    const bad = clean.match(/[^0-9a-f]/i);
    throw new Error(`invalid hex character "${bad[0]}"`);
  }
  if (clean.length % 2 !== 0) throw new Error('odd number of hex digits');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

function parseBase64(text) {
  const clean = text.replace(/\s/g, '');
  try {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    throw new Error('invalid base64');
  }
}

function parseEscaped(text) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\' && i + 1 < text.length) {
      const n = text[i + 1];
      if (n === 'x' && i + 3 < text.length) {
        const h = text.substr(i + 2, 2);
        if (/^[0-9a-f]{2}$/i.test(h)) { out.push(parseInt(h, 16)); i += 3; continue; }
      }
      if (/[0-7]/.test(n)) {
        let oct = n; let j = i + 2;
        if (j < text.length && /[0-7]/.test(text[j])) { oct += text[j]; j++; }
        if (j < text.length && /[0-7]/.test(text[j])) { oct += text[j]; j++; }
        out.push(parseInt(oct, 8) & 0xff); i = j - 1; continue;
      }
      if (n === 'n') { out.push(0x0a); i++; continue; }
      if (n === 'r') { out.push(0x0d); i++; continue; }
      if (n === 't') { out.push(0x09); i++; continue; }
      if (n === '0') { out.push(0x00); i++; continue; }
      if (n === '\\') { out.push(0x5c); i++; continue; }
      out.push(c.charCodeAt(0));
      continue;
    }
    if (c === '%' && i + 2 < text.length) {
      const h = text.substr(i + 1, 2);
      if (/^[0-9a-f]{2}$/i.test(h)) { out.push(parseInt(h, 16)); i += 2; continue; }
    }
    const code = text.charCodeAt(i);
    if (code < 0x80) { out.push(code); }
    else {
      const enc = new TextEncoder().encode(c);
      for (const b of enc) out.push(b);
    }
  }
  return new Uint8Array(out);
}

function onLoaded() {
  const size = pdfBytes.length;
  document.getElementById('info').classList.add('show');
  document.getElementById('info').innerHTML =
    `<span><b>File:</b> ${escapeHtml(pdfName)}</span>` +
    `<span><b>Size:</b> ${size.toLocaleString()} bytes (${(size / 1024).toFixed(1)} KB)</span>` +
    `<span><b>Hex:</b> 0x0 – 0x${(size - 1).toString(16).toUpperCase()}</span>`;

  document.getElementById('results').classList.add('show');
  document.getElementById('controls').classList.add('show');
  document.getElementById('panels').classList.add('show');
  document.getElementById('fields-section').classList.add('show');

  viewStart = 0;
  viewEnd = Math.min(2048, size);
  document.getElementById('start').value = viewStart;
  document.getElementById('end').value = viewEnd;
  document.getElementById('start').max = size - 1;
  document.getElementById('end').max = size;

  selStart = -1;
  selEnd = -1;
  renderBytes();
  renderSelection();
  renderFields();
  const objs = parseObjects();
  const model = analyzeStructure(objs);
  renderObjects(objs, model);
  renderStructure(objs, model);
}

// ============ Result tab switching ============
function switchResultTab(index) {
  const tabs = document.getElementById('result-tabs');
  if (!tabs || !tabs.shadowRoot) return;
  const btns = tabs.shadowRoot.querySelectorAll('.tab-btn');
  if (btns[index]) btns[index].click();
}

// ============ Byte rendering ============
const bytesEl = document.getElementById('bytes');

function renderBytes() {
  if (!pdfBytes) return;
  const start = Math.max(0, viewStart);
  const end = Math.min(pdfBytes.length, viewEnd);
  document.getElementById('byte-range').textContent =
    `bytes ${start.toLocaleString()}–${end.toLocaleString()} of ${pdfBytes.length.toLocaleString()}`;

  const ROW = 16;
  let html = '';
  for (let row = start; row < end; row += ROW) {
    const rowEnd = Math.min(row + ROW, end);
    const offset = row.toString(16).padStart(8, '0').toUpperCase();
    let hex = '';
    let ascii = '';
    for (let i = row; i < rowEnd; i++) {
      const b = pdfBytes[i];
      const hexByte = b.toString(16).padStart(2, '0').toUpperCase();
      hex += `<span class="b" data-i="${i}">${hexByte}</span>`;
      const c = (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : '.';
      ascii += `<span class="a" data-i="${i}">${escapeChar(c)}</span>`;
    }
    for (let i = rowEnd; i < row + ROW; i++) {
      hex += `<span class="b" style="visibility:hidden">00</span>`;
    }
    html += `<div class="byte-row"><span class="byte-offset">${offset}</span><span class="byte-hex">${hex}</span><span class="byte-ascii">${ascii}</span></div>`;
  }
  bytesEl.innerHTML = html;
  applySelectionHighlight();
}

function escapeChar(c) {
  if (c === '<') return '&lt;';
  if (c === '>') return '&gt;';
  if (c === '&') return '&amp;';
  if (c === ' ') return '&nbsp;';
  return c;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ============ Selection ============
bytesEl.addEventListener('mousedown', e => {
  const t = e.target.closest('[data-i]');
  if (!t) return;
  e.preventDefault();
  isSelecting = true;
  const i = parseInt(t.dataset.i, 10);
  selStart = i;
  selEnd = i;
  applySelectionHighlight();
  renderSelection();
});
bytesEl.addEventListener('mousemove', e => {
  if (!isSelecting) return;
  const t = e.target.closest('[data-i]');
  if (!t) return;
  selEnd = parseInt(t.dataset.i, 10);
  applySelectionHighlight();
  renderSelection();
});
window.addEventListener('mouseup', () => { isSelecting = false; });

function applySelectionHighlight() {
  const lo = Math.min(selStart, selEnd);
  const hi = Math.max(selStart, selEnd);
  bytesEl.querySelectorAll('[data-i]').forEach(el => {
    const i = parseInt(el.dataset.i, 10);
    if (selStart >= 0 && i >= lo && i <= hi) el.classList.add('sel');
    else el.classList.remove('sel');
  });
}

function renderSelection() {
  const textEl = document.getElementById('text');
  const info = document.getElementById('sel-info');
  if (selStart < 0 || !pdfBytes) {
    textEl.innerHTML = '<span class="placeholder">Click and drag across bytes on the left to convert them to plain text here.</span>';
    info.textContent = 'no selection';
    return;
  }
  const lo = Math.min(selStart, selEnd);
  const hi = Math.max(selStart, selEnd);
  const slice = pdfBytes.subarray(lo, hi + 1);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: false }).decode(slice);
  } catch {
    text = Array.from(slice).map(b => String.fromCharCode(b)).join('');
  }
  textEl.textContent = text;
  info.textContent = `bytes ${lo}–${hi} (${hi - lo + 1} bytes)`;
}

// ============ Controls ============
document.getElementById('apply').addEventListener('click', () => {
  const s = parseInt(document.getElementById('start').value, 10) || 0;
  const e = parseInt(document.getElementById('end').value, 10) || 0;
  if (e <= s) { alert('End must be greater than start.'); return; }
  viewStart = Math.max(0, s);
  viewEnd = Math.min(pdfBytes.length, e);
  renderBytes();
});
document.getElementById('jump-start').addEventListener('click', () => {
  viewStart = 0;
  viewEnd = Math.min(2048, pdfBytes.length);
  document.getElementById('start').value = viewStart;
  document.getElementById('end').value = viewEnd;
  renderBytes();
});
document.getElementById('jump-end').addEventListener('click', () => {
  viewStart = Math.max(0, pdfBytes.length - 2048);
  viewEnd = pdfBytes.length;
  document.getElementById('start').value = viewStart;
  document.getElementById('end').value = viewEnd;
  renderBytes();
});
document.getElementById('clear-sel').addEventListener('click', () => {
  selStart = -1;
  selEnd = -1;
  applySelectionHighlight();
  renderSelection();
});

// ============ Copy buttons ============
// Builds just the hex bytes for a range — space-separated, wrapped 16 per line.
// No offset column, no ASCII gutter. Paste-able straight back into the hex parser.
function formatHexBytes(start, end) {
  const ROW = 16;
  let out = '';
  for (let row = start; row < end; row += ROW) {
    const rowEnd = Math.min(row + ROW, end);
    let hex = '';
    for (let i = row; i < rowEnd; i++) {
      hex += pdfBytes[i].toString(16).padStart(2, '0').toUpperCase() + ' ';
    }
    out += hex.trimEnd() + '\n';
  }
  return out;
}

async function copyText(text, btn) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
  }
  flashCopied(btn);
}

function flashCopied(btn) {
  if (!btn) return;
  if (btn.dataset.label === undefined) btn.dataset.label = btn.textContent;
  btn.textContent = 'Copied!';
  clearTimeout(btn._flashTimer);
  btn._flashTimer = setTimeout(() => { btn.textContent = btn.dataset.label; }, 1200);
}

document.getElementById('copy-sel-bytes').addEventListener('click', e => {
  if (!pdfBytes || selStart < 0) return;
  const lo = Math.min(selStart, selEnd);
  const hi = Math.max(selStart, selEnd);
  copyText(formatHexBytes(lo, hi + 1), e.currentTarget);
});

document.getElementById('copy-all-bytes').addEventListener('click', e => {
  if (!pdfBytes) return;
  copyText(formatHexBytes(0, pdfBytes.length), e.currentTarget);
});

document.getElementById('copy-all-text').addEventListener('click', e => {
  if (!pdfBytes || selStart < 0) return;
  copyText(document.getElementById('text').textContent, e.currentTarget);
});

// ============ PDF field detection ============
function bytesToString(slice) {
  let s = '';
  for (let i = 0; i < slice.length; i++) s += String.fromCharCode(slice[i]);
  return s;
}

function findAll(needle) {
  const results = [];
  if (!pdfBytes) return results;
  const needleBytes = new TextEncoder().encode(needle);
  outer: for (let i = 0; i <= pdfBytes.length - needleBytes.length; i++) {
    for (let j = 0; j < needleBytes.length; j++) {
      if (pdfBytes[i + j] !== needleBytes[j]) continue outer;
    }
    results.push(i);
    i += needleBytes.length - 1;
  }
  return results;
}

function findLast(needle) {
  const all = findAll(needle);
  return all.length ? all[all.length - 1] : -1;
}

function readDictionary(startOffset) {
  const str = bytesToString(pdfBytes.subarray(startOffset, Math.min(startOffset + 4096, pdfBytes.length)));
  const open = str.indexOf('<<');
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < str.length - 1; i++) {
    if (str[i] === '<' && str[i + 1] === '<') { depth++; i++; }
    else if (str[i] === '>' && str[i + 1] === '>') { depth--; i++; if (depth === 0) return str.slice(open + 2, i - 1); }
  }
  return null;
}

function extractDictField(dict, name) {
  if (!dict) return null;
  const re = new RegExp('\\/' + name + '\\s*(.*?)(?=\\s*\\/[A-Z][A-Za-z0-9]*\\s|\\s*$)', 's');
  const m = dict.match(re);
  if (!m) return null;
  return m[1].trim();
}

function decodeLiteralString(s) {
  s = s.trim();
  if (s.startsWith('(') && s.endsWith(')')) {
    let out = '';
    const inner = s.slice(1, -1);
    for (let i = 0; i < inner.length; i++) {
      const c = inner[i];
      if (c === '\\' && i + 1 < inner.length) {
        const n = inner[i + 1];
        if (n === 'n') { out += '\n'; i++; }
        else if (n === 'r') { out += '\r'; i++; }
        else if (n === 't') { out += '\t'; i++; }
        else if (n === '(' || n === ')' || n === '\\') { out += n; i++; }
        else if (/[0-7]/.test(n)) {
          let oct = n; i++;
          if (i + 1 < inner.length && /[0-7]/.test(inner[i + 1])) { oct += inner[i + 1]; i++; }
          if (i + 1 < inner.length && /[0-7]/.test(inner[i + 1])) { oct += inner[i + 1]; i++; }
          out += String.fromCharCode(parseInt(oct, 8));
        } else { out += n; i++; }
      } else { out += c; }
    }
    return out;
  }
  if (s.startsWith('<') && s.endsWith('>')) {
    const hex = s.slice(1, -1).replace(/\s+/g, '');
    let out = '';
    for (let i = 0; i + 1 < hex.length; i += 2) {
      out += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    if (out.charCodeAt(0) === 0xFE && out.charCodeAt(1) === 0xFF) {
      let utf16 = '';
      for (let i = 2; i + 1 < out.length; i += 2) {
        utf16 += String.fromCharCode((out.charCodeAt(i) << 8) | out.charCodeAt(i + 1));
      }
      return utf16;
    }
    return out;
  }
  return s;
}

function renderFields() {
  if (!pdfBytes) return;
  const tbody = document.getElementById('fields-body');
  const rows = [];

  rows.push({ section: 'File header' });
  const headerStr = bytesToString(pdfBytes.subarray(0, Math.min(32, pdfBytes.length)));
  const headerMatch = headerStr.match(/%PDF-(\d\.\d)/);
  rows.push({
    name: '%PDF version',
    value: headerMatch ? headerMatch[0] : null,
    desc: 'Magic number at the start of every PDF. Identifies file as PDF and gives spec version (1.0–2.0).',
  });
  const firstLineEnd = headerStr.indexOf('\n');
  const secondLine = firstLineEnd >= 0 ? pdfBytes.subarray(firstLineEnd + 1, Math.min(firstLineEnd + 8, pdfBytes.length)) : null;
  const hasBinaryMarker = secondLine && Array.from(secondLine).filter(b => b > 127).length >= 4;
  rows.push({
    name: 'Binary marker',
    value: hasBinaryMarker ? 'Present (≥4 bytes >127 in line 2)' : null,
    desc: 'Comment line with high-byte chars on line 2. Tells transfer programs to treat the file as binary.',
  });

  rows.push({ section: 'Trailer & cross-reference' });
  const eofOff = findLast('%%EOF');
  rows.push({
    name: '%%EOF marker',
    value: eofOff >= 0 ? `offset ${eofOff} (0x${eofOff.toString(16).toUpperCase()})` : null,
    desc: 'End-of-file marker. Must appear at the very end of the file.',
  });
  const startxrefOff = findLast('startxref');
  let xrefOffset = null;
  if (startxrefOff >= 0) {
    const after = bytesToString(pdfBytes.subarray(startxrefOff + 9, Math.min(startxrefOff + 40, pdfBytes.length)));
    const m = after.match(/\s*(\d+)/);
    if (m) xrefOffset = parseInt(m[1], 10);
  }
  rows.push({
    name: 'startxref',
    value: startxrefOff >= 0 ? `at offset ${startxrefOff}, points to ${xrefOffset}` : null,
    desc: 'Tells PDF readers the byte offset of the xref table. Located just before %%EOF.',
  });
  const xrefOff = findLast('\nxref');
  rows.push({
    name: 'xref table',
    value: xrefOff >= 0 ? `offset ${xrefOff + 1}` : 'Not found (may be a compressed xref stream)',
    desc: 'Cross-reference table listing byte offsets of every indirect object in the file.',
  });
  const trailerOff = findLast('trailer');
  let trailerDict = null;
  if (trailerOff >= 0) trailerDict = readDictionary(trailerOff);
  rows.push({
    name: 'trailer dictionary',
    value: trailerOff >= 0 ? `offset ${trailerOff}` : null,
    desc: 'Dictionary at the end of the file pointing to /Root, /Info, /Size, and /ID.',
  });
  rows.push({ name: '/Size', value: extractDictField(trailerDict, 'Size'), desc: 'Total number of entries in the cross-reference table (one more than the largest object number).' });
  rows.push({ name: '/Root', value: extractDictField(trailerDict, 'Root'), desc: 'Indirect reference to the document catalog object — the root of the PDF object tree.' });
  rows.push({ name: '/Info', value: extractDictField(trailerDict, 'Info'), desc: 'Indirect reference to the document information dictionary (metadata: title, author, etc.).' });
  rows.push({ name: '/ID', value: extractDictField(trailerDict, 'ID'), desc: 'File identifier — pair of byte strings used by readers and digital signatures.' });
  rows.push({ name: '/Encrypt', value: extractDictField(trailerDict, 'Encrypt'), desc: 'Reference to the encryption dictionary. Only present if the PDF is encrypted/password-protected.' });

  rows.push({ section: 'Document info dictionary' });
  const metaFields = [
    ['Title', 'Document title.'],
    ['Author', 'Document author.'],
    ['Subject', 'Document subject.'],
    ['Keywords', 'Comma-separated keywords.'],
    ['Creator', 'Application that originally created the document (e.g. Word, InDesign).'],
    ['Producer', 'Application that converted/produced the PDF (e.g. Distiller, Ghostscript).'],
    ['CreationDate', 'Date document was created. Format: D:YYYYMMDDHHmmSS±HH\'mm\'.'],
    ['ModDate', 'Date document was last modified. Same format as CreationDate.'],
  ];
  for (const [name, desc] of metaFields) {
    const offs = findAll('/' + name);
    let val = null;
    for (const off of offs) {
      const after = bytesToString(pdfBytes.subarray(off + name.length + 1, Math.min(off + name.length + 1 + 512, pdfBytes.length)));
      const trimmed = after.replace(/^\s+/, '');
      if (trimmed.startsWith('(')) {
        let depth = 0, end = -1;
        for (let i = 0; i < trimmed.length; i++) {
          const c = trimmed[i];
          if (c === '\\') { i++; continue; }
          if (c === '(') depth++;
          else if (c === ')') { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end >= 0) { val = decodeLiteralString(trimmed.slice(0, end + 1)); break; }
      } else if (trimmed.startsWith('<') && !trimmed.startsWith('<<')) {
        const end = trimmed.indexOf('>');
        if (end >= 0) { val = decodeLiteralString(trimmed.slice(0, end + 1)); break; }
      }
    }
    rows.push({ name: '/' + name, value: val, desc });
  }

  rows.push({ section: 'Catalog & page structure' });
  rows.push({ name: '/Type /Catalog', value: findAll('/Type /Catalog').length || findAll('/Type/Catalog').length ? 'Found' : null, desc: 'The document catalog — root object referenced by /Root in trailer. Contains /Pages, /Outlines, /Metadata.' });
  rows.push({ name: '/Type /Pages', value: (() => { const c = findAll('/Type /Pages').length + findAll('/Type/Pages').length; return c ? `${c} occurrence${c === 1 ? '' : 's'}` : null; })(), desc: 'Page tree node. Contains /Kids array of pages or sub-trees and a /Count of leaf pages.' });
  rows.push({ name: '/Type /Page', value: (() => { const c = findAll('/Type /Page\n').length + findAll('/Type /Page ').length + findAll('/Type/Page\n').length + findAll('/Type/Page ').length + findAll('/Type /Page/').length; return c ? `${c} page object${c === 1 ? '' : 's'} found` : null; })(), desc: 'Individual page object. Holds /MediaBox, /Resources, /Contents.' });
  rows.push({ name: '/Count', value: (() => { const off = findAll('/Count').find(o => { const ctx = bytesToString(pdfBytes.subarray(Math.max(0, o - 200), o)); return /\/Type\s*\/Pages/.test(ctx); }); if (off === undefined) return null; const after = bytesToString(pdfBytes.subarray(off + 6, off + 30)); const m = after.match(/\s*(\d+)/); return m ? `${m[1]} pages` : null; })(), desc: 'Number of leaf page nodes under a /Pages tree node. Top-level /Count = total page count.' });
  rows.push({ name: '/MediaBox', value: (() => { const off = findAll('/MediaBox')[0]; if (off === undefined) return null; const after = bytesToString(pdfBytes.subarray(off + 9, off + 60)); const m = after.match(/\s*\[([^\]]+)\]/); return m ? `[${m[1].trim()}]` : null; })(), desc: 'Page boundary in default user-space units (1/72 inch). [llx lly urx ury].' });

  rows.push({ section: 'Objects & streams' });
  rows.push({ name: 'obj / endobj', value: (() => { const o = findAll(' obj').length + findAll('\nobj').length; const e = findAll('endobj').length; return `${o} obj, ${e} endobj`; })(), desc: 'Indirect objects: "N G obj" ... "endobj". Form the building blocks of the PDF.' });
  rows.push({ name: 'stream / endstream', value: (() => { const c = findAll('endstream').length; return c ? `${c} stream${c === 1 ? '' : 's'}` : null; })(), desc: 'Stream objects hold binary data — page content, fonts, images. Bracketed by stream/endstream.' });
  rows.push({ name: '/Filter', value: (() => { const filters = ['FlateDecode','ASCIIHexDecode','ASCII85Decode','LZWDecode','RunLengthDecode','CCITTFaxDecode','JBIG2Decode','DCTDecode','JPXDecode','Crypt']; const found = filters.filter(f => findAll('/' + f).length > 0); return found.length ? found.join(', ') : null; })(), desc: 'Compression/encoding applied to a stream. /FlateDecode = zlib, /DCTDecode = JPEG, etc.' });
  rows.push({ name: '/Length', value: findAll('/Length').length ? `${findAll('/Length').length} occurrence${findAll('/Length').length === 1 ? '' : 's'}` : null, desc: 'Byte length of the data between stream and endstream keywords.' });

  rows.push({ section: 'Fonts & resources' });
  rows.push({ name: '/Font', value: findAll('/Font').length ? `${findAll('/Font').length} reference${findAll('/Font').length === 1 ? '' : 's'}` : null, desc: 'Font resource references inside /Resources dictionaries.' });
  rows.push({ name: '/Type /Font', value: (() => { const subtypes = ['Type0','Type1','Type3','TrueType','MMType1','CIDFontType0','CIDFontType2']; const found = subtypes.filter(s => findAll('/Subtype /' + s).length || findAll('/Subtype/' + s).length); return found.length ? found.join(', ') : null; })(), desc: 'Font subtypes embedded in the document.' });
  rows.push({ name: '/XObject', value: findAll('/XObject').length ? 'Present' : null, desc: 'External objects — typically embedded images (/Subtype /Image) or reusable form XObjects.' });
  rows.push({ name: 'Embedded images', value: (() => { const c = findAll('/Subtype /Image').length + findAll('/Subtype/Image').length; return c ? `${c} image XObject${c === 1 ? '' : 's'}` : null; })(), desc: 'Image XObjects in the file. Each is a stream with /Width, /Height, /ColorSpace, /Filter.' });

  rows.push({ section: 'Forms, annotations & signatures' });
  rows.push({ name: '/AcroForm', value: findAll('/AcroForm').length ? 'Present (interactive form)' : null, desc: 'Interactive form (AcroForm) dictionary in the catalog. Contains form field definitions.' });
  rows.push({ name: '/Annot', value: (() => { const c = findAll('/Type /Annot').length + findAll('/Type/Annot').length; return c ? `${c} annotation${c === 1 ? '' : 's'}` : null; })(), desc: 'Annotations — links, comments, form fields, highlights overlaid on pages.' });
  rows.push({ name: '/Sig', value: findAll('/Type /Sig').length || findAll('/ByteRange').length ? 'Digital signature present' : null, desc: 'Digital signature dictionary. /ByteRange describes which bytes the signature covers.' });

  rows.push({ section: 'Other' });
  rows.push({ name: '/Metadata', value: findAll('/Metadata').length ? 'Present (XMP)' : null, desc: 'Reference to an XMP metadata stream — XML-based metadata supplementing /Info.' });
  rows.push({ name: '/Outlines', value: findAll('/Outlines').length ? 'Present (bookmarks)' : null, desc: 'Document outline (bookmark tree) shown in the reader sidebar.' });
  rows.push({ name: 'Linearized', value: findAll('/Linearized').length ? 'Yes (fast web view)' : null, desc: 'Linearization (Fast Web View) dictionary near the start. Allows progressive rendering.' });
  rows.push({ name: 'Incremental updates', value: (() => { const eofs = findAll('%%EOF'); return eofs.length > 1 ? `${eofs.length} %%EOF markers (${eofs.length - 1} update${eofs.length - 1 === 1 ? '' : 's'})` : null; })(), desc: 'Multiple %%EOF markers indicate the file was updated incrementally (appended revisions).' });

  let html = '';
  for (const r of rows) {
    if (r.section) {
      html += `<tr class="section-header"><td colspan="3">${escapeHtml(r.section)}</td></tr>`;
      continue;
    }
    const v = r.value;
    let cell;
    if (v === null || v === undefined || v === '') {
      cell = '<span class="missing">not present</span>';
    } else {
      cell = escapeHtml(String(v));
    }
    html += `<tr><td>${escapeHtml(r.name)}</td><td class="value">${cell}</td><td>${escapeHtml(r.desc)}</td></tr>`;
  }
  tbody.innerHTML = html;
}

// ============ Object format validation ============
// Checks whether an indirect object is structurally well-formed per the PDF
// spec (ISO 32000): "N G obj" header, an "endobj" terminator, balanced
// dictionary/array/string delimiters, and — for stream objects — a correctly
// delimited stream body with a /Length entry.
function checkObjectFormat(o) {
  const issues = [];

  // Header object & generation numbers must be valid integers (gen ≥ 0).
  if (!/^\d+$/.test(o.num) || parseInt(o.num, 10) < 1) {
    issues.push('Object number must be a positive integer.');
  }
  if (!/^\d+$/.test(o.gen)) {
    issues.push('Generation number must be a non-negative integer.');
  }

  // Must terminate with "endobj".
  if (!o.hasEndobj) {
    issues.push('No "endobj" terminator — object is truncated or runs into the next one.');
  }

  // For stream objects, the binary stream data must be excluded from the
  // delimiter-balance scan, and the stream markers checked separately.
  let scanText = o.body;
  if (o.isStream) {
    const sm = /(^|[\s>\]])stream([ \t]*)(\r\n|\n|\r)?/.exec(o.body);
    if (sm) {
      const streamKwStart = sm.index + sm[1].length; // index of 's' in "stream"
      scanText = o.body.slice(0, streamKwStart);
      // Spec: "stream" shall be followed by CRLF or a single LF — not a lone CR.
      const eol = sm[3];
      if (eol === undefined) {
        issues.push('"stream" keyword is not followed by a newline.');
      } else if (eol === '\r') {
        issues.push('"stream" keyword followed by a lone CR (spec requires CRLF or LF).');
      }
      if (!/endstream/.test(o.body)) {
        issues.push('Stream object is missing its "endstream" keyword.');
      }
      if (!/\/Length\b/.test(scanText)) {
        issues.push('Stream dictionary is missing the required /Length entry.');
      }
    } else {
      issues.push('Stream object detected but the "stream" keyword could not be located.');
    }
  }

  // A second "N G obj" header inside the dictionary/value region means this
  // object was never closed (its endobj is missing and we scanned past it).
  if (/\d+\s+\d+\s+obj\b/.test(scanText)) {
    issues.push('Another "N G obj" header appears before "endobj" — missing terminator.');
  }

  issues.push(...checkDelimiterBalance(scanText));

  return { ok: issues.length === 0, issues };
}

// Scans a chunk of object text and reports unbalanced dictionary (<< >>),
// array ([ ]) or string delimiters. Lexes literal strings, hex strings and
// comments so that delimiter characters inside them are not miscounted.
function checkDelimiterBalance(s) {
  const issues = [];
  let dictDepth = 0;
  let arrDepth = 0;
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === '%') { // comment: skip to end of line
      while (i < n && s[i] !== '\n' && s[i] !== '\r') i++;
      continue;
    }
    if (c === '(') { // literal string — parens may nest, \ escapes next char
      let depth = 1; i++;
      while (i < n && depth > 0) {
        const ch = s[i];
        if (ch === '\\') { i += 2; continue; }
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        i++;
      }
      if (depth !== 0) { issues.push('Unbalanced parentheses in a literal string.'); break; }
      continue;
    }
    if (c === '<') {
      if (s[i + 1] === '<') { dictDepth++; i += 2; continue; } // dict open
      i++; // hex string
      while (i < n && s[i] !== '>') i++;
      if (i >= n) { issues.push('Unterminated hex string (missing ">").'); break; }
      i++;
      continue;
    }
    if (c === '>') {
      if (s[i + 1] === '>') {
        dictDepth--; i += 2;
        if (dictDepth < 0) { issues.push('Unbalanced dictionary: an extra ">>".'); break; }
        continue;
      }
      i++;
      continue;
    }
    if (c === '[') { arrDepth++; i++; continue; }
    if (c === ']') {
      arrDepth--; i++;
      if (arrDepth < 0) { issues.push('Unbalanced array: an extra "]".'); break; }
      continue;
    }
    i++;
  }
  if (dictDepth > 0) issues.push(`Unbalanced dictionary: ${dictDepth} unclosed "<<".`);
  if (arrDepth > 0) issues.push(`Unbalanced array: ${arrDepth} unclosed "[".`);
  return issues;
}

// ============ PDF object table ============
function parseObjects() {
  const objs = [];
  if (!pdfBytes) return objs;
  const full = bytesToString(pdfBytes);
  const objRe = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = objRe.exec(full)) !== null) {
    const startOff = m.index;
    const bodyStart = objRe.lastIndex;
    const endIdx = full.indexOf('endobj', bodyStart);
    const body = endIdx >= 0 ? full.slice(bodyStart, endIdx) : full.slice(bodyStart, Math.min(bodyStart + 4096, full.length));
    const endOff = endIdx >= 0 ? endIdx + 6 : Math.min(bodyStart + 4096, full.length);

    const typeMatch = body.match(/\/Type\s*\/([A-Za-z0-9]+)/);
    const subMatch = body.match(/\/Subtype\s*\/([A-Za-z0-9]+)/);
    const isStream = /(^|[\s>])stream(\r\n|\r|\n)/.test(body);
    const lenMatch = body.match(/\/Length\s+(\d+\s+\d+\s+R|\d+)/);

    // The dictionary / value region — the body with any binary stream payload
    // trimmed off so reference scanning never touches compressed bytes.
    let dictText = body;
    if (isStream) {
      const sm = /(^|[\s>\]])stream([ \t]*)(\r\n|\n|\r)?/.exec(body);
      if (sm) dictText = body.slice(0, sm.index + sm[1].length);
    }
    if (dictText.length > 65536) dictText = dictText.slice(0, 65536);

    // Forward (ownership) references only — /Parent and /P are back-references
    // (page→tree, annotation→page) and must be excluded, or a stray back-link
    // would make a detached subtree look "reachable" from /Root.
    const fwdText = dictText
      .replace(/\/Parent\s+\d+\s+\d+\s+R/g, ' ')
      .replace(/\/P\s+\d+\s+\d+\s+R(?=[^A-Za-z0-9]|$)/g, ' ');

    const { ok, issues } = checkObjectFormat({
      num: m[1],
      gen: m[2],
      body,
      hasEndobj: endIdx >= 0,
      isStream,
    });

    objs.push({
      num: m[1],
      gen: m[2],
      type: typeMatch ? typeMatch[1] : null,
      subtype: subMatch ? subMatch[1] : null,
      isStream,
      length: lenMatch ? lenMatch[1].replace(/\s+/g, ' ') : null,
      startOff,
      endOff,
      valid: ok,
      issues,
      dictText,
      refs: extractRefs(dictText),
      forwardRefs: extractRefs(fwdText),
    });
    // Skip past this object's body so "N G obj" byte sequences inside stream
    // data aren't mistaken for real object headers.
    if (endIdx >= 0) objRe.lastIndex = endOff;
  }
  return objs;
}

// ============ Reference / structure analysis ============
// Pulls every "N G R" indirect reference out of a chunk of dictionary text.
function extractRefs(text) {
  const refs = [];
  const re = /(\d+)\s+(\d+)\s+R(?=[^A-Za-z0-9]|$)/g;
  let m;
  while ((m = re.exec(text)) !== null) refs.push(m[1] + ' ' + m[2]);
  return refs;
}

// First "/Name N G R" reference for a given key, e.g. extractNamedRef(d, 'Root').
function extractNamedRef(text, name) {
  const m = text.match(new RegExp('\\/' + name + '\\s+(\\d+)\\s+(\\d+)\\s+R(?=[^A-Za-z0-9]|$)'));
  return m ? m[1] + ' ' + m[2] : null;
}

// Refs listed inside a /Kids [ ... ] array.
function extractKidRefs(text) {
  const m = text.match(/\/Kids\s*\[([\s\S]*?)\]/);
  return m ? extractRefs(m[1]) : [];
}

// Direct integer value of a /Name, e.g. /Count 4. Returns null for indirect refs.
function extractNamedInt(text, name) {
  const m = text.match(new RegExp('\\/' + name + '\\s+(\\d+)(?![\\d\\s]*R\\b)'));
  return m ? parseInt(m[1], 10) : null;
}

// Builds a reference graph over the parsed objects, walks reachability from the
// trailer's /Root, then reconstructs the catalog's page tree and flags anything
// that hangs off a different root (orphaned page trees / pages / annotations).
function analyzeStructure(objs) {
  const byKey = new Map();
  const byNum = new Map();
  for (const o of objs) {
    byKey.set(o.num + ' ' + o.gen, o);
    if (!byNum.has(o.num)) byNum.set(o.num, o);
  }
  const keyOf = o => o.num + ' ' + o.gen;
  const resolve = ref => {
    if (!ref) return null;
    if (byKey.has(ref)) return byKey.get(ref);
    return byNum.get(ref.split(' ')[0]) || null; // tolerate gen mismatch
  };

  // ---- Seed roots: trailer /Root /Info /Encrypt, else xref-stream, else any catalog ----
  const trailerOff = findLast('trailer');
  const trailerDict = trailerOff >= 0 ? readDictionary(trailerOff) : null;
  let rootRef = trailerDict ? extractNamedRef(trailerDict, 'Root') : null;
  let infoRef = trailerDict ? extractNamedRef(trailerDict, 'Info') : null;
  let encryptRef = trailerDict ? extractNamedRef(trailerDict, 'Encrypt') : null;
  if (!rootRef) {
    const xref = objs.find(o => o.type === 'XRef');
    if (xref) {
      rootRef = extractNamedRef(xref.dictText, 'Root');
      infoRef = infoRef || extractNamedRef(xref.dictText, 'Info');
    }
  }
  const catalogs = objs.filter(o => o.type === 'Catalog');
  if (!rootRef && catalogs.length) rootRef = keyOf(catalogs[0]);

  // ---- Reachability walk from the seeds ----
  const reachable = new Set();
  const stack = [];
  for (const seed of [rootRef, infoRef, encryptRef]) {
    const t = resolve(seed);
    if (t) stack.push(keyOf(t));
  }
  while (stack.length) {
    const key = stack.pop();
    if (reachable.has(key)) continue;
    reachable.add(key);
    const o = resolve(key);
    if (!o) continue;
    for (const r of o.forwardRefs) {
      const t = resolve(r);
      if (t && !reachable.has(keyOf(t))) stack.push(keyOf(t));
    }
  }

  // Cross-reference streams, object streams and the linearization dict are
  // structural infrastructure — not referenced from /Root, but not orphans.
  const isInfra = o => o.type === 'XRef' || o.type === 'ObjStm' || /\/Linearized\b/.test(o.dictText);

  for (const o of objs) {
    o.reachable = reachable.has(keyOf(o));
    o.infra = isInfra(o);
    o.orphan = !o.reachable && !o.infra;
  }

  // ---- Reconstruct the catalog's page tree ----
  const issues = [];
  const inCatalogTree = new Set();
  const catalog = resolve(rootRef);
  let pageTree = null;
  let leafCount = 0;

  if (catalogs.length > 1) {
    issues.push({ level: 'warn', text: `Multiple /Type /Catalog objects (${catalogs.map(keyOf).join(', ')}). Only ${rootRef} is referenced by the trailer /Root.` });
  }

  if (catalog) {
    const pagesRef = extractNamedRef(catalog.dictText, 'Pages');
    if (!pagesRef) {
      issues.push({ level: 'error', text: `Catalog ${keyOf(catalog)} has no /Pages entry.` });
    } else {
      pageTree = buildPageNode(pagesRef, null, new Set());
    }
  } else {
    issues.push({ level: 'error', text: 'No document catalog (/Root) could be resolved.' });
  }

  function buildPageNode(ref, parentKey, ancestors) {
    const o = resolve(ref);
    if (!o) {
      issues.push({ level: 'error', text: `Page-tree reference ${ref} does not resolve to any object.` });
      return { unresolved: ref };
    }
    const key = keyOf(o);
    if (ancestors.has(key)) {
      issues.push({ level: 'error', text: `Cycle in page tree at ${key}.` });
      return { obj: o, key, cycle: true, children: [] };
    }
    inCatalogTree.add(key);

    const node = { obj: o, key, children: [], parentIssue: null };
    const parentRef = extractNamedRef(o.dictText, 'Parent');
    const parentObj = resolve(parentRef);
    if (parentKey === null) {
      // root pages node — /Parent should be absent
    } else if (!parentRef) {
      node.parentIssue = 'missing /Parent';
    } else if (!parentObj || keyOf(parentObj) !== parentKey) {
      node.parentIssue = `/Parent ${parentRef || '—'} ≠ actual parent ${parentKey}`;
    }

    const kids = extractKidRefs(o.dictText);
    const isPagesNode = o.type === 'Pages' || (!o.type && kids.length > 0);
    if (isPagesNode) {
      node.count = extractNamedInt(o.dictText, 'Count');
      const nextAnc = new Set(ancestors); nextAnc.add(key);
      for (const k of kids) node.children.push(buildPageNode(k, key, nextAnc));
    } else {
      leafCount++; // a /Page (or leaf) node
    }
    return node;
  }

  // ---- Orphan classification across the whole file ----
  const orphanPageTrees = objs.filter(o => o.type === 'Pages' && !inCatalogTree.has(keyOf(o)));
  const orphanPages = objs.filter(o => o.type === 'Page' && !inCatalogTree.has(keyOf(o)));

  for (const o of orphanPageTrees) {
    issues.push({ level: 'error', text: `Orphaned page tree: ${keyOf(o)} /Pages is never reached from the catalog. Its /Kids are detached from the document.`, jump: o });
  }
  for (const o of orphanPages) {
    issues.push({ level: 'error', text: `Orphaned page: ${keyOf(o)} /Page is not in the catalog's page tree.`, jump: o });
  }

  // Annotations whose /P (host page) points outside the catalog page tree —
  // the classic back-reference that breaks readers walking the object graph.
  const annotSubtypes = /\/Subtype\s*\/(Link|Widget|Popup|Text|FreeText|Line|Square|Circle|Polygon|PolyLine|Highlight|Underline|Squiggly|StrikeOut|Stamp|Caret|Ink|FileAttachment|Sound|Redact)/;
  for (const o of objs) {
    if (o.type !== 'Annot' && !annotSubtypes.test(o.dictText)) continue;
    const pRef = extractNamedRef(o.dictText, 'P');
    if (!pRef) continue;
    const p = resolve(pRef);
    if (!p || !inCatalogTree.has(keyOf(p))) {
      issues.push({ level: 'error', text: `Annotation ${keyOf(o)} has /P ${pRef} pointing at a page (${p ? keyOf(p) : 'unresolved'}) that is NOT in the catalog page tree.`, jump: o });
    }
  }

  // Stray /Annots on a non-page object (e.g. a Bluebeam "melted" content
  // stream) — the trigger that drags an orphaned tree into a merge output.
  for (const o of objs) {
    if (o.type === 'Page') continue;
    if (/\/Annots\b/.test(o.dictText)) {
      issues.push({ level: 'warn', text: `${keyOf(o)} (${o.type ? '/' + o.type : o.isStream ? 'stream, no /Type' : 'no /Type'}) carries a stray /Annots array — unusual outside a /Page and a known cause of back-reference walks.`, jump: o });
    }
  }

  // ---- /Count sanity at the tree root ----
  if (pageTree && pageTree.count != null && pageTree.count !== leafCount) {
    issues.push({ level: 'warn', text: `Root /Pages /Count is ${pageTree.count} but ${leafCount} leaf page${leafCount === 1 ? '' : 's'} were found in the tree.` });
  }

  const orphanCount = objs.filter(o => o.orphan).length;
  return {
    rootRef, infoRef, encryptRef, catalog, pageTree, leafCount,
    reachableCount: objs.filter(o => o.reachable).length,
    infraCount: objs.filter(o => o.infra && !o.reachable).length,
    orphanCount, orphanPageTrees, orphanPages, issues,
    resolve, keyOf, inCatalogTree,
  };
}

function renderObjects(objs, model) {
  if (!pdfBytes) return;
  const tbody = document.getElementById('objects-body');

  document.getElementById('objects-count').textContent =
    objs.length ? `${objs.length.toLocaleString()} object${objs.length === 1 ? '' : 's'}` : 'none found';

  if (!objs.length) {
    tbody.innerHTML = '<tr><td colspan="8"><span class="missing">No indirect objects found (the file may use cross-reference / object streams).</span></td></tr>';
    return;
  }

  let html = '';
  for (const o of objs) {
    const type = o.type ? escapeHtml('/' + o.type) : '<span class="missing">—</span>';
    const subtype = o.subtype ? escapeHtml('/' + o.subtype) : '<span class="missing">—</span>';
    const stream = o.isStream ? '<span class="ok">yes</span>' : '<span class="missing">—</span>';
    const length = o.length != null ? escapeHtml(o.length) : '<span class="missing">—</span>';
    const valid = o.valid
      ? '<span class="ok" title="Well-formed: valid header, balanced delimiters, and stream markers all check out.">✓</span>'
      : `<span class="bad" title="${escapeHtml(o.issues.join(' • '))}">✗</span>`;
    let reach;
    if (o.reachable) reach = '<span class="ok" title="Reachable from the trailer /Root by following indirect references.">✓ linked</span>';
    else if (o.infra) reach = '<span class="missing" title="Cross-reference / object stream / linearization infrastructure — not referenced from /Root, but not an orphan.">infra</span>';
    else reach = '<span class="bad" title="Not reachable from the document root — this object is orphaned. See the Document structure tab.">⚠ orphan</span>';
    const hex = '0x' + o.startOff.toString(16).toUpperCase();
    html += `<tr${o.orphan ? ' class="orphan-row"' : ''}>` +
      `<td>${escapeHtml(o.num + ' ' + o.gen)} obj</td>` +
      `<td class="value">${type}</td>` +
      `<td class="value">${subtype}</td>` +
      `<td class="value">${stream}</td>` +
      `<td class="value">${length}</td>` +
      `<td class="value valid-cell">${valid}</td>` +
      `<td class="value reach-cell">${reach}</td>` +
      `<td class="value"><span class="obj-offset" data-start="${o.startOff}" data-end="${o.endOff}">${o.startOff} (${hex})</span></td>` +
      `</tr>`;
  }
  tbody.innerHTML = html;
}

// ============ Structure summary + issues (Common PDF fields tab) ============
function renderStructure(objs, model) {
  if (!pdfBytes) return;
  const summaryEl = document.getElementById('structure-summary-body');
  const issuesEl = document.getElementById('structure-issues-body');
  const issuesCount = document.getElementById('structure-issues-count');
  const treeEl = document.getElementById('structure-tree-body');
  const treeCount = document.getElementById('structure-tree-count');

  if (!objs.length) {
    summaryEl.innerHTML = '<span class="missing">No indirect objects found to analyze.</span>';
    issuesEl.innerHTML = '';
    issuesCount.textContent = '';
    treeEl.innerHTML = '<span class="missing">No indirect objects found (the file may use compressed object streams).</span>';
    treeCount.textContent = '';
    return;
  }

  const m = model;
  // ---- Summary ----
  summaryEl.innerHTML =
    statCard('Total objects', objs.length) +
    statCard('Reachable from root', m.reachableCount, 'ok') +
    statCard('Orphaned', m.orphanCount, m.orphanCount ? 'bad' : 'ok') +
    statCard('Infrastructure', m.infraCount) +
    statCard('Leaf pages in tree', m.leafCount) +
    statCard('Root object', m.rootRef ? m.rootRef + ' obj' : '—');

  // ---- Issues ----
  const errs = m.issues.filter(i => i.level === 'error');
  const warns = m.issues.filter(i => i.level === 'warn');
  issuesCount.textContent = m.issues.length
    ? `${errs.length} error${errs.length === 1 ? '' : 's'}, ${warns.length} warning${warns.length === 1 ? '' : 's'}`
    : 'none';
  if (!m.issues.length) {
    issuesEl.innerHTML = '<div class="issue ok-issue">✓ No structural inconsistencies detected. The page tree is self-consistent and every object is reachable.</div>';
  } else {
    issuesEl.innerHTML = m.issues.map(i => {
      const cls = i.level === 'error' ? 'issue-error' : 'issue-warn';
      const icon = i.level === 'error' ? '✗' : '⚠';
      const jump = i.jump
        ? ` <span class="jump-link" data-start="${i.jump.startOff}" data-end="${i.jump.endOff}">view bytes →</span>`
        : '';
      return `<div class="issue ${cls}"><span class="issue-icon">${icon}</span><span>${escapeHtml(i.text)}${jump}</span></div>`;
    }).join('');
  }

  // ---- Full object tree (Document structure tab) ----
  const { mainTree, rootObj, entryTrees, orphanTrees } = buildObjectTrees(objs, model);
  let html = '';
  if (mainTree) {
    html += `<div class="orphan-section">Document root — ${escapeHtml(rootObj.num + ' ' + rootObj.gen)} obj${rootObj.type ? ' /' + escapeHtml(rootObj.type) : ''}</div>`;
    html += renderGraphNode(mainTree, 0);
  } else {
    html += '<div class="orphan-section">No /Root catalog resolved — showing every object subtree</div>';
  }
  if (entryTrees.length) {
    html += '<div class="orphan-section">Other trailer entries</div>';
    for (const t of entryTrees) html += renderGraphNode(t, 0);
  }
  if (orphanTrees.length) {
    html += '<div class="orphan-section">Orphaned / detached object trees</div>';
    for (const t of orphanTrees) html += renderGraphNode(t, 0);
  }
  treeEl.innerHTML = html;
  treeCount.textContent = `${objs.length} object${objs.length === 1 ? '' : 's'}` +
    (m.orphanCount ? `, ${m.orphanCount} orphaned` : '');
}

function statCard(label, value, kind) {
  const cls = kind ? ` ${kind}` : '';
  return `<div class="stat"><div class="stat-value${cls}">${escapeHtml(String(value))}</div><div class="stat-label">${escapeHtml(label)}</div></div>`;
}

// ============ Full object-graph tree ============
// Forward (ownership) edges of an object, each labelled with the dictionary key
// it hangs off of. /Parent and /P are back-references and are excluded so the
// tree only ever points downward.
function getChildEdges(o) {
  const edges = [];
  const seen = new Set();
  const add = (label, ref) => { if (!seen.has(ref)) { seen.add(ref); edges.push({ label, ref }); } };
  const re = /\/([A-Za-z0-9.+\-]+)\s*(?:(\d+)\s+(\d+)\s+R(?=[^A-Za-z0-9]|$)|\[([^\]]*)\])/g;
  let m;
  while ((m = re.exec(o.dictText)) !== null) {
    const name = m[1];
    if (name === 'Parent' || name === 'P') continue;
    if (m[2] !== undefined) {
      add('/' + name, m[2] + ' ' + m[3]);
    } else if (m[4] !== undefined) {
      const refs = extractRefs(m[4]);
      refs.forEach((r, i) => add('/' + name + (refs.length > 1 ? `[${i}]` : ''), r));
    }
  }
  // Catch any forward refs that weren't under a recognised named key.
  for (const r of o.forwardRefs) add('', r);
  return edges;
}

// Depth-first build of one object subtree. A global `visited` set means each
// object is expanded only once (at its first encounter); later references to it
// render as a collapsed "↑ ref" leaf, and cycles are broken via `ancestors`.
function buildGraphNode(edgeLabel, ref, model, visited, ancestors, depth) {
  const o = model.resolve(ref);
  if (!o) return { unresolved: ref, edgeLabel };
  const key = model.keyOf(o);
  if (ancestors.has(key)) return { obj: o, key, edgeLabel, cycle: true, children: [] };
  if (visited.has(key)) return { obj: o, key, edgeLabel, repeat: true, children: [] };
  visited.add(key);
  ancestors.add(key);
  const node = { obj: o, key, edgeLabel, children: [] };
  if (depth < 250) {
    for (const e of getChildEdges(o)) {
      node.children.push(buildGraphNode(e.label, e.ref, model, visited, ancestors, depth + 1));
    }
  } else {
    node.truncated = true;
  }
  ancestors.delete(key);
  return node;
}

function buildObjectTrees(objs, model) {
  const visited = new Set();
  const ancestors = new Set();

  // Entry point = the real document root object (the catalog that /Root names).
  const rootObj = model.resolve(model.rootRef);
  const mainTree = rootObj ? buildGraphNode('', model.keyOf(rootObj), model, visited, ancestors, 0) : null;

  // Other things the trailer points at that don't live under the catalog.
  const entryTrees = [];
  for (const [label, ref] of [['/Info', model.infoRef], ['/Encrypt', model.encryptRef]]) {
    const t = model.resolve(ref);
    if (t && !visited.has(model.keyOf(t))) {
      entryTrees.push(buildGraphNode(label + ' (trailer)', model.keyOf(t), model, visited, ancestors, 0));
    }
  }

  // Whatever is left is unreachable from the root. Show each unreached object
  // that nothing-else-unreached points to as the head of its own tree.
  const unreached = objs.filter(o => !visited.has(model.keyOf(o)));
  const referenced = new Set();
  for (const o of unreached) {
    for (const e of getChildEdges(o)) {
      const t = model.resolve(e.ref);
      if (t && !visited.has(model.keyOf(t))) referenced.add(model.keyOf(t));
    }
  }
  const orphanTrees = [];
  for (const o of unreached) {
    const key = model.keyOf(o);
    if (referenced.has(key) || visited.has(key)) continue;
    const node = buildGraphNode('', key, model, visited, ancestors, 0);
    node.orphanRoot = !o.infra;
    node.infraRoot = o.infra;
    orphanTrees.push(node);
  }
  // Stragglers trapped in a cycle with no external entry.
  for (const o of objs) {
    const key = model.keyOf(o);
    if (visited.has(key)) continue;
    const node = buildGraphNode('', key, model, visited, ancestors, 0);
    node.orphanRoot = !o.infra;
    node.infraRoot = o.infra;
    orphanTrees.push(node);
  }

  return { mainTree, rootObj, entryTrees, orphanTrees };
}

function renderGraphNode(node, depth) {
  const hasChildren = node.children && node.children.length > 0;
  const toggle = `<span class="tree-toggle${hasChildren ? '' : ' leaf'}"></span>`;
  const edge = node.edgeLabel ? `<span class="tree-edge">${escapeHtml(node.edgeLabel)}</span> ` : '';

  let label;
  if (node.unresolved) {
    label = `<span class="bad">⚠ ${escapeHtml(node.unresolved)} R — unresolved (not present, e.g. inside an object stream)</span>`;
  } else {
    const o = node.obj;
    const bits = [];
    if (o.subtype) bits.push('/' + o.subtype);
    const cnt = extractNamedInt(o.dictText, 'Count'); if (cnt != null) bits.push('/Count ' + cnt);
    const mb = (o.dictText.match(/\/MediaBox\s*\[([^\]]+)\]/) || [])[1]; if (mb) bits.push('/MediaBox [' + mb.trim() + ']');
    if (o.isStream) bits.push('stream');

    const flags = [];
    if (node.repeat) flags.push('<span class="badge-ref" title="Already shown above; expanded at its first occurrence.">↑ ref</span>');
    if (node.cycle) flags.push('<span class="badge-ref bad" title="Reference cycle — this object is an ancestor of itself.">↻ cycle</span>');
    if (node.truncated) flags.push('<span class="bad">… depth limit</span>');
    if (node.orphanRoot) flags.push('<span class="badge-detached" title="Not reachable from the document root.">orphan</span>');
    if (node.infraRoot) flags.push('<span class="badge-infra" title="Cross-reference / object stream / linearization infrastructure.">infrastructure</span>');

    label =
      `<span class="obj-offset" data-start="${o.startOff}" data-end="${o.endOff}">${escapeHtml(o.num + ' ' + o.gen)} obj</span> ` +
      `<span class="tree-type">${o.type ? '/' + escapeHtml(o.type) : ''}</span> ` +
      `<span class="tree-meta">${escapeHtml(bits.join('  '))}</span> ${flags.join(' ')}`;
  }

  let childrenHtml = '';
  if (hasChildren) {
    childrenHtml = '<div class="tree-children">' +
      node.children.map(c => renderGraphNode(c, depth + 1)).join('') + '</div>';
  }
  return `<div class="tree-item">` +
    `<div class="tree-node" style="--depth:${depth}">${toggle}${edge}${label}</div>` +
    childrenHtml +
    `</div>`;
}

// Shared: jump to a byte range from any clickable element with data-start/data-end.
function jumpToBytes(el) {
  const s = parseInt(el.dataset.start, 10);
  const eOff = parseInt(el.dataset.end, 10);
  viewStart = Math.max(0, s);
  viewEnd = Math.min(pdfBytes.length, eOff);
  // Auto-select the jumped-to range so it's highlighted and decoded to text.
  selStart = viewStart;
  selEnd = Math.max(viewStart, viewEnd - 1);
  document.getElementById('start').value = viewStart;
  document.getElementById('end').value = viewEnd;
  renderBytes();
  renderSelection();
  switchResultTab(3); // "Raw bytes & text" is the 4th result tab
}

document.getElementById('objects-body').addEventListener('click', e => {
  const t = e.target.closest('.obj-offset');
  if (!t || !pdfBytes) return;
  jumpToBytes(t);
});

document.getElementById('structure-issues-body').addEventListener('click', e => {
  const t = e.target.closest('.obj-offset, .jump-link');
  if (!t || !pdfBytes) return;
  jumpToBytes(t);
});

const treeBody = document.getElementById('structure-tree-body');
treeBody.addEventListener('click', e => {
  // Clicking a node's caret (or anywhere on a row that isn't a link) toggles it.
  const toggle = e.target.closest('.tree-toggle');
  if (toggle && !toggle.classList.contains('leaf')) {
    toggle.closest('.tree-item').classList.toggle('collapsed');
    return;
  }
  const t = e.target.closest('.obj-offset, .jump-link');
  if (!t || !pdfBytes) return;
  jumpToBytes(t);
});

document.getElementById('tree-expand').addEventListener('click', () => {
  treeBody.querySelectorAll('.tree-item.collapsed').forEach(el => el.classList.remove('collapsed'));
});
document.getElementById('tree-collapse').addEventListener('click', () => {
  // Collapse every node that actually has children, leaving the roots visible.
  treeBody.querySelectorAll('.tree-item').forEach(el => {
    if (el.querySelector(':scope > .tree-children')) el.classList.add('collapsed');
  });
});
