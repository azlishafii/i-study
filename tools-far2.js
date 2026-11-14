/* FAR2-specific interactive tools (Ch4 Investment Property, Ch5 Biological Assets).
   Generic app code lives in app.js; chapters opt in via "tools": ["calc","transfer","calc5"]. */
(function () {
'use strict';
const { S, u, fmt, $, B, esc, go } = window.IS;
function calc(v) {
  const st = JSON.parse(sessionStorage.getItem('calc') || 'null') || { cost: 100000000, life: 50, res: 0, fv: [105000000, 95000000] };
  const num = (x) => Number(String(x).replace(/,/g, '')) || 0;
  v.innerHTML = `<a class="back" href="#/tools">← ${u('tools')}</a><h1>🧮 ${S.lang === 'en' ? 'Cost vs FV model' : 'Model Kos vs FV'}</h1>
  <div class="card form">
    <label>${S.lang === 'en' ? 'Cost (RM)' : 'Kos (RM)'}<input id="c" inputmode="numeric" value="${fmt(st.cost)}"></label>
    <label>${S.lang === 'en' ? 'Useful life (years)' : 'Hayat berguna (tahun)'}<input id="l" inputmode="numeric" value="${st.life}"></label>
    <label>${S.lang === 'en' ? 'Residual value (RM)' : 'Nilai sisa (RM)'}<input id="r" inputmode="numeric" value="${fmt(st.res)}"></label>
    <div class="fvs"><div class="lbl">${S.lang === 'en' ? 'Fair value at each year-end (RM)' : 'Nilai saksama hujung setiap tahun (RM)'}</div><div id="fvw"></div>
    <button class="btn ghost" id="addy">+ ${S.lang === 'en' ? 'Add year' : 'Tambah tahun'}</button> <button class="btn ghost" id="rmy">− </button></div>
  </div><div id="out"></div>`;
  const fw = $('#fvw');
  const drawFV = () => { fw.innerHTML = st.fv.map((x, i) => `<label class="inl">Y${i + 1}<input data-i="${i}" inputmode="numeric" value="${fmt(x)}"></label>`).join(''); fw.querySelectorAll('input').forEach(inp => inp.oninput = () => { st.fv[+inp.dataset.i] = num(inp.value); out(); }); };
  const out = () => {
    st.cost = num($('#c').value); st.life = Math.max(1, num($('#l').value)); st.res = num($('#r').value);
    sessionStorage.setItem('calc', JSON.stringify(st));
    const dep = (st.cost - st.res) / st.life; let prev = st.cost, rows = '', jc = '', jf = '', totC = 0, totF = 0;
    st.fv.forEach((fv, i) => {
      const y = i + 1, ca = st.cost - dep * y, g = fv - prev; totC -= dep; totF += g;
      rows += `<tr><th>Y${y}</th><td>${fmt(-dep)}</td><td>${fmt(ca)}</td><td class="${g >= 0 ? 'pos' : 'neg'}">${g >= 0 ? '+' : ''}${fmt(g)}</td><td>${fmt(fv)}</td></tr>`;
      jc += `<div class="je"><div class="jt">Y${y}</div><div class="jl"><span>Dr</span><span>Depreciation expense</span><span>${fmt(dep)}</span></div><div class="jl cr"><span>Cr</span><span>Accumulated depreciation</span><span>${fmt(dep)}</span></div></div>`;
      jf += g >= 0 ? `<div class="je"><div class="jt">Y${y} — FV gain (${fmt(fv)} − ${fmt(prev)})</div><div class="jl"><span>Dr</span><span>Investment property</span><span>${fmt(g)}</span></div><div class="jl cr"><span>Cr</span><span>FV gain on IP (P/L)</span><span>${fmt(g)}</span></div></div>`
        : `<div class="je"><div class="jt">Y${y} — FV loss (${fmt(prev)} − ${fmt(fv)})</div><div class="jl"><span>Dr</span><span>FV loss on IP (P/L)</span><span>${fmt(-g)}</span></div><div class="jl cr"><span>Cr</span><span>Investment property</span><span>${fmt(-g)}</span></div></div>`;
      prev = fv;
    });
    $('#out').innerHTML = `<div class="card"><h3>${S.lang === 'en' ? 'Summary (P/L effect and carrying amount)' : 'Ringkasan (kesan P/L & amaun dibawa)'}</h3><div class="tw"><table class="num"><thead><tr><th></th><th>Cost: P/L</th><th>Cost: CA</th><th>FV: P/L</th><th>FV: CA</th></tr></thead><tbody>${rows}<tr class="tot"><th>Total</th><td>${fmt(totC)}</td><td></td><td class="${totF >= 0 ? 'pos' : 'neg'}">${totF >= 0 ? '+' : ''}${fmt(totF)}</td><td></td></tr></tbody></table></div>
      <small class="muted">${S.lang === 'en' ? 'P/L: negative = expense/loss. CA = carrying amount at year-end. Cost model ignores impairment here.' : 'P/L: negatif = belanja/rugi. CA = amaun dibawa hujung tahun. Model kos tidak kira rosot nilai di sini.'}</small></div>
      <h3>${S.lang === 'en' ? 'Cost model journals' : 'Jurnal model kos'}</h3>${jc}
      <h3>${S.lang === 'en' ? 'FV model journals' : 'Jurnal model FV'}</h3>${jf}`;
  };
  ['c', 'l', 'r'].forEach(id => $('#' + id).oninput = out);
  $('#addy').onclick = () => { st.fv.push(st.fv.length ? st.fv[st.fv.length - 1] : st.cost); drawFV(); out(); };
  $('#rmy').onclick = () => { if (st.fv.length > 1) { st.fv.pop(); drawFV(); out(); } };
  drawFV(); out();
}

function calc5(v) {
  const st = JSON.parse(sessionStorage.getItem('calc5') || 'null') || { n: 100, p0: 500, c0: 20, p1: 560, c1: 22, p2: 600, c2: 25 };
  const num = (x) => Number(String(x).replace(/,/g, '')) || 0;
  const f = [['n', S.lang === 'ms' ? 'Bilangan (unit)' : 'Number of units'], ['p0', S.lang === 'ms' ? 'FV seunit semasa beli (RM)' : 'FV per unit at purchase (RM)'], ['c0', S.lang === 'ms' ? 'Kos menjual seunit semasa beli' : 'Costs to sell per unit at purchase'], ['p1', S.lang === 'ms' ? 'FV seunit hujung tahun' : 'FV per unit at year-end'], ['c1', S.lang === 'ms' ? 'Kos menjual seunit hujung tahun' : 'Costs to sell per unit at year-end'], ['p2', S.lang === 'ms' ? 'FV seunit semasa tuai (0 = tiada tuai)' : 'FV per unit at harvest (0 = no harvest)'], ['c2', S.lang === 'ms' ? 'Kos menjual seunit semasa tuai' : 'Costs to sell per unit at harvest']];
  v.innerHTML = `<a class="back" href="#/tools">← ${u('tools')}</a><h1>🧮 ${S.lang === 'en' ? 'FV less costs to sell' : 'FV tolak kos menjual'}</h1>
  <div class="card form">${f.map(x => `<label>${x[1]}<input id="${x[0]}" inputmode="decimal" value="${st[x[0]]}"></label>`).join('')}<small class="muted">${S.lang === 'en' ? 'Assumes price paid = fair value at purchase.' : 'Andaian: harga dibayar = nilai saksama semasa beli.'}</small></div><div id="out"></div>`;
  const je = (t, l) => `<div class="je"><div class="jt">${t}</div>${l.map(x => `<div class="jl ${x[0] === 'Cr' ? 'cr' : ''}"><span>${x[0]}</span><span>${x[1]}</span><span>${fmt(x[2])}</span></div>`).join('')}</div>`;
  const out = () => {
    f.forEach(x => st[x[0]] = num($('#' + x[0]).value)); sessionStorage.setItem('calc5', JSON.stringify(st));
    const n = st.n, paid = st.p0 * n, a0 = (st.p0 - st.c0) * n, a1 = (st.p1 - st.c1) * n, a2 = (st.p2 - st.c2) * n;
    const loss0 = paid - a0, ch1 = a1 - a0; let h = '';
    h += `<div class="card"><h3>${S.lang === 'en' ? 'Carrying amounts (FVLCTS)' : 'Amaun dibawa (FVLCTS)'}</h3><div class="tw"><table class="num"><tbody>
      <tr><th>${S.lang === 'en' ? 'Purchase' : 'Beli'}</th><td>(${fmt(st.p0)} − ${fmt(st.c0)}) × ${fmt(n)}</td><td><b>${fmt(a0)}</b></td></tr>
      <tr><th>${S.lang === 'en' ? 'Year-end' : 'Hujung tahun'}</th><td>(${fmt(st.p1)} − ${fmt(st.c1)}) × ${fmt(n)}</td><td><b>${fmt(a1)}</b></td></tr>
      ${st.p2 ? `<tr><th>${S.lang === 'en' ? 'Harvest' : 'Tuai'}</th><td>(${fmt(st.p2)} − ${fmt(st.c2)}) × ${fmt(n)}</td><td><b>${fmt(a2)}</b></td></tr>` : ''}</tbody></table></div></div>`;
    const lines0 = [['Dr', 'Biological asset (FVLCTS)', a0]]; if (loss0 > 0) lines0.push(['Dr', 'Loss on initial recognition (P/L)', loss0]); if (loss0 < 0) lines0.push(['Cr', 'Gain on initial recognition (P/L)', -loss0]); lines0.push(['Cr', 'Bank', paid]);
    h += je('Purchase', lines0.sort((x, y) => (x[0] === 'Cr') - (y[0] === 'Cr')));
    const gl = (d, label) => d >= 0 ? [['Dr', 'Biological asset', d], ['Cr', 'Gain from change in FVLCTS (P/L)', d]] : [['Dr', 'Loss from change in FVLCTS (P/L)', -d], ['Cr', 'Biological asset', -d]];
    h += je(`${S.lang === 'en' ? 'Year-end' : 'Hujung tahun'}: ${fmt(a1)} − ${fmt(a0)} = ${fmt(ch1)}`, gl(ch1));
    if (st.p2) { const ch2 = a2 - a1; h += je(`${S.lang === 'en' ? 'Before harvest: remeasure' : 'Sebelum tuai: ukur semula'}: ${fmt(a2)} − ${fmt(a1)} = ${fmt(ch2)}`, gl(ch2)); h += je(S.lang === 'en' ? 'Harvest: transfer to inventory (MFRS 102)' : 'Tuai: pindah ke inventori (MFRS 102)', [['Dr', 'Inventories (agricultural produce)', a2], ['Cr', 'Biological asset', a2]]); }
    $('#out').innerHTML = h;
  };
  f.forEach(x => $('#' + x[0]).oninput = out); out();
}


const TR = {
  'ppe>ip': { ev: { en: 'End of owner-occupation', ms: 'Tamat pendudukan pemilik' }, cost: { en: 'No change to carrying amount or cost (para 59).', ms: 'Tiada perubahan pada amaun dibawa atau kos (para 59).' }, fv: { en: 'Remeasure to FV at date of change. Difference → revaluation surplus per MFRS 116 (para 61). (Decrease: against existing surplus first, excess to P/L.)', ms: 'Ukur semula pada FV tarikh perubahan. Beza → lebihan penilaian semula ikut MFRS 116 (para 61). (Penurunan: tolak lebihan sedia ada dahulu, baki ke P/L.)' }, je: ['Dr Investment property (FV)', 'Cr PPE (carrying amount)', 'Cr Revaluation surplus (difference)'] },
  'inv>ip': { ev: { en: 'Commencement of operating lease to another party', ms: 'Mula pajakan operasi kepada pihak lain' }, cost: { en: 'No change to carrying amount or cost (para 59).', ms: 'Tiada perubahan pada amaun dibawa atau kos (para 59).' }, fv: { en: 'Remeasure to FV. Difference → profit or loss (para 63).', ms: 'Ukur semula pada FV. Beza → untung atau rugi (para 63).' }, je: ['Dr Investment property (FV)', 'Cr Inventories (carrying amount)', 'Cr Gain in P/L (difference)'] },
  'ip>ppe': { ev: { en: 'Commencement of owner-occupation', ms: 'Mula diduduki pemilik' }, cost: { en: 'No change to carrying amount or cost (para 59).', ms: 'Tiada perubahan pada amaun dibawa atau kos (para 59).' }, fv: { en: 'FV at date of change = deemed cost for MFRS 116 (para 60). No gain/loss on transfer; depreciate from then.', ms: 'FV tarikh perubahan = kos dianggap untuk MFRS 116 (para 60). Tiada untung/rugi semasa pindah; susut nilai bermula dari situ.' }, je: ['Dr PPE (FV = deemed cost)', 'Cr Investment property (FV)'] },
  'ip>inv': { ev: { en: 'Commencement of development with a view to sale', ms: 'Mula pembangunan untuk dijual' }, cost: { en: 'No change to carrying amount or cost (para 59).', ms: 'Tiada perubahan pada amaun dibawa atau kos (para 59).' }, fv: { en: 'FV at date of change = deemed cost for MFRS 102 (para 60).', ms: 'FV tarikh perubahan = kos dianggap untuk MFRS 102 (para 60).' }, je: ['Dr Inventories (FV = deemed cost)', 'Cr Investment property (FV)'] }
};
function transfer(v) {
  const names = { ppe: { en: 'Owner-occupied (PPE)', ms: 'Diduduki pemilik (PPE)' }, inv: { en: 'Inventories', ms: 'Inventori' }, ip: { en: 'Investment property', ms: 'Hartanah pelaburan' } };
  let f = 'ppe', t = 'ip';
  const draw = () => {
    const r = TR[f + '>' + t];
    const sel = (id, val) => `<select id="${id}">${Object.keys(names).map(k => `<option value="${k}" ${k === val ? 'selected' : ''}>${S.lang === 'ms' ? names[k].ms : names[k].en}</option>`).join('')}</select>`;
    v.innerHTML = `<a class="back" href="#/tools">← ${u('tools')}</a><h1>🔄 ${S.lang === 'en' ? 'Transfer helper' : 'Pembantu pemindahan'}</h1>
    <div class="card form"><label>${S.lang === 'en' ? 'From' : 'Dari'}${sel('f', f)}</label><label>${S.lang === 'en' ? 'To' : 'Ke'}${sel('t', t)}</label></div>
    ${r ? `<div class="card"><h3>${S.lang === 'en' ? 'Evidence of change in use' : 'Bukti perubahan guna'}</h3>${B(r.ev)}
      <h3>${S.lang === 'en' ? 'If COST model' : 'Jika model KOS'}</h3>${B(r.cost)}
      <h3>${S.lang === 'en' ? 'If FV model' : 'Jika model FV'}</h3>${B(r.fv)}
      <div class="je"><div class="jt">${S.lang === 'en' ? 'Journal pattern (FV model)' : 'Corak jurnal (model FV)'}</div>${r.je.map(l => `<div class="jl ${l.startsWith('Cr') ? 'cr' : ''}"><span>${l.slice(0, 2)}</span><span>${esc(l.slice(3))}</span><span></span></div>`).join('')}</div></div>`
      : `<div class="card"><p class="muted">${S.lang === 'en' ? 'Not a valid transfer: pick two different categories. Inventories ↔ PPE is outside this chapter.' : 'Pemindahan tidak sah: pilih dua kategori berbeza. Inventori ↔ PPE di luar chapter ini.'}</p></div>`}`;
    $('#f').onchange = (e) => { f = e.target.value; draw(); }; $('#t').onchange = (e) => { t = e.target.value; draw(); };
  };
  draw();
}


window.IS_TOOLS = { calc: calc, calc5: calc5, transfer: transfer };
})();
