// REPORT MENSILE — controllo e generazione automatica
// ============================================================
const SK_REPORTS = 'fcra_reports_mensili';

function ultimoGiornoMese(data) {
  const d = new Date(data.getFullYear(), data.getMonth() + 1, 0);
  return d.getDate();
}

function chiaveReportMese(anno, mese) {
  return anno + '-' + String(mese + 1).padStart(2, '0');
}

function controllaReportMensile() {
  const oggi     = new Date();
  const reports  = loadO(SK_REPORTS);
  const banner   = document.getElementById('home-report-banner');
  const msg      = document.getElementById('home-report-banner-msg');
  if (!banner || !msg) return;

  // mese corrente
  const anno  = oggi.getFullYear();
  const mese  = oggi.getMonth();
  const giorno = oggi.getDate();
  const ultimo = ultimoGiornoMese(oggi);
  const chiave = chiaveReportMese(anno, mese);

  // mese precedente
  const dataPrec = new Date(anno, mese - 1, 1);
  const chiavePrec = chiaveReportMese(dataPrec.getFullYear(), dataPrec.getMonth());

  // genera automaticamente se: ultimo giorno del mese o primo giorno del mese successivo
  // e il report di quel mese non esiste ancora
  const meseTarget = giorno === ultimo ? chiave : null;
  const meseTargetPrec = giorno <= 3 && !reports[chiavePrec] ? chiavePrec : null;

  const target = meseTarget || meseTargetPrec;

  if (target && !reports[target]) {
    // genera automaticamente senza mostrare il banner
    generaESalvaReportMensile(false, target);
    banner.style.display = 'none';
  } else if (meseTargetPrec && !reports[meseTargetPrec]) {
    // report mese precedente mancante — mostra banner
    const [a, m] = meseTargetPrec.split('-');
    const nomeMese = new Date(a, m - 1, 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' });
    msg.textContent = 'Report di ' + nomeMese + ' non ancora generato.';
    banner.style.display = '';
  } else {
    banner.style.display = 'none';
  }
}

function generaESalvaReportMensile(mostraToast, chiaveForzata) {
  const oggi    = new Date();
  const anno    = oggi.getFullYear();
  const mese    = oggi.getMonth();
  const chiave  = chiaveForzata || chiaveReportMese(anno, mese);
  const [a, m]  = chiave.split('-');
  const label   = new Date(a, m - 1, 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' });

  const farmaci = load(SK_FCRA);
  const snapshot = farmaci.map(f => {
    const scorta   = calcolaScorta(f);
    const consumo  = calcolaConsumoCRA(f.id);
    const consMese = Math.round(consumo * 30);
    const conf     = f.xconf || 1;
    const daOrdinare = consumo > 0 ? Math.ceil(consMese / conf) : 0;
    const { stato, giorni } = statoFarmacoGiorni(f);
    return {
      id: f.id, nome: f.nome, forma: f.forma || '',
      udm: f.udm || 'u', xconf: conf,
      scorta: Math.round(scorta),
      consumoGiornaliero: parseFloat(consumo.toFixed(2)),
      consumoMensile: consMese,
      confezioniDaOrdinare: daOrdinare,
      stato, giorni,
    };
  });

  const report = {
    chiave, label,
    data: oggi.toISOString(),
    snapshot,
  };

  const reports = loadO(SK_REPORTS);
  reports[chiave] = report;
  save(SK_REPORTS, reports);

  if (mostraToast) {
    toast('Report ' + label + ' salvato');
    document.getElementById('home-report-banner').style.display = 'none';
    showTab('report');
    setTimeout(() => showReportTab('storico'), 100);
  }
  return report;
}

// ============================================================
// REPORT TAB — sub-navigazione
// ============================================================
function showReportTab(tab) {
  ['scorte','consumi','storico'].forEach(t => {
    document.getElementById('rpanel-' + t).style.display = t === tab ? '' : 'none';
    document.getElementById('rtab-' + t).classList.toggle('active', t === tab);
  });
  if (tab === 'scorte')  renderReportScorte();
  if (tab === 'consumi') renderReportConsumi();
  if (tab === 'storico') renderReportStorico();
}

// ============================================================
// RENDER REPORT SCORTE
// ============================================================
function renderReportScorte() {
  const farmaci = load(SK_FCRA);
  const el = document.getElementById('report-scorte-content');
  if (!farmaci.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">💊</div><p>Nessun farmaco in magazzino</p></div>';
    return;
  }

  const oggi = new Date().toLocaleDateString('it-IT');
  const righe = farmaci.map(f => {
    const scorta  = Math.round(calcolaScorta(f));
    const conf    = f.xconf || 1;
    const confRim = (scorta / conf).toFixed(1);
    const { stato, giorni } = statoFarmacoGiorni(f);
    const pillClass = stato === 'urgent' ? 'stato-urgent' : stato === 'warn' ? 'stato-warn' : 'stato-ok';
    const pillLabel = stato === 'urgent' ? 'CRITICO' : stato === 'warn' ? 'ATTENZIONE' : 'OK';
    const giorniStr = giorni !== null ? giorni + ' gg' : '—';
    return `<tr>
      <td><strong>${f.nome}</strong><br><span style="font-size:0.7rem;color:var(--muted)">${f.forma||''}</span></td>
      <td class="num">${scorta} ${f.udm||'u'}</td>
      <td class="num">${confRim} conf</td>
      <td class="num">${giorniStr}</td>
      <td><span class="stato-pill ${pillClass}">${pillLabel}</span></td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <p style="font-size:0.75rem;color:var(--muted);margin-bottom:12px">Aggiornato al: <strong>${oggi}</strong></p>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden">
      <table class="report-table">
        <thead><tr>
          <th>Farmaco</th>
          <th>Scorta residua</th>
          <th>Confezioni</th>
          <th>Giorni residui</th>
          <th>Stato</th>
        </tr></thead>
        <tbody>${righe}</tbody>
      </table>
    </div>`;
}

// ============================================================
// RENDER REPORT CONSUMI
// ============================================================
function renderReportConsumi() {
  const farmaci = load(SK_FCRA);
  const el = document.getElementById('report-consumi-content');
  if (!farmaci.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">💊</div><p>Nessun farmaco in magazzino</p></div>';
    return;
  }

  const inUso    = farmaci.filter(f => calcolaConsumoCRA(f.id) > 0);
  const nonInUso = farmaci.filter(f => calcolaConsumoCRA(f.id) <= 0);

  const buildRighe = (lista) => lista.map(f => {
    const consumo   = calcolaConsumoCRA(f.id);
    const consMese  = Math.round(consumo * 30);
    const conf      = f.xconf || 1;
    const daOrdinare = consumo > 0 ? Math.ceil(consMese / conf) : 0;
    const { stato, giorni } = statoFarmacoGiorni(f);
    const pillClass = stato === 'urgent' ? 'stato-urgent' : stato === 'warn' ? 'stato-warn' : 'stato-ok';
    const giorniStr = giorni !== null ? giorni + ' gg' : '—';
    return `<tr>
      <td><strong>${f.nome}</strong><br><span style="font-size:0.7rem;color:var(--muted)">${f.forma||''} · ${conf} ${f.udm||'u'}/conf</span></td>
      <td class="num">${consumo > 0 ? consumo.toFixed(1) + ' ' + (f.udm||'u') + '/die' : '—'}</td>
      <td class="num">${consMese > 0 ? consMese + ' ' + (f.udm||'u') : '—'}</td>
      <td class="num" style="color:var(--gold);font-weight:700">${daOrdinare > 0 ? daOrdinare + ' conf' : '—'}</td>
      <td class="num"><span class="stato-pill ${pillClass}">${giorniStr}</span></td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:20px">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-family:'Inconsolata',monospace;font-size:0.7rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--gold)">
        Farmaci attualmente in uso (${inUso.length})
      </div>
      <table class="report-table">
        <thead><tr>
          <th>Farmaco</th>
          <th>Consumo/die</th>
          <th>Consumo mensile stimato</th>
          <th>Confezioni da ordinare</th>
          <th>Giorni residui</th>
        </tr></thead>
        <tbody>${inUso.length ? buildRighe(inUso) : '<tr><td colspan="5" class="empty-row">Nessun farmaco con consumo attivo</td></tr>'}</tbody>
      </table>
    </div>
    ${nonInUso.length ? `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-family:'Inconsolata',monospace;font-size:0.7rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dim)">
        Farmaci a magazzino non in uso (${nonInUso.length})
      </div>
      <table class="report-table">
        <thead><tr><th>Farmaco</th><th>Scorta</th><th colspan="3" style="color:var(--dim)">Nessuna terapia attiva collegata</th></tr></thead>
        <tbody>${buildRighe(nonInUso)}</tbody>
      </table>
    </div>` : ''}`;
}

// ============================================================
// RENDER STORICO REPORT MENSILI
// ============================================================
function renderReportStorico() {
  const reports = loadO(SK_REPORTS);
  const el      = document.getElementById('report-storico-list');
  const cnt     = document.getElementById('storico-count');
  const chiavi  = Object.keys(reports).sort().reverse();

  if (cnt) cnt.textContent = chiavi.length + ' report salvat' + (chiavi.length === 1 ? 'o' : 'i');

  if (!chiavi.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">🗂</div><p>Nessun report mensile ancora generato</p></div>';
    return;
  }

  el.innerHTML = chiavi.map(k => {
    const r = reports[k];
    const data = new Date(r.data).toLocaleDateString('it-IT');
    const nFarmaci = (r.snapshot || []).length;
    const urgenti  = (r.snapshot || []).filter(f => f.stato === 'urgent').length;
    const warn     = (r.snapshot || []).filter(f => f.stato === 'warn').length;

    const righe = (r.snapshot || []).map(f => `<tr>
      <td><strong>${f.nome}</strong> <span style="font-size:0.7rem;color:var(--muted)">${f.forma||''}</span></td>
      <td class="num">${f.scorta} ${f.udm||'u'}</td>
      <td class="num">${f.consumoMensile > 0 ? f.consumoMensile + ' ' + f.udm : '—'}</td>
      <td class="num" style="color:var(--gold)">${f.confezioniDaOrdinare > 0 ? f.confezioniDaOrdinare + ' conf' : '—'}</td>
      <td><span class="stato-pill ${f.stato === 'urgent' ? 'stato-urgent' : f.stato === 'warn' ? 'stato-warn' : 'stato-ok'}">${f.stato === 'urgent' ? 'CRITICO' : f.stato === 'warn' ? 'ATTENZIONE' : 'OK'}</span></td>
    </tr>`).join('');

    return `<div class="storico-card">
      <div class="storico-card-head" onclick="toggleStoricoCard('${k}')">
        <div>
          <strong style="font-family:'Playfair Display',serif">${r.label}</strong>
          <span style="font-size:0.72rem;color:var(--muted);margin-left:10px">generato il ${data}</span>
          ${urgenti ? `<span class="stato-pill stato-urgent" style="margin-left:8px">${urgenti} critici</span>` : ''}
          ${warn    ? `<span class="stato-pill stato-warn"   style="margin-left:4px">${warn} attenzione</span>` : ''}
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-size:0.72rem;color:var(--muted)">${nFarmaci} farmaci</span>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();stampaStorico('${k}')">🖨</button>
          <button class="btn btn-red btn-sm" onclick="event.stopPropagation();eliminaReport('${k}')">🗑</button>
          <span id="arrow-${k}" style="color:var(--muted)">▼</span>
        </div>
      </div>
      <div class="storico-card-body" id="storico-body-${k}">
        <table class="report-table">
          <thead><tr>
            <th>Farmaco</th><th>Scorta al ${data}</th>
            <th>Consumo mensile</th><th>Conf. da ordinare</th><th>Stato</th>
          </tr></thead>
          <tbody>${righe}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');
}

function toggleStoricoCard(k) {
  const body  = document.getElementById('storico-body-' + k);
  const arrow = document.getElementById('arrow-' + k);
  if (!body) return;
  body.classList.toggle('open');
  if (arrow) arrow.textContent = body.classList.contains('open') ? '▲' : '▼';
}

function eliminaReport(k) {
  if (!confirm('Eliminare questo report mensile?')) return;
  const reports = loadO(SK_REPORTS);
  delete reports[k];
  save(SK_REPORTS, reports);
  renderReportStorico();
  toast('Report eliminato');
}

// ============================================================
// STAMPA REPORT SCORTE
// ============================================================
function stampaReportScorte() {
  const farmaci = load(SK_FCRA);
  const oggi = new Date().toLocaleDateString('it-IT');
  const righe = farmaci.map(f => {
    const scorta = Math.round(calcolaScorta(f));
    const conf   = f.xconf || 1;
    const confRim = (scorta / conf).toFixed(1);
    const { stato, giorni } = statoFarmacoGiorni(f);
    const statoLabel = stato === 'urgent' ? 'CRITICO' : stato === 'warn' ? 'ATTENZIONE' : 'OK';
    return `<tr>
      <td>${f.nome}</td><td>${f.forma||''}</td>
      <td style="text-align:right">${scorta} ${f.udm||'u'}</td>
      <td style="text-align:right">${confRim}</td>
      <td style="text-align:center">${giorni !== null ? giorni + ' gg' : '—'}</td>
      <td style="text-align:center;font-weight:bold">${statoLabel}</td>
    </tr>`;
  }).join('');
  _apriStampaPulita('Inventario Scorte Magazzino', oggi, `
    <table style="width:100%;border-collapse:collapse;font-size:9pt">
      <thead><tr style="background:#e0e0e0">
        <th style="border:1px solid #000;padding:2mm 3mm;text-align:left">Farmaco</th>
        <th style="border:1px solid #000;padding:2mm 3mm;text-align:left">Forma</th>
        <th style="border:1px solid #000;padding:2mm 3mm;text-align:right">Scorta</th>
        <th style="border:1px solid #000;padding:2mm 3mm;text-align:right">Conf. rimanenti</th>
        <th style="border:1px solid #000;padding:2mm 3mm;text-align:center">Giorni residui</th>
        <th style="border:1px solid #000;padding:2mm 3mm;text-align:center">Stato</th>
      </tr></thead>
      <tbody>${righe}</tbody>
    </table>`);
}

function stampaReportConsumi() {
  const farmaci = load(SK_FCRA).filter(f => calcolaConsumoCRA(f.id) > 0);
  const oggi = new Date().toLocaleDateString('it-IT');
  const righe = farmaci.map(f => {
    const consumo = calcolaConsumoCRA(f.id);
    const consMese = Math.round(consumo * 30);
    const conf = f.xconf || 1;
    const daOrdinare = Math.ceil(consMese / conf);
    return `<tr>
      <td>${f.nome}</td>
      <td style="text-align:right">${consumo.toFixed(1)} ${f.udm||'u'}/die</td>
      <td style="text-align:right">${consMese} ${f.udm||'u'}</td>
      <td style="text-align:right;font-weight:bold">${daOrdinare} conf</td>
    </tr>`;
  }).join('');
  _apriStampaPulita('Farmaci in Uso — Consumo Mensile', oggi, `
    <table style="width:100%;border-collapse:collapse;font-size:9pt">
      <thead><tr style="background:#e0e0e0">
        <th style="border:1px solid #000;padding:2mm 3mm;text-align:left">Farmaco</th>
        <th style="border:1px solid #000;padding:2mm 3mm;text-align:right">Consumo/die</th>
        <th style="border:1px solid #000;padding:2mm 3mm;text-align:right">Consumo mensile</th>
        <th style="border:1px solid #000;padding:2mm 3mm;text-align:right">Conf. da ordinare</th>
      </tr></thead>
      <tbody>${righe}</tbody>
    </table>`);
}

function stampaStorico(k) {
  const reports = loadO(SK_REPORTS);
  const r = reports[k];
  if (!r) return;
  const data = new Date(r.data).toLocaleDateString('it-IT');
  const righe = (r.snapshot || []).map(f => `<tr>
    <td>${f.nome}</td>
    <td style="text-align:right">${f.scorta} ${f.udm||'u'}</td>
    <td style="text-align:right">${f.consumoMensile > 0 ? f.consumoMensile + ' ' + f.udm : '—'}</td>
    <td style="text-align:right;font-weight:bold">${f.confezioniDaOrdinare > 0 ? f.confezioniDaOrdinare + ' conf' : '—'}</td>
    <td style="text-align:center">${f.stato === 'urgent' ? 'CRITICO' : f.stato === 'warn' ? 'ATTENZIONE' : 'OK'}</td>
  </tr>`).join('');
  _apriStampaPulita('Report Mensile — ' + r.label, 'Generato il ' + data, `
    <table style="width:100%;border-collapse:collapse;font-size:9pt">
      <thead><tr style="background:#e0e0e0">
        <th style="border:1px solid #000;padding:2mm 3mm;text-align:left">Farmaco</th>
        <th style="border:1px solid #000;padding:2mm 3mm;text-align:right">Scorta</th>
        <th style="border:1px solid #000;padding:2mm 3mm;text-align:right">Consumo mensile</th>
        <th style="border:1px solid #000;padding:2mm 3mm;text-align:right">Conf. da ordinare</th>
        <th style="border:1px solid #000;padding:2mm 3mm;text-align:center">Stato</th>
      </tr></thead>
      <tbody>${righe}</tbody>
    </table>`);
}
