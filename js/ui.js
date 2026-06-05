// STATO
// ============================================================
let pazienteAperto = null;   // id paziente nella vista scheda
let farmacoEditId  = null;   // null = nuovo, stringa = modifica
let farmacoEditPzId = null;

// ============================================================
// CLOCK
// ============================================================
(function tick() {
  const d = new Date();
  document.getElementById('clock').innerHTML =
    d.toLocaleDateString('it-IT',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}) +
    '<br>' + d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  setTimeout(tick, 1000);
})();

// ============================================================
// TAB NAVIGATION
// ============================================================
function showTab(t) {
  ['pazienti','inventario','report'].forEach(x => {
    document.getElementById('tab-'+x).style.display = x===t ? '' : 'none';
    const el = document.getElementById('htab-'+x);
    if (el) el.classList.toggle('active', x===t);
  });
  if (t==='inventario') renderInventario();
  if (t==='report') { showReportTab('scorte'); }
}

function _apriStampaPulita(titolo, sottotitolo, corpo) {
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>${titolo}</title>
  <style>
    body{font-family:'Times New Roman',serif;padding:15mm;font-size:9pt;}
    h1{font-size:13pt;margin-bottom:2mm;}
    p{font-size:8pt;color:#555;margin-bottom:6mm;}
    td,th{border:1px solid #000;padding:1.5mm 3mm;}
    @page{size:A4;margin:10mm;}
  </style></head><body>
  <h1>${titolo}</h1><p>${sottotitolo}</p>
  ${corpo}
  <script>window.onload=()=>window.print()<\/script>
  </body></html>`);
  w.document.close();
}

// MODAL HELPERS
// ============================================================
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target===o) o.classList.remove('open'); });
});

// ============================================================
// TOAST
// ============================================================
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = '✓ ' + msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2500);
}



function editNFoglio(pid) {
  const cnt = loadO(SK.contatori);
  const attuale = cnt[pid] || 1;
  const nuovo = prompt('Numero foglio attuale: ' + attuale + '\nInserisci il nuovo numero:', attuale);
  if (nuovo === null) return;
  const n = parseInt(nuovo);
  if (isNaN(n) || n < 1) { alert('Numero non valido'); return; }
  cnt[pid] = n;
  save(SK.contatori, cnt);
  renderScheda(pid);
  toast('Numero foglio aggiornato a ' + n);
}
