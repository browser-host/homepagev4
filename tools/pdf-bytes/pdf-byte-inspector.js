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
