// SOGLIE ALERT (default personalizzabili per farmaco)
// ============================================================
const DEFAULT_WARN_GG   = 7;
const DEFAULT_URGENT_GG = 3;

function getSoglie(farm) {
  return {
    warn:   farm.sogliaWarnGg   ?? DEFAULT_WARN_GG,
    urgent: farm.sogliaUrgentGg ?? DEFAULT_URGENT_GG,
  };
}

function statoFarmacoGiorni(farm) {
  if (farm.alertSospeso) return { stato: 'ok', giorni: null };
  const scorta  = calcolaScorta(farm);
  const consumo = calcolaConsumoCRA(farm.id);
  const soglie  = getSoglie(farm);
  if (consumo <= 0) return { stato: 'ok', giorni: null };
  const giorni = scorta / consumo;
  if (giorni <= soglie.urgent) return { stato: 'urgent', giorni: Math.floor(giorni) };
  if (giorni <= soglie.warn)   return { stato: 'warn',   giorni: Math.floor(giorni) };
  return { stato: 'ok', giorni: Math.floor(giorni) };
}

// ============================================================
// BANNER HOME — aggiorna alert farmaci + report mensile
// ============================================================
function aggiornaBannerHome() {
  const farmaci = load(SK_FCRA);
  const urgent  = farmaci.filter(f => statoFarmacoGiorni(f).stato === 'urgent');
  const warn    = farmaci.filter(f => statoFarmacoGiorni(f).stato === 'warn');

  const bu = document.getElementById('home-alert-urgent');
  const bw = document.getElementById('home-alert-warn');
  const cu = document.getElementById('home-chips-urgent');
  const cw = document.getElementById('home-chips-warn');

  if (bu) bu.style.display = urgent.length ? '' : 'none';
  if (bw) bw.style.display = warn.length   ? '' : 'none';
  if (cu) cu.innerHTML = urgent.map(f => {
    const g = statoFarmacoGiorni(f);
    return `<span class="chip-urgent">${f.nome} — ${g.giorni !== null ? g.giorni + ' gg' : '—'}</span>`;
  }).join('');
  if (cw) cw.innerHTML = warn.map(f => {
    const g = statoFarmacoGiorni(f);
    return `<span class="chip-warn">${f.nome} — ${g.giorni !== null ? g.giorni + ' gg' : '—'}</span>`;
  }).join('');

  // banner report mensile
  controllaReportMensile();
}

// SESSIONE 2 — INVENTARIO FARMACI CRA
// ============================================================

let caricoFarmacoId  = null;
let rettificaFarmacoId = null;
let editFCRAid = null;

// ---------- calcolo scorta residua ----------
function calcolaScorta(farm) {
  if (!farm.lastSync || farm.scorta === undefined) return 0;
  const ls   = new Date(farm.lastSync); ls.setHours(0,0,0,0);
  const oggi = new Date(); oggi.setHours(0,0,0,0);
  const giorni = Math.max(0, Math.round((oggi - ls) / 86400000));
  const consumo = calcolaConsumoCRA(farm.id);
  return Math.max(0, farm.scorta - giorni * consumo);
}

// consumo giornaliero = somma dosi per orario attivo (dosi map) per tutte le terapie CRA attive
function calcolaConsumoCRA(farmId) {
  const terapie = load(SK.terapie);
  const pzList  = load(SK.pazienti);
  const oggi = new Date(); oggi.setHours(0,0,0,0);
  return terapie
    .filter(t => {
      if (!t.farmacoCRAid || t.farmacoCRAid !== farmId) return false;
      if (t.sezione === 'bisogno') return false;
      // escludi pazienti con terapia sospesa
      const pz = pzList.find(p => p.id === t.pazienteId);
      if (pz && (pz.terapiaSospesa === true || pz.terapiaSospesa === 'true')) return false;
      const di = t.dataInizio ? new Date(t.dataInizio) : null;
      const df = t.dataFine   ? new Date(t.dataFine)   : null;
      if (di && di > oggi) return false;
      if (df && df < oggi) return false;
      if (t.invEnabled === false) return false;
      return true;
    })
    .reduce((acc, t) => {
      if (t.sezione === 'longacting') {
        // consumo long acting: dose / periodicità
        const dose = Number.isFinite(parseFloat(t.doseNum)) ? parseFloat(t.doseNum) : 0;
        if (t.laProssima && t.laEseguita) {
          const dp = new Date(t.laProssima);
          const de = new Date(t.laEseguita);
          const per = Math.max(1, Math.round((dp - de) / 86400000));
          return acc + dose / per;
        }
        return acc + dose;
      }
      // orale/topica: somma dosi per orario dalla mappa dosi
      if (t.dosi && Object.keys(t.dosi).length > 0) {
        const somma = (t.orari || []).reduce((s, o) => s + ((t.dosi[o]) || 0), 0);
        return acc + somma;
      }
      // fallback legacy: doseNum × numero orari
      const dose = Number.isFinite(parseFloat(t.doseNum)) ? parseFloat(t.doseNum) : 0;
      const nOr  = (t.orari && t.orari.length) ? t.orari.length : 1;
      return acc + dose * nOr;
    }, 0);
}

function statoFarmaco(farm) {
  if (farm.alertSospeso) return 'ok'; // alert silenziato manualmente
  const scorta  = calcolaScorta(farm);
  const consumo = calcolaConsumoCRA(farm.id);
  if (consumo > 0) {
    const giorniRes = scorta / consumo;
    if (giorniRes <= (farm.sogliaUrgentGg||3)) return 'urgent';
    if (giorniRes <= (farm.sogliaWarnGg||8))   return 'warn';
  } else {
    if (scorta <= (farm.sogliaUrgent||0)) return 'urgent';
    if (scorta <= (farm.sogliaWarn||0))   return 'warn';
  }
  return 'ok';
}

// ---------- RENDER INVENTARIO ----------
function renderInventario() {
  const farmaci = load(SK.fcraFarmaci||'fcra_farmaci_cra');
  const q = (document.getElementById('search-inv')?.value||'').toLowerCase();
  const lista = farmaci.filter(f => f.nome.toLowerCase().includes(q));

  // sommario
  const urgenti = lista.filter(f=>statoFarmaco(f)==='urgent').length;
  const warn    = lista.filter(f=>statoFarmaco(f)==='warn').length;
  const ok      = lista.filter(f=>statoFarmaco(f)==='ok').length;
  document.getElementById('inv-summary').innerHTML = `
    <div class="inv-stat"><div class="inv-stat-n" style="color:var(--text)">${lista.length}</div><div class="inv-stat-l">Farmaci in magazzino</div></div>
    <div class="inv-stat"><div class="inv-stat-n" style="color:var(--green)">${ok}</div><div class="inv-stat-l">Scorte ok</div></div>
    <div class="inv-stat"><div class="inv-stat-n" style="color:var(--amber)">${warn}</div><div class="inv-stat-l">In esaurimento</div></div>
    <div class="inv-stat"><div class="inv-stat-n" style="color:var(--red)">${urgenti}</div><div class="inv-stat-l">Critici / esauriti</div></div>
  `;
  document.getElementById('inv-count').textContent = lista.length + ' farmac' + (lista.length===1?'o':'i');

  // alert banner
  const chipUrg = lista.filter(f=>statoFarmaco(f)==='urgent').map(f=>`<span class="chip-urgent">${escapeHTML(f.nome)}</span>`).join('');
  const chipWrn = lista.filter(f=>statoFarmaco(f)==='warn').map(f=>`<span class="chip-warn">${escapeHTML(f.nome)}</span>`).join('');
  document.getElementById('inv-alert-urgent').style.display = urgenti ? '' : 'none';
  document.getElementById('inv-alert-warn').style.display   = warn    ? '' : 'none';
  document.getElementById('inv-chips-urgent').innerHTML = chipUrg;
  document.getElementById('inv-chips-warn').innerHTML   = chipWrn;

  const grid = document.getElementById('inv-grid');
  if (!lista.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="icon">💊</div><p>Nessun farmaco CRA registrato. Aggiungi il primo farmaco.</p></div>';
    return;
  }

  grid.innerHTML = lista.map(f => {
    const scorta   = calcolaScorta(f);
    const consumo  = calcolaConsumoCRA(f.id);
    const giorni   = consumo > 0 ? Math.floor(scorta / consumo) : null;
    const stato    = statoFarmaco(f);
    const pct      = f.scorta > 0 ? Math.min(100, Math.round(scorta / f.scorta * 100)) : 0;
    const fillCls  = stato==='urgent'?'fill-red':stato==='warn'?'fill-amber':'fill-green';
    const valCls   = stato==='urgent'?'red':stato==='warn'?'amber':'green';
    const terapiePz = getTerapieFarmacoCRA(f.id);

    return `
    <div class="inv-card stato-${stato}">
      <div class="inv-card-head">
        <div>
          <div class="inv-nome">${escapeHTML(f.nome)} ${f.alertSospeso ? '<span style="font-size:0.6rem;background:var(--surface2);border:1px solid var(--dim);color:var(--dim);border-radius:10px;padding:1px 7px;font-family:Inconsolata,monospace;vertical-align:middle">ALERT SOSPESO</span>' : ''}</div>
          <div class="inv-forma">${escapeHTML(f.forma)||''} · ${escapeHTML(f.udm)||'unità'}/conf: ${f.xconf||'—'}</div>
        </div>
        <span class="badge ${stato==='ok'?'badge-cra':stato==='warn'?'' :''}" style="${stato==='urgent'?'background:var(--red-bg);color:var(--red);border:1px solid rgba(224,82,82,.3)':stato==='warn'?'background:var(--amber-bg);color:var(--amber);border:1px solid rgba(232,145,58,.3)':'background:var(--green-bg);color:var(--green);border:1px solid rgba(77,184,122,.3)'};font-family:Inconsolata,monospace;font-size:.6rem;padding:2px 8px;border-radius:20px;">
          ${stato==='urgent'?'CRITICO':stato==='warn'?'ATTENZIONE':'OK'}
        </span>
      </div>
      <div class="inv-card-body">
        <div class="progress-bar"><div class="progress-fill ${fillCls}" style="width:${pct}%"></div></div>
        <div class="inv-row">
          <span class="inv-label">Scorta residua stimata</span>
          <span class="inv-val ${valCls}">${Math.round(scorta)} ${f.udm||'unità'}</span>
        </div>
        <div class="inv-row">
          <span class="inv-label">Consumo/die struttura</span>
          <span class="inv-val">${consumo>0 ? consumo.toFixed(1)+' '+( f.udm||'u')+'/die' : '<span style="color:var(--dim)">nessuna terapia attiva</span>'}</span>
        </div>
        <div class="inv-row">
          <span class="inv-label">Giorni residui stimati</span>
          <span class="inv-val ${valCls}">${giorni!==null ? giorni+' gg' : '—'}</span>
        </div>
        <div class="inv-row" style="font-size:0.72rem">
          <span class="inv-label" style="color:var(--dim)">Soglie alert / urgente</span>
          <span style="font-family:Inconsolata,monospace;color:var(--dim)">${f.sogliaWarnGg||8} gg / ${f.sogliaUrgentGg||3} gg</span>
        </div>
        <div class="inv-row">
          <span class="inv-label">Pazienti in terapia</span>
          <span class="inv-val">${terapiePz.length}</span>
        </div>
        ${f.note ? `<div style="font-size:0.72rem;color:var(--muted);margin-top:2px">${escapeHTML(f.note)}</div>` : ''}
      </div>
      <div class="inv-card-foot">
        <button class="btn btn-gold btn-sm" onclick="openModalCarico('${f.id}')">+ Carico</button>
        <button class="btn btn-ghost btn-sm" onclick="openModalRettifica('${f.id}')">⚖ Rettifica</button>
        <button class="btn btn-ghost btn-sm" onclick="openModalFarmacioCRA('${f.id}')">✏️</button>
        <button class="btn btn-ghost btn-sm" title="${f.alertSospeso?'Riattiva alert':'Silenzia alert'}" onclick="toggleAlertSospeso('${f.id}')">${f.alertSospeso ? '🔔' : '🔕'}</button>
        <button class="btn btn-ghost btn-sm" onclick="eliminaFarmacioCRA('${f.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function getTerapieFarmacoCRA(farmId) {
  const terapie = load(SK.terapie);
  const oggi = new Date(); oggi.setHours(0,0,0,0);
  return terapie.filter(t => {
    if (t.farmacoCRAid !== farmId || t.fonte !== 'CRA') return false;
    const df = t.dataFine ? new Date(t.dataFine) : null;
    return !df || df >= oggi;
  });
}

// ---------- MODAL FARMACO CRA ----------
const SK_FCRA = 'fcra_farmaci_cra';

function openModalFarmacioCRA(fid) {
  editFCRAid = fid || null;
  document.getElementById('modal-fcra-title').textContent = fid ? 'Modifica farmaco' : 'Nuovo farmaco CRA';
  if (fid) {
    const f = load(SK_FCRA).find(x=>x.id===fid);
    if (f) {
      document.getElementById('fcra-nome').value   = f.nome||'';
      document.getElementById('fcra-forma').value  = f.forma||'Compresse';
      document.getElementById('fcra-xconf').value  = f.xconf||'';
      document.getElementById('fcra-udm').value    = f.udm||'';
      document.getElementById('fcra-scorta').value = f.scorta||'';
      document.getElementById('fcra-lastsync').value = f.lastSync||'';
      const _c = calcolaConsumoCRA(f.id);
      document.getElementById('fcra-warn-gg').value   = _c > 0 ? Math.round((f.sogliaWarn||0)/_c) : (f.sogliaWarnGg||8);
      document.getElementById('fcra-urgent-gg').value = _c > 0 ? Math.round((f.sogliaUrgent||0)/_c) : (f.sogliaUrgentGg||3);
      document.getElementById('fcra-note').value   = f.note||'';
    }
  } else {
    ['fcra-nome','fcra-xconf','fcra-udm','fcra-scorta','fcra-note']
      .forEach(id=>document.getElementById(id).value='');
    document.getElementById('fcra-warn-gg').value   = 8;
    document.getElementById('fcra-urgent-gg').value = 3;
    document.getElementById('fcra-forma').value='Compresse';
    document.getElementById('fcra-lastsync').value = new Date().toISOString().slice(0,10);
  }
  openModal('modal-farmaco-cra');
}

function salvaFarmacioCRA() {
  const nome = document.getElementById('fcra-nome').value.trim();
  const xconf = parseInt(document.getElementById('fcra-xconf').value)||0;
  const scorta = parseFloat(document.getElementById('fcra-scorta').value);
  const lastSync = document.getElementById('fcra-lastsync').value;
  if (!nome||!xconf||isNaN(scorta)||!lastSync) { alert('Nome, unità/conf, scorta e data di riferimento sono obbligatori'); return; }

  const farmaci = load(SK_FCRA);
  const obj = {
    nome, xconf, scorta, lastSync,
    forma:       document.getElementById('fcra-forma').value,
    udm:         document.getElementById('fcra-udm').value.trim(),
    sogliaWarnGg:   parseInt(document.getElementById('fcra-warn-gg').value)||8,
    sogliaUrgentGg: parseInt(document.getElementById('fcra-urgent-gg').value)||3,
    note:        document.getElementById('fcra-note').value.trim(),
    alertSospeso: editFCRAid ? (load(SK_FCRA).find(x=>x.id===editFCRAid)||{}).alertSospeso||false : false,
  };

  if (editFCRAid) {
    const idx = farmaci.findIndex(x=>x.id===editFCRAid);
    if (idx>=0) Object.assign(farmaci[idx], obj);
  } else {
    farmaci.push({ id:uid(), ...obj });
  }
  save(SK_FCRA, farmaci);
  closeModal('modal-farmaco-cra');
  renderInventario();
  toast(editFCRAid ? 'Farmaco aggiornato' : 'Farmaco aggiunto al magazzino');
}


function toggleAlertSospeso(fid) {
  const farmaci = load(SK_FCRA);
  const idx = farmaci.findIndex(x=>x.id===fid);
  if (idx<0) return;
  farmaci[idx].alertSospeso = !farmaci[idx].alertSospeso;
  save(SK_FCRA, farmaci);
  renderInventario();
  toast(farmaci[idx].alertSospeso ? 'Alert silenziato per questo farmaco' : 'Alert riattivato');
}

function eliminaFarmacioCRA(fid) {
  if (!confirm('Eliminare questo farmaco dal magazzino?')) return;
  save(SK_FCRA, load(SK_FCRA).filter(f=>f.id!==fid));
  renderInventario();
  toast('Farmaco eliminato');
}

// ---------- CARICO SCORTE ----------
function openModalCarico(fid) {
  caricoFarmacoId = fid;
  const f = load(SK_FCRA).find(x=>x.id===fid);
  if (!f) return;
  document.getElementById('carico-farm-label').textContent = `Farmaco: ${f.nome} · ${f.forma||''} · scorta attuale stimata: ${Math.round(calcolaScorta(f))} ${f.udm||'unità'}`;
  document.getElementById('carico-xconf').value = f.xconf||1;
  document.getElementById('carico-nconf').value = '';
  document.getElementById('carico-totale').value = '';
  document.getElementById('carico-note').value = '';
  openModal('modal-carico');
}

function aggiornaTotaleCarico() {
  const n = parseInt(document.getElementById('carico-nconf').value)||0;
  const x = parseInt(document.getElementById('carico-xconf').value)||1;
  document.getElementById('carico-totale').value = (n*x) + ' unità';
}
// listener dinamico carico scorte
document.addEventListener('input', e => {
  if (e.target.id==='carico-nconf') aggiornaTotaleCarico();
  if (e.target.id==='farm-dose-unit') aggiornaLabelUnitaDose();
});

function eseguiCarico() {
  const nconf = parseInt(document.getElementById('carico-nconf').value);
  if (!nconf||nconf<1) { alert('Inserire il numero di confezioni'); return; }
  const f = load(SK_FCRA).find(x=>x.id===caricoFarmacoId);
  if (!f) return;

  // ricalcola la scorta attuale, poi aggiunge il carico
  const scorta_ora = calcolaScorta(f);
  const totale = nconf * (f.xconf||1);
  const nuovaScorta = scorta_ora + totale;
  const oggi = new Date().toISOString().slice(0,10);

  // aggiorna farmaco
  const farmaci = load(SK_FCRA);
  const idx = farmaci.findIndex(x=>x.id===caricoFarmacoId);
  farmaci[idx].scorta = nuovaScorta;
  farmaci[idx].lastSync = oggi;
  save(SK_FCRA, farmaci);

  // log movimento
  const movimenti = load(SK.movimenti);
  movimenti.unshift({
    id: uid(),
    data: oggi,
    tipo: 'carico',
    farmacoId: caricoFarmacoId,
    farmacoNome: f.nome,
    quantita: +totale,
    nconf,
    note: document.getElementById('carico-note').value.trim(),
  });
  save(SK.movimenti, movimenti);

  closeModal('modal-carico');
  renderInventario();
  toast(`Carico registrato: +${totale} ${f.udm||'unità'} di ${f.nome}`);
}

// ---------- RETTIFICA ----------
function openModalRettifica(fid) {
  rettificaFarmacoId = fid;
  const f = load(SK_FCRA).find(x=>x.id===fid);
  if (!f) return;
  const calcolata = Math.round(calcolaScorta(f));
  document.getElementById('rett-farm-label').textContent = `Farmaco: ${f.nome}`;
  document.getElementById('rett-calcolata').value = calcolata + ' ' + (f.udm||'unità');
  document.getElementById('rett-scorta').value = '';
  document.getElementById('rett-note').value = '';
  openModal('modal-rettifica');
}

function eseguiRettifica() {
  const nuova = parseFloat(document.getElementById('rett-scorta').value);
  const nota  = document.getElementById('rett-note').value.trim();
  if (isNaN(nuova)||nuova<0) { alert('Inserire la scorta reale'); return; }
  if (!nota) { alert('La motivazione della rettifica è obbligatoria'); return; }

  const f = load(SK_FCRA).find(x=>x.id===rettificaFarmacoId);
  const vecchia = Math.round(calcolaScorta(f));
  const diff = nuova - vecchia;
  const oggi = new Date().toISOString().slice(0,10);

  const farmaci = load(SK_FCRA);
  const idx = farmaci.findIndex(x=>x.id===rettificaFarmacoId);
  farmaci[idx].scorta = nuova;
  farmaci[idx].lastSync = oggi;
  save(SK_FCRA, farmaci);

  const movimenti = load(SK.movimenti);
  movimenti.unshift({
    id: uid(), data: oggi, tipo: 'rettifica',
    farmacoId: rettificaFarmacoId, farmacoNome: f.nome,
    quantita: diff, scorta_precedente: vecchia, scorta_nuova: nuova,
    note: nota,
  });
  save(SK.movimenti, movimenti);

  closeModal('modal-rettifica');
  renderInventario();
  toast(`Rettifica registrata: ${diff>=0?'+':''}${diff} ${f.udm||'unità'} su ${f.nome}`);
}

// ---------- LOG MOVIMENTI ----------
function openModalMovimenti() {
  const movimenti = load(SK.movimenti);
  const el = document.getElementById('log-movimenti-content');
  if (!movimenti.length) {
    el.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">Nessun movimento registrato</p>';
  } else {
    el.innerHTML = '<div class="mov-list">' + movimenti.map(m => {
      const segno = m.quantita >= 0 ? '+' : '';
      return `<div class="mov-row">
        <div>
          <span class="mov-tipo ${m.tipo}">${m.tipo.toUpperCase()}</span>
          <span style="margin-left:8px;font-weight:700">${m.farmacoNome||'—'}</span>
          ${m.note ? `<span style="color:var(--muted);font-size:0.72rem;margin-left:6px">· ${m.note}</span>` : ''}
        </div>
        <div style="display:flex;gap:14px;align-items:center">
          <span class="mov-q ${m.quantita>=0?'pos':'neg'}">${segno}${m.quantita}</span>
          <span class="mov-data">${m.data||'—'}</span>
        </div>
      </div>`;
    }).join('') + '</div>';
  }
  openModal('modal-movimenti');
}

function stampaMovimenti() {
  const movimenti = load(SK.movimenti);
  const farmaci   = load(SK_FCRA);
  const oggi = new Date().toLocaleDateString('it-IT');
  const righe = movimenti.map(m => `
    <tr>
      <td>${m.data||'—'}</td>
      <td>${m.tipo.toUpperCase()}</td>
      <td>${m.farmacoNome||'—'}</td>
      <td style="text-align:right">${m.quantita>=0?'+':''}${m.quantita}</td>
      <td>${m.note||''}</td>
    </tr>`).join('');
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Log Movimenti Magazzino</title>
  <style>
    body{font-family:'Times New Roman',serif;padding:15mm;}
    h1{font-size:13pt;margin-bottom:4mm;}
    p{font-size:8pt;color:#555;margin-bottom:6mm;}
    table{width:100%;border-collapse:collapse;font-size:8pt;}
    th{border:1px solid #000;padding:2mm;background:#f0f0f0;text-align:left;}
    td{border:1px solid #000;padding:2mm;}
    @page{size:A4;margin:10mm;}
  </style></head><body>
  <h1>Log Movimenti Magazzino — Farmaci CRA</h1>
  <p>Stampato il: ${oggi} · ${movimenti.length} movimenti</p>
  <table><thead><tr><th>Data</th><th>Tipo</th><th>Farmaco</th><th>Quantità</th><th>Note</th></tr></thead>
  <tbody>${righe}</tbody></table>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

// SK_FCRA unificato con SK
SK.fcraFarmaci = SK_FCRA;

