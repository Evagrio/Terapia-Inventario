// RENDER LISTA PAZIENTI
// ============================================================
function renderLista() {
  const pazienti = load(SK.pazienti);
  const q = (document.getElementById('search-pz').value||'').toLowerCase();
  const g = '';
  const terapie = load(SK.terapie);

  let lista = pazienti.filter(p => {
    const nm = (p.cognome+' '+p.nome).toLowerCase();
    return nm.includes(q) && (!g || p.gruppo===g);
  });

  const count = document.getElementById('pz-count');
  count.textContent = lista.length + ' pazient' + (lista.length===1?'e':'i');

  const grid = document.getElementById('grid-pazienti');
  if (!lista.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="icon">👤</div><p>Nessun paziente trovato</p></div>';
    return;
  }

  grid.innerHTML = lista.map(p => {
    const tt = terapie.filter(t => t.pazienteId===p.id && !t.dataFine);
    const nOrale   = tt.filter(t=>t.sezione==='orale').length;
    const nAltro   = tt.filter(t=>t.sezione!=='orale').length;
    const badge = (p.attivo==='false'||p.attivo===false)
      ? '<span class="badge badge-dim">Dimesso</span>' : '';
    return `
    <div class="pcard" onclick="apriScheda('${p.id}')">
      <div class="pcard-head">
        <div>
          <div class="pname">${escapeHTML(p.cognome)} ${escapeHTML(p.nome)}</div>
          <div class="pmeta">${p.attivo==='false'||p.attivo===false?'Dimesso':'Attivo'}${(p.terapiaSospesa===true||p.terapiaSospesa==='true') ? ' · <span style="color:var(--amber)">⏸ Terapia sospesa</span>' : ''}</div>
          ${p.allergie ? `<div style="margin-top:4px;font-size:0.7rem;background:var(--amber-bg);border:1px solid var(--amber);color:var(--amber);border-radius:6px;padding:2px 7px;display:inline-block">⚠ ${escapeHTML(p.allergie)}</div>` : ''}
        </div>
        ${badge}
      </div>
      <div class="pcard-body">
        <div class="pcard-stats">
          <div class="pstat"><div class="pstat-n">${tt.length}</div><div class="pstat-l">farmaci attivi</div></div>
          <div class="pstat"><div class="pstat-n">${nOrale}</div><div class="pstat-l">orali</div></div>
          <div class="pstat"><div class="pstat-n">${nAltro}</div><div class="pstat-l">altri</div></div>
        </div>
      </div>
      <div class="pcard-actions" onclick="event.stopPropagation()">
        <button class="btn btn-blue btn-sm" onclick="apriScheda('${p.id}')">📋 Scheda terapia</button>
        <button class="btn ${(p.terapiaSospesa===true||p.terapiaSospesa==='true')?'btn-gold':'btn-ghost'} btn-sm" onclick="toggleTerapiaSospesa('${p.id}')">${(p.terapiaSospesa===true||p.terapiaSospesa==='true') ? '▶ Riprendi' : '⏸ Sospendi'}</button>
        <button class="btn btn-ghost btn-sm" onclick="openModalPaziente('${p.id}')">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="eliminaPaziente('${p.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
// APRI SCHEDA PAZIENTE
// ============================================================
function apriScheda(pid) {
  pazienteAperto = pid;
  document.getElementById('vista-lista').style.display = 'none';
  document.getElementById('vista-scheda').style.display = '';
  renderScheda(pid);
}

function tornaLista() {
  pazienteAperto = null;
  document.getElementById('vista-scheda').style.display = 'none';
  document.getElementById('vista-lista').style.display = '';
  renderLista();
}

function renderScheda(pid) {
  const pazienti = load(SK.pazienti);
  const pz = pazienti.find(p=>p.id===pid);
  if (!pz) return;

  const terapie = load(SK.terapie);
  const tt = terapie.filter(t=>t.pazienteId===pid);
  const attive = tt.filter(t=>!t.dataFine);

  const contatori = loadO(SK.contatori);
  const nFoglio = contatori[pid] || 1;

  const oggi = new Date().toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'});

  const badge = pz.gruppo==='CD'
    ? '<span class="badge badge-cd">Pz CD</span>'
    : '<span class="badge badge-cra">Pz CRA</span>';

  const ORARI = ['8','13','15','20'];

  const buildRow = (t) => {
    const orari = ORARI.map(o => {
      const on = t.orari && t.orari.includes(o);
      // dose per questo orario: usa mappa dosi se disponibile, fallback a doseNum legacy
      const doseVal = on
        ? (t.dosi && t.dosi[o] != null ? t.dosi[o] : (t.doseNum != null ? t.doseNum : ''))
        : '';
      const unit = t.doseUnit || '';
      if (on) {
        return `<td style="text-align:center">
          <span class="dose-circle attivo" onclick="editDoseOrario('${t.id}','${pid}','${o}',this)" title="Clicca per modificare dose ore ${o}">
            <span class="dose-circle-val">${doseVal}</span>
          </span>
        </td>`;
      }
      return `<td style="text-align:center"><span class="orario-dot">—</span></td>`;
    }).join('');
    const sospCell = t.dataFine
      ? `<td class="drug-sosp">${t.dataFine}<br><small style="color:var(--dim)">firma: ___</small></td>`
      : `<td class="drug-date">—</td>`;
    return `
      <tr>
        <td class="drug-date">${t.dataInizio||'—'}<br><small style="color:var(--dim)">firma: ___</small></td>
        <td><span class="drug-nome">${t.farmaco}</span>${t.via?`<br><small style="color:var(--muted)">${t.via}</small>`:''}</td>
        ${orari}
        ${sospCell}
        <td style="text-align:right">
            <div style="display:flex;gap:4px;justify-content:flex-end">
              <button class="btn btn-ghost btn-sm no-print" onclick="editTerapia('${t.id}','${pid}')">✏️</button>
              <button class="btn btn-ghost btn-sm no-print" onclick="eliminaTerapia('${t.id}','${pid}')">🗑</button>
            </div>
          </td>
      </tr>`;
  };

  const buildTableOrale = (sezione, label, colorClass) => {
    const rows = attive.filter(t=>t.sezione===sezione);
    return `
    <div class="sezione">
      <div class="sezione-head">
        <span class="sezione-title ${colorClass}">${label}</span>
        <button class="btn btn-ghost btn-sm no-print" onclick="openModalFarmaco('${pid}','${sezione}')">+ Aggiungi</button>
      </div>
      <table class="drug-table">
        <thead><tr>
          <th style="width:90px">Data inizio<br>Firma medico</th>
          <th>Farmaco / Dose</th>
          <th style="width:38px;text-align:center">8</th>
          <th style="width:38px;text-align:center">13</th>
          <th style="width:38px;text-align:center">15</th>
          <th style="width:38px;text-align:center">20</th>
          <th style="width:90px">Data sosp.<br>Firma medico</th>
          <th class="no-print" style="width:40px"></th>
        </tr></thead>
        <tbody>
          ${rows.length ? rows.map(buildRow).join('') : `<tr><td colspan="8" class="empty-row">Nessuna terapia ${label.toLowerCase()} attiva</td></tr>`}
        </tbody>
      </table>
    </div>`;
  };

  // Sezione al bisogno (senza orari)
  const buildTableBisogno = () => {
    const rows = attive.filter(t=>t.sezione==='bisogno');
    return `
    <div class="sezione">
      <div class="sezione-head">
        <span class="sezione-title bisogno">Terapia al Bisogno</span>
        <button class="btn btn-ghost btn-sm no-print" onclick="openModalFarmaco('${pid}','bisogno')">+ Aggiungi</button>
      </div>
      <table class="drug-table">
        <thead><tr>
          <th style="width:90px">Data inizio<br>Firma medico</th>
          <th>Farmaco / Dose / Via</th>
          <th>Indicazione</th>
          <th style="width:90px">Data sosp.<br>Firma medico</th>
          <th class="no-print" style="width:40px"></th>
        </tr></thead>
        <tbody>
          ${rows.length ? rows.map(t => {
            const sospCell = t.dataFine
              ? `<td class="drug-sosp">${t.dataFine}<br><small style="color:var(--dim)">firma: ___</small></td>`
              : `<td class="drug-date">—</td>`;
            return `<tr>
              <td class="drug-date">${t.dataInizio||'—'}<br><small style="color:var(--dim)">firma: ___</small></td>
              <td><span class="drug-nome">${t.farmaco}</span>${t.via?`<br><small style="color:var(--muted)">${t.via}</small>`:''}<br><span class="drug-dose">${t.dose||''}</span></td>
              <td style="font-size:0.78rem;color:var(--muted)">${t.indicazione||'—'}</td>
              ${sospCell}
              <td style="text-align:right">
            <div style="display:flex;gap:4px;justify-content:flex-end">
              <button class="btn btn-ghost btn-sm no-print" onclick="editTerapia('${t.id}','${pid}')">✏️</button>
              <button class="btn btn-ghost btn-sm no-print" onclick="eliminaTerapia('${t.id}','${pid}')">🗑</button>
            </div>
          </td>
            </tr>`;
          }).join('') : `<tr><td colspan="5" class="empty-row">Nessuna terapia al bisogno</td></tr>`}
        </tbody>
      </table>
    </div>`;
  };

  // Sezione Long Acting
  const buildTableLongActing = () => {
    const rows = attive.filter(t=>t.sezione==='longacting');
    const oggi2 = new Date(); oggi2.setHours(0,0,0,0);
    return `
    <div class="sezione">
      <div class="sezione-head">
        <span class="sezione-title longact">Terapia Long Acting</span>
        <button class="btn btn-ghost btn-sm no-print" onclick="openModalFarmaco('${pid}','longacting')">+ Aggiungi</button>
      </div>
      <table class="la-table">
        <thead><tr>
          <th>Farmaco / Dose</th>
          <th style="width:55px;text-align:center">Ogni</th>
          <th>Data eseguita</th>
          <th>Firma I.P.</th>
          <th>Data prossima</th>
          <th style="width:90px">Data sosp.<br>Firma medico</th>
          <th class="no-print" style="width:40px"></th>
        </tr></thead>
        <tbody>
          ${rows.length ? rows.map(t => {
            let prossimaClass = 'prossima-ok';
            if (t.laProssima) {
              const dp = new Date(t.laProssima); dp.setHours(0,0,0,0);
              const diff = (dp-oggi2)/(86400000);
              if (diff < 0) prossimaClass = 'prossima-late';
              else if (diff <= 7) prossimaClass = 'prossima-warn';
            }
            const sospCell = t.dataFine
              ? `<td class="drug-sosp">${t.dataFine}</td>`
              : `<td class="drug-date">—</td>`;
            return `<tr>
              <td><span class="drug-nome">${t.farmaco}</span><br><span class="drug-dose">${t.dose||''}</span></td>
              <td style="text-align:center;font-family:Inconsolata,monospace;font-size:0.8rem;color:var(--gold)">${t.laGiorni ? t.laGiorni+' gg' : '—'}</td>
              <td class="drug-date">${t.laEseguita||'—'}</td>
              <td style="width:80px;color:var(--dim);font-size:0.75rem">___________</td>
              <td class="${prossimaClass}">${t.laProssima||'—'}</td>
              ${sospCell}
              <td style="text-align:right">
            <div style="display:flex;gap:4px;justify-content:flex-end">
              <button class="btn btn-ghost btn-sm no-print" onclick="editTerapia('${t.id}','${pid}')">✏️</button>
              <button class="btn btn-ghost btn-sm no-print" onclick="eliminaTerapia('${t.id}','${pid}')">🗑</button>
            </div>
          </td>
            </tr>`;
          }).join('') : `<tr><td colspan="6" class="empty-row">Nessuna terapia long acting</td></tr>`}
        </tbody>
      </table>
    </div>`;
  };

  const html = `
    <div class="scheda-header">
      <div>
        <div class="scheda-pname">${pz.cognome} ${pz.nome}</div>
        <div class="scheda-meta">${pz.attivo==='false'||pz.attivo===false?'Dimesso':'Attivo'} · ${attive.length} farmaci attivi</div>
        ${(pz.terapiaSospesa===true||pz.terapiaSospesa==='true') ? '<div style="margin-top:6px;font-size:0.8rem;background:var(--amber-bg);border:1px solid var(--amber);color:var(--amber);border-radius:8px;padding:4px 12px;font-weight:700">⏸ TERAPIA SOSPESA — conteggio farmaci escluso</div>' : ''}
        ${pz.allergie ? `<div style="margin-top:6px;font-size:0.8rem;background:var(--amber-bg);border:1px solid var(--amber);color:var(--amber);border-radius:8px;padding:4px 12px;font-weight:700">⚠ ALLERGIE: ${pz.allergie}</div>` : ''}
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        ${badge}
        <span class="foglio-num" style="cursor:pointer" title="Clicca per modificare" onclick="editNFoglio('${pid}')">Foglio n° ${nFoglio} ✎</span>
        <button class="btn btn-blue btn-sm no-print" onclick="stampaFoglioB('${pid}')">🖨 Stampa foglio B</button>
        <button class="btn btn-ghost btn-sm no-print" onclick="openModalPaziente('${pid}')">✏️ Modifica</button>
      </div>
    </div>

    ${buildTableOrale('orale','Terapia Orale','orale')}
    ${buildTableOrale('topica','Terapia Topica / IM / SC / EV / Varie','topica')}
    ${buildTableBisogno()}
    ${buildTableLongActing()}

    <div class="scheda-footer">Aggiornata al: ${oggi}</div>
  `;

  document.getElementById('scheda-content').innerHTML = html;
}

// ============================================================
// STAMPA FOGLIO B
// ============================================================
function stampaFoglioB(pid) {
  const pazienti = load(SK.pazienti);
  const pz = pazienti.find(p=>p.id===pid);
  if (!pz) return;

  const terapie = load(SK.terapie);
  const attive  = terapie.filter(t=>t.pazienteId===pid && !t.dataFine);
  const contatori = loadO(SK.contatori);
  const nFoglio = contatori[pid] || 1;
  const oggi = new Date().toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'});
  const ORARI = ['8','13','15','20'];

  // Estrae solo il numero dalla stringa dose (es. "10 gtt" → "10", "1 cp" → "1", "0,5 cp" → "0,5")
  const doseNum = (dose) => {
    if (!dose) return '';
    const m = dose.match(/^([0-9]+[,.]?[0-9]*\/?\s?[0-9]*[,.]?[0-9]*)/);
    return m ? m[1].trim() : dose.split(' ')[0];
  };

  // Celle orario: mostra la quantità numerica solo negli orari attivi
  const buildOrariCells = (t) => ORARI.map(o => {
    const on = t.orari && t.orari.includes(o);
    return `<td class="or-cell">${on ? doseNum(t.dose) : ''}</td>`;
  }).join('');

  // Righe per sezione con numero fisso di righe vuote
  const buildRighe = (sezione, nRighe) => {
    const rows = attive.filter(t=>t.sezione===sezione);
    return Array.from({length: nRighe}, (_,i) => {
      const t = rows[i];
      if (t) {
        const fonte = t.fonte==='personale'
          ? '<span style="font-size:5.5pt;color:#888"> [P]</span>' : '';
        return `<tr>
          <td class="data-cell">${t.dataInizio||''}</td>
          <td class="firma-cell"></td>
          <td class="drug-cell">${t.farmaco.toUpperCase()}${fonte}</td>
          ${buildOrariCells(t)}
          <td class="data-cell">${t.dataFine||''}</td>
          <td class="firma-cell"></td>
        </tr>`;
      }
      return `<tr>
        <td class="data-cell"></td><td class="firma-cell"></td>
        <td class="drug-cell"></td>
        <td class="or-cell"></td><td class="or-cell"></td>
        <td class="or-cell"></td><td class="or-cell"></td>
        <td class="data-cell"></td><td class="firma-cell"></td>
      </tr>`;
    }).join('');
  };

  const buildRigheBisogno = (nRighe) => {
    const rows = attive.filter(t=>t.sezione==='bisogno');
    return Array.from({length: nRighe}, (_,i) => {
      const t = rows[i];
      if (t) {
        const fonte = t.fonte==='personale'
          ? '<span style="font-size:5.5pt;color:#888"> [P]</span>' : '';
        return `<tr>
          <td class="data-cell">${t.dataInizio||''}</td>
          <td class="firma-cell"></td>
          <td class="drug-cell" colspan="5">${t.farmaco.toUpperCase()}${fonte}${t.dose?' — '+t.dose:''}${t.indicazione?' — '+t.indicazione:''}</td>
          <td class="data-cell">${t.dataFine||''}</td>
          <td class="firma-cell"></td>
        </tr>`;
      }
      return `<tr>
        <td class="data-cell"></td><td class="firma-cell"></td>
        <td class="drug-cell" colspan="5"></td>
        <td class="data-cell"></td><td class="firma-cell"></td>
      </tr>`;
    }).join('');
  };

  // Long Acting: 2 righe, senza colonna firma inf nelle prime 2, firma inf spostata alla terza riga
  const buildRigheLongActing = () => {
    const rows = attive.filter(t=>t.sezione==='longacting');
    // riga 1: data inizio / firma medico / farmaco+dose / data eseguita / data prossima
    // riga 2: vuota o secondo farmaco
    // "Firma Inf." appare come riga separata sotto data eseguita (2 righe più in basso)
    const result = [];
    for (let i = 0; i < 2; i++) {
      const t = rows[i];
      if (t) {
        const fonte = t.fonte==='personale'
          ? '<span style="font-size:5.5pt;color:#888"> [P]</span>' : '';
        result.push(`<tr>
          <td class="data-cell">${t.dataInizio||''}</td>
          <td class="firma-cell"></td>
          <td class="drug-cell-la">${t.farmaco.toUpperCase()}${fonte}<br><span style="font-size:7pt">${t.dose||''}</span></td>
          <td class="data-cell">${t.laEseguita||''}</td>
          <td class="data-cell">${t.laProssima||''}</td>
        </tr>`);
      } else {
        result.push(`<tr>
          <td class="data-cell"></td><td class="firma-cell"></td>
          <td class="drug-cell-la"></td>
          <td class="data-cell"></td><td class="data-cell"></td>
        </tr>`);
      }
    }
    // riga 3: firma inf. spostata 2 righe più in basso
    result.push(`<tr>
      <td class="data-cell"></td><td class="firma-cell"></td>
      <td class="drug-cell-la"></td>
      <td class="data-cell" style="font-size:6.5pt;color:#555;text-align:center;vertical-align:top;padding-top:1mm">Firma Inf.</td>
      <td class="data-cell" style="font-size:6.5pt;color:#555;text-align:center;vertical-align:top;padding-top:1mm">Firma Inf.</td>
    </tr>`);
    return result.join('');
  };

  const laRows = attive.filter(t=>t.sezione==='longacting');
  const laGiorniLabel = laRows.length>0 && laRows[0].laGiorni
    ? ` OGNI ${laRows[0].laGiorni} GIORNI` : '';

  const orariHeader = ORARI.map(o=>`<th class="or-cell">${o}</th>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Foglio Terapia — ${pz.cognome} ${pz.nome}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Times New Roman',serif; font-size:8pt; background:#fff; color:#000; }
    .page { padding:7mm 9mm 5mm; }

    /* INTESTAZIONE */
    .hdr-table { width:100%; border-collapse:collapse; margin-bottom:4mm; }
    .hdr-logo {
      width:35%; vertical-align:top;
      font-family:'Brush Script MT','Segoe Script','URW Chancery L',cursive;
      font-size:14pt; line-height:1.3; color:#222;
    }
    .hdr-title {
      font-size:10pt; font-weight:bold; text-align:center;
      vertical-align:middle; line-height:1.5;
    }
    .hdr-pz {
      width:30%; text-align:right; vertical-align:top;
      font-size:14pt; font-weight:bold; line-height:1.4;
      border:1.5px solid #000; padding:2mm 3mm; text-align:center;
    }
    .hdr-sub { font-size:7pt; font-weight:normal; font-family:serif; display:block; margin-top:1mm; }

    /* GRIGLIA */
    .terapia-table { width:100%; border-collapse:collapse; font-size:8pt; table-layout:fixed; }
    .terapia-table th {
      border:1px solid #000; padding:1.5mm 1mm;
      text-align:center; background:#e0e0e0;
      font-size:7pt; font-weight:bold; line-height:1.2;
    }
    .terapia-table td {
      border:1px solid #000; padding:0.8mm 1mm;
      height:6.8mm; vertical-align:middle;
    }
    .data-cell  { width:17mm; text-align:center; font-size:7pt; }
    .firma-cell { width:19mm; }
    .drug-cell  { font-size:8.5pt; font-weight:bold; letter-spacing:0.02em; }
    .drug-cell-la { font-size:8.5pt; font-weight:bold; }
    .or-cell    { width:10mm; text-align:center; font-size:8.5pt; font-weight:bold; }

    /* TITOLI SEZIONE */
    .sez-row td {
      background:#c8c8c8; font-weight:bold; font-size:8pt;
      text-transform:uppercase; letter-spacing:.05em;
      padding:1.5mm 2mm; border:1px solid #000; height:6mm;
    }

    /* FOOTER */
    .footer-aggiornata { font-size:7.5pt; margin-top:2mm; display:flex; justify-content:space-between; }
    .footer-ente { font-size:6.5pt; color:#333; text-align:center; margin-top:1.5mm; border-top:1px solid #aaa; padding-top:1mm; }

    @page { size:A4 portrait; margin:6mm; }
  </style>
  </head><body>
  <div class="page">

    <table class="hdr-table">
      <tr>
        <td class="hdr-logo">
          Fondazione<br>Emilia Bosis
          <span class="hdr-sub" style="font-family:serif">Cascina Germoglio</span>
        </td>
        <td class="hdr-title">
          FOGLIO TERAPIA &nbsp;&nbsp; n.&nbsp;${nFoglio}
          <span class="hdr-sub">COMUNITÀ "IL GERMOGLIO" — VERDELLO (BG)</span>
        </td>
        <td class="hdr-pz">
          ${pz.cognome}<br>${pz.nome}
          ${pz.allergie?`<div style="font-size:7pt;color:#cc0000;font-weight:normal;margin-top:1mm">⚠ ${pz.allergie}</div>`:''}
        </td>
      </tr>
    </table>

    <table class="terapia-table">
      <colgroup>
        <col style="width:17mm"><col style="width:19mm">
        <col><col style="width:10mm"><col style="width:10mm">
        <col style="width:10mm"><col style="width:10mm">
        <col style="width:17mm"><col style="width:19mm">
      </colgroup>
      <thead>
        <tr>
          <th>DATA<br>INIZIO</th><th>FIRMA<br>MEDICO</th>
          <th>TERAPIA ORALE</th>
          ${orariHeader}
          <th>DATA<br>SOSP.</th><th>FIRMA<br>MEDICO</th>
        </tr>
      </thead>
      <tbody>
        ${buildRighe('orale', 17)}
        <tr class="sez-row"><td colspan="9">Terapia Topica &nbsp;/&nbsp; I.M. &nbsp;/&nbsp; S.C. &nbsp;/&nbsp; E.V. &nbsp;/&nbsp; Varie</td></tr>
        ${buildRighe('topica', 3)}
        <tr class="sez-row"><td colspan="9">Terapia al Bisogno</td></tr>
        ${buildRigheBisogno(5)}
        <tr class="sez-row"><td colspan="9">Terapia Long Acting${laGiorniLabel}</td></tr>
        <tr>
          <th class="data-cell">DATA<br>INIZIO</th>
          <th class="firma-cell">FIRMA<br>MEDICO</th>
          <th class="drug-cell-la">FARMACO / DOSE / VIA</th>
          <th class="data-cell" colspan="2">DATA ESEGUITA</th>
          <th class="data-cell" colspan="4">DATA PROSSIMA</th>
        </tr>
        ${buildRigheLongActing()}
      </tbody>
    </table>

    <div class="footer-aggiornata">
      <span>Aggiornata al: <strong>${oggi}</strong></span>
      <span>Foglio n.&nbsp;${nFoglio}</span>
    </div>
    <div class="footer-ente">
      FONDAZIONE EMILIA BOSIS &nbsp;·&nbsp; www.fondazionebosis.it &nbsp;·&nbsp; verdello@fondazionebosis.it<br>
      COMUNITÀ "IL GERMOGLIO", VIA SOLFERINO 51 - 24049 VERDELLO (BG) &nbsp; TEL. 035/4813814
    </div>
  </div>
  <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`;

  const cnt = loadO(SK.contatori);
  cnt[pid] = (cnt[pid]||1) + 1;
  save(SK.contatori, cnt);

  const w = window.open('','_blank');
  w.document.write(html);
  w.document.close();
  renderScheda(pid);
  toast('Foglio n°'+(cnt[pid]-1)+' inviato alla stampa');
}



// ============================================================
// MODAL PAZIENTE
// ============================================================
let editPzId = null;

function openModalPaziente(pid) {
  editPzId = pid || null;
  document.getElementById('modal-pz-title').textContent = pid ? 'Modifica paziente' : 'Nuovo paziente';
  if (pid) {
    const pz = load(SK.pazienti).find(p=>p.id===pid);
    if (pz) {
      document.getElementById('pz-cognome').value   = pz.cognome||'';
      document.getElementById('pz-nome').value      = pz.nome||'';
      document.getElementById('pz-attivo').value    = String(pz.attivo!==false&&pz.attivo!=='false');
      document.getElementById('pz-terapia-sospesa').value = String(pz.terapiaSospesa===true||pz.terapiaSospesa==='true');
      document.getElementById('pz-allergie').value  = pz.allergie||'';
      document.getElementById('pz-note').value      = pz.note||'';
    }
  } else {
    ['pz-cognome','pz-nome','pz-allergie','pz-note'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('pz-attivo').value = 'true';
    document.getElementById('pz-terapia-sospesa').value = 'false';
  }
  openModal('modal-paziente');
}

function salvaPaziente() {
  const cognome = document.getElementById('pz-cognome').value.trim();
  const nome    = document.getElementById('pz-nome').value.trim();
  if (!cognome||!nome) { alert('Cognome e nome sono obbligatori'); return; }

  const pazienti = load(SK.pazienti);
  if (editPzId) {
    const idx = pazienti.findIndex(p=>p.id===editPzId);
    if (idx>=0) Object.assign(pazienti[idx], {
      cognome, nome,
      gruppo:   'CRA',
      attivo:   document.getElementById('pz-attivo').value === 'true',
      terapiaSospesa: document.getElementById('pz-terapia-sospesa').value === 'true',
      allergie: document.getElementById('pz-allergie').value.trim(),
      note:     document.getElementById('pz-note').value.trim(),
    });
  } else {
    pazienti.push({ id:uid(), cognome, nome,
      gruppo:   'CRA',
      attivo:         true,
      terapiaSospesa: false,
      allergie: document.getElementById('pz-allergie').value.trim(),
      note:     document.getElementById('pz-note').value.trim(),
    });
  }
  save(SK.pazienti, pazienti);
  closeModal('modal-paziente');
  renderLista();
  if (pazienteAperto) renderScheda(pazienteAperto);
  toast(editPzId ? 'Paziente aggiornato' : 'Paziente aggiunto');
}


function toggleTerapiaSospesa(pid) {
  const pazienti = load(SK.pazienti);
  const idx = pazienti.findIndex(p=>p.id===pid);
  if (idx<0) return;
  pazienti[idx].terapiaSospesa = !(pazienti[idx].terapiaSospesa===true||pazienti[idx].terapiaSospesa==='true');
  save(SK.pazienti, pazienti);
  renderLista();
  if (pazienteAperto===pid) renderScheda(pid);
  toast(pazienti[idx].terapiaSospesa ? '⏸ Terapia sospesa — conteggio farmaci escluso' : '▶ Terapia ripresa');
}

function eliminaPaziente(pid) {
  if (!confirm('Eliminare questo paziente e tutte le sue terapie?')) return;
  save(SK.pazienti, load(SK.pazienti).filter(p=>p.id!==pid));
  save(SK.terapie, load(SK.terapie).filter(t=>t.pazienteId!==pid));
  tornaLista();
  toast('Paziente eliminato');
}

// ============================================================
// MODAL FARMACO
// ============================================================
function openModalFarmaco(pid, sezione) {
  farmacoEditPzId = pid;
  farmacoEditId = null;
  document.getElementById('modal-farm-title').textContent = 'Aggiungi farmaco';
  ['farm-nome','farm-note','farm-indicazione','farm-dose-la'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['farm-data-inizio','farm-data-fine','farm-la-eseguita','farm-la-prossima','farm-la-giorni','farm-dose-bisogno','farm-dose-num-la'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('farm-dose-unit').value = 'cp';
  document.getElementById('farm-via').value = '';
  document.getElementById('farm-sezione').value = sezione || 'orale';
  ['8','13','15','20'].forEach(o => {
    const cb = document.getElementById('or' + o);
    const inp = document.getElementById('dose-or' + o);
    const lbl = document.getElementById('dose-unit-label-' + o);
    if (cb) cb.checked = false;
    if (inp) { inp.value = ''; inp.style.display = 'none'; }
    if (lbl) lbl.style.display = 'none';
  });
  document.getElementById('farm-data-inizio').value = new Date().toISOString().slice(0,10);
  aggiornaCampiSezione();
  openModal('modal-farmaco');
}

function aggiornaCampiSezione() {
  const s = document.getElementById('farm-sezione').value;
  document.getElementById('grp-orari').style.display        = (s==='orale'||s==='topica') ? '' : 'none';
  document.getElementById('grp-longacting').style.display   = s==='longacting' ? '' : 'none';
  document.getElementById('grp-bisogno').style.display      = s==='bisogno' ? '' : 'none';
  const viaRow = document.getElementById('grp-via-row');
  if (viaRow) viaRow.style.display = (s==='orale'||s==='bisogno'||s==='longacting') ? 'none' : '';
  // sync unit labels
  aggiornaLabelUnitaDose();
}

function aggiornaLabelUnitaDose() {
  const unit = document.getElementById('farm-dose-unit')?.value || '';
  ['8','13','15','20'].forEach(o => {
    const lbl = document.getElementById('dose-unit-label-' + o);
    if (lbl) lbl.textContent = unit;
  });
}

function toggleDoseOrario(o) {
  const cb    = document.getElementById('or' + o);
  const inp   = document.getElementById('dose-or' + o);
  const lbl   = document.getElementById('dose-unit-label-' + o);
  if (!cb || !inp) return;
  inp.style.display = cb.checked ? 'inline-block' : 'none';
  if (lbl) lbl.style.display = cb.checked ? 'inline' : 'none';
  if (cb.checked) inp.focus();
}


// ============================================================
// MODIFICA TERAPIA ESISTENTE
// ============================================================
function editTerapia(tid, pid) {
  const terapie = load(SK.terapie);
  const t = terapie.find(x => x.id === tid);
  if (!t) return;

  farmacoEditId   = tid;
  farmacoEditPzId = pid;

  document.getElementById('modal-farm-title').textContent = 'Modifica farmaco';
  document.getElementById('farm-nome').value        = t.farmaco || '';
  document.getElementById('farm-sezione').value     = t.sezione || 'orale';
  document.getElementById('farm-dose-unit').value   = t.doseUnit || 'cp';
  document.getElementById('farm-via').value         = t.via || '';
  document.getElementById('farm-note').value        = t.note || '';
  document.getElementById('farm-data-inizio').value = t.dataInizio || '';
  document.getElementById('farm-data-fine').value   = t.dataFine || '';

  // sezione-specific fields
  const elInd = document.getElementById('farm-indicazione'); if (elInd) elInd.value = t.indicazione || '';
  const elDB  = document.getElementById('farm-dose-bisogno'); if (elDB)  elDB.value  = t.dose || '';
  const elDLA = document.getElementById('farm-dose-la');     if (elDLA) elDLA.value  = t.dose || '';
  const elDNLA= document.getElementById('farm-dose-num-la'); if (elDNLA) elDNLA.value = t.doseNum ?? '';
  const elLAe = document.getElementById('farm-la-eseguita'); if (elLAe) elLAe.value  = t.laEseguita || '';
  const elLAp = document.getElementById('farm-la-prossima'); if (elLAp) elLAp.value  = t.laProssima || '';
  const elLAg = document.getElementById('farm-la-giorni');   if (elLAg) elLAg.value  = t.laGiorni || '';

  // per-orario doses
  ['8','13','15','20'].forEach(o => {
    const cb  = document.getElementById('or' + o);
    const inp = document.getElementById('dose-or' + o);
    const lbl = document.getElementById('dose-unit-label-' + o);
    const active = t.orari && t.orari.includes(o);
    if (cb)  cb.checked = active;
    if (inp) {
      inp.value = active && t.dosi && t.dosi[o] != null ? t.dosi[o] : '';
      inp.style.display = active ? 'inline-block' : 'none';
    }
    if (lbl) lbl.style.display = active ? 'inline' : 'none';
  });

  aggiornaCampiSezione();
  openModal('modal-farmaco');
}

function salvaFarmaco() {
  const nome    = document.getElementById('farm-nome').value.trim();
  if (!nome) { alert('Il nome del farmaco è obbligatorio'); return; }

  const sezione = document.getElementById('farm-sezione').value;
  const unit    = document.getElementById('farm-dose-unit').value;

  // raccoglie orari attivi e dosi per orario
  const orari = [];
  const dosi  = {};
  if (sezione === 'orale' || sezione === 'topica') {
    ['8','13','15','20'].forEach(o => {
      const cb  = document.getElementById('or' + o);
      const inp = document.getElementById('dose-or' + o);
      if (cb && cb.checked) {
        orari.push(o);
        const v = parseFloat(inp ? inp.value : '');
        dosi[o] = isNaN(v) ? 0 : v;
      }
    });
  }

  // doseNum = somma dosi per inventario (usato anche come fallback per long acting)
  const doseNum = orari.reduce((s, o) => s + (dosi[o] || 0), 0);

  // dose testuale (per stampa e bisogno)
  let dose = '';
  if (sezione === 'orale' || sezione === 'topica') {
    // costruisci stringa tipo "5-5-10 gtt" dagli orari attivi
    dose = orari.map(o => dosi[o]).join('-') + (unit ? ' ' + unit : '');
  } else if (sezione === 'bisogno') {
    dose = (document.getElementById('farm-dose-bisogno')?.value || '').trim();
    if (!dose) { alert('Inserire la dose per la terapia al bisogno'); return; }
  } else if (sezione === 'longacting') {
    dose = (document.getElementById('farm-dose-la')?.value || '').trim();
  }

  const terapia = {
    id:         uid(),
    pazienteId: farmacoEditPzId,
    farmaco:    nome,
    sezione:    sezione,
    dose:       dose,
    doseNum:    doseNum || null,
    doseUnit:   unit,
    dosi:       dosi,           // mappa {orario: dose}
    invEnabled: true,
    fonte:      'CRA',
    farmacoCRAid: null,
    via:        document.getElementById('farm-via')?.value || '',
    orari:      orari,
    indicazione: (document.getElementById('farm-indicazione')?.value || '').trim(),
    laEseguita:  document.getElementById('farm-la-eseguita')?.value || '',
    laProssima:  document.getElementById('farm-la-prossima')?.value || '',
    laGiorni:    parseInt(document.getElementById('farm-la-giorni')?.value) || null,
    dataInizio:  document.getElementById('farm-data-inizio').value,
    dataFine:    document.getElementById('farm-data-fine').value || null,
    note:        document.getElementById('farm-note').value.trim(),
    dataCreazione: new Date().toISOString(),
  };

  // collega farmaco CRA in magazzino: cerca per nome
  const fcraList = load(SK_FCRA);
  const match = fcraList.find(f => f.nome.toLowerCase() === nome.toLowerCase());
  if (match) terapia.farmacoCRAid = match.id;

  const terapie = load(SK.terapie);
  if (farmacoEditId) {
    const idx = terapie.findIndex(x => x.id === farmacoEditId);
    if (idx >= 0) {
      terapia.id = farmacoEditId;
      terapia.dataCreazione = terapie[idx].dataCreazione;
      terapie[idx] = terapia;
    }
  } else {
    terapie.push(terapia);
  }
  save(SK.terapie, terapie);

  closeModal('modal-farmaco');
  renderScheda(farmacoEditPzId);
  toast(farmacoEditId ? 'Farmaco aggiornato' : 'Farmaco aggiunto');
  farmacoEditId = null;
}

function eliminaTerapia(tid, pid) {
  if (!confirm('Eliminare questa riga terapia?')) return;
  save(SK.terapie, load(SK.terapie).filter(t=>t.id!==tid));
  renderScheda(pid);
  toast('Farmaco rimosso');
}

// ============================================================
// EDIT DOSE ORARIO INLINE (popup sul cerchio)
// ============================================================
let _dosePopupOpen = null;

function editDoseOrario(tid, pid, orario, circleEl) {
  // chiudi popup precedente
  if (_dosePopupOpen) { _dosePopupOpen.remove(); _dosePopupOpen = null; }

  const terapie = load(SK.terapie);
  const t = terapie.find(x => x.id === tid);
  if (!t) return;

  const doseAttuale = t.dosi && t.dosi[orario] != null ? t.dosi[orario]
                    : (t.doseNum != null ? t.doseNum : '');
  const unit = t.doseUnit || '';

  const popup = document.createElement('div');
  popup.className = 'dose-popup no-print';
  popup.innerHTML = `
    <input type="number" id="dp-input" value="${doseAttuale}" min="0" step="0.5" style="width:64px">
    <span style="font-family:'Inconsolata',monospace;font-size:0.78rem;color:var(--muted)">${unit}</span>
    <button class="dose-pop-ok" onclick="salvaDoseOrario('${tid}','${pid}','${orario}')">✓</button>
  `;
  circleEl.style.position = 'relative';
  circleEl.appendChild(popup);
  _dosePopupOpen = popup;
  popup.querySelector('#dp-input').focus();
  popup.querySelector('#dp-input').select();

  // chiudi cliccando fuori
  setTimeout(() => {
    document.addEventListener('click', function chiudi(e) {
      if (!popup.contains(e.target) && e.target !== circleEl) {
        popup.remove(); _dosePopupOpen = null;
        document.removeEventListener('click', chiudi);
      }
    });
  }, 50);

  // invio con Enter
  popup.querySelector('#dp-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') salvaDoseOrario(tid, pid, orario);
    if (e.key === 'Escape') { popup.remove(); _dosePopupOpen = null; }
  });
}

function salvaDoseOrario(tid, pid, orario) {
  const inp = document.getElementById('dp-input');
  if (!inp) return;
  const nuovaDose = parseFloat(inp.value);
  if (isNaN(nuovaDose) || nuovaDose < 0) { toast('Dose non valida'); return; }

  const terapie = load(SK.terapie);
  const idx = terapie.findIndex(x => x.id === tid);
  if (idx < 0) return;
  if (!terapie[idx].dosi) terapie[idx].dosi = {};
  terapie[idx].dosi[orario] = nuovaDose;

  // ricalcola doseNum come somma
  const orariAttivi = terapie[idx].orari || [];
  terapie[idx].doseNum = orariAttivi.reduce((s, o) => s + ((terapie[idx].dosi && terapie[idx].dosi[o]) || 0), 0);

  // aggiorna dose testuale
  terapie[idx].dose = orariAttivi.map(o => terapie[idx].dosi[o] || 0).join('-') +
                      (terapie[idx].doseUnit ? ' ' + terapie[idx].doseUnit : '');

  save(SK.terapie, terapie);
  if (_dosePopupOpen) { _dosePopupOpen.remove(); _dosePopupOpen = null; }
  renderScheda(pid);
  toast('Dose aggiornata: ' + nuovaDose + ' ' + (terapie[idx].doseUnit||'') + ' ore ' + orario);
}

// ============================================================
// IMPORTA DA RICETTAMANAGER
// ============================================================
function importaRicettaManager() {
  document.getElementById('rm-file').value='';
  document.getElementById('rm-preview').style.display='none';
  openModal('modal-import');
  document.getElementById('rm-file').onchange = function() {
    const f = this.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        const patients = data.patients||[];
        const prev = document.getElementById('rm-preview');
        prev.style.display='';
        prev.textContent = `Trovati ${patients.length} pazienti in RicettaManager:\n`+
          patients.map(p=>`  • ${p.name} (${p.group})`).join('\n');
      } catch(err) {
        alert('File JSON non valido');
      }
    };
    r.readAsText(f);
  };
}

function eseguiImport() {
  const f = document.getElementById('rm-file').files[0];
  if (!f) { alert('Seleziona un file'); return; }
  const r = new FileReader();
  r.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      const rmPatients = data.patients||[];
      const pazienti = load(SK.pazienti);
      let aggiunti = 0;
      rmPatients.forEach(rmp => {
        const parts = (rmp.name||'').trim().split(' ');
        const cognome = parts[0]||'';
        const nome = parts.slice(1).join(' ')||'';
        // mappa gruppo RM → gruppo CRA app
        const gruppo = rmp.group==='CD' ? 'CD' : 'CRA';
        // controlla duplicati per nome
        const dup = pazienti.some(p =>
          p.cognome.toLowerCase()===cognome.toLowerCase() &&
          p.nome.toLowerCase()===nome.toLowerCase()
        );
        if (!dup) {
          pazienti.push({ id:uid(), cognome, nome, gruppo, attivo:true, note:'Importato da RicettaManager' });
          aggiunti++;
        }
      });
      save(SK.pazienti, pazienti);
      closeModal('modal-import');
      renderLista();
      toast(`Importati ${aggiunti} pazienti (${rmPatients.length-aggiunti} già presenti)`);
    } catch(err) {
      alert('Errore durante l\'importazione');
    }
  };
  r.readAsText(f);
}


// CONVALIDA TERAPIA
// ============================================================

function openModalConvalida() {
  // Preseleziona mese corrente
  const now = new Date();
  const mesi = ['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO',
                'LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'];
  document.getElementById('conv-mese').value = mesi[now.getMonth()];
  document.getElementById('conv-anno').value = now.getFullYear();
  document.getElementById('conv-pazienti-sel').value = 'tutti';
  document.getElementById('conv-pz-singolo').style.display = 'none';

  // Popola select paziente singolo
  const pazienti = load(SK.pazienti).filter(p=>p.attivo!==false&&p.attivo!=='false');
  const sel = document.getElementById('conv-pz-id');
  sel.innerHTML = pazienti.map(p=>`<option value="${p.id}">${p.cognome} ${p.nome}</option>`).join('');

  // Toggle singolo/tutti
  document.getElementById('conv-pazienti-sel').onchange = function() {
    document.getElementById('conv-pz-singolo').style.display =
      this.value === 'singolo' ? '' : 'none';
  };

  openModal('modal-convalida');
}

function stampaConvalida() {
  const mese  = document.getElementById('conv-mese').value;
  const anno  = document.getElementById('conv-anno').value;
  const modo  = document.getElementById('conv-pazienti-sel').value;

  let pazienti = load(SK.pazienti).filter(p=>p.attivo!==false&&p.attivo!=='false');
  if (modo === 'singolo') {
    const pid = document.getElementById('conv-pz-id').value;
    pazienti = pazienti.filter(p=>p.id===pid);
  }

  if (!pazienti.length) { toast('Nessun paziente attivo'); return; }

  // Calcola numero giorni del mese
  const meseIdx = ['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO',
    'LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'].indexOf(mese);
  const nGiorni = new Date(parseInt(anno), meseIdx+1, 0).getDate();
  const ORARI = ['8','13','15','20'];

  const buildFoglio = (pz) => {
    const righeGiorni = Array.from({length: nGiorni}, (_,i) => `
      <tr>
        <td class="cv-gg">${i+1}</td>
        <td class="cv-ann"></td>
        <td class="cv-or"></td>
        <td class="cv-or"></td>
        <td class="cv-or"></td>
        <td class="cv-or"></td>
      </tr>`).join('');

    return `
    <div class="convalida-page">

      <!-- INTESTAZIONE -->
      <table class="cv-hdr-table">
        <tr>
          <td class="cv-logo">
            FONDAZIONE<br>EMILIA BOSIS
          </td>
          <td class="cv-pz-box">
            ${pz.cognome} ${pz.nome}
          </td>
        </tr>
      </table>

      <!-- TITOLO -->
      <table class="cv-title-table">
        <tr>
          <td class="cv-title-left">convalida <strong>TERAPIA</strong></td>
          <td class="cv-title-right"><strong>${mese} ${anno}</strong></td>
        </tr>
      </table>

      <!-- GRIGLIA GIORNI -->
      <table class="cv-table">
        <thead>
          <tr>
            <th class="cv-gg">gg</th>
            <th class="cv-ann">annotazioni</th>
            ${ORARI.map(o=>`<th class="cv-or">${o}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${righeGiorni}
        </tbody>
      </table>

    </div>`;
  };

  const allPages = pazienti.map(buildFoglio).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Convalida Terapia — ${mese} ${anno}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Times New Roman',serif; font-size:9pt; background:#fff; color:#000; }

    .convalida-page {
      padding: 10mm 12mm 8mm;
      page-break-after: always;
      min-height: 277mm;
      display: flex;
      flex-direction: column;
    }
    .convalida-page:last-child { page-break-after: avoid; }

    /* INTESTAZIONE */
    .cv-hdr-table { width:100%; border-collapse:collapse; margin-bottom:6mm; }
    .cv-logo { font-size:8pt; font-weight:bold; width:40%; vertical-align:top; font-style:italic; }
    .cv-pz-box {
      width:55%; text-align:center; font-size:13pt; font-weight:bold;
      border:1.5px solid #000; padding:3mm 5mm; vertical-align:middle;
    }

    /* TITOLO */
    .cv-title-table { width:100%; border-collapse:collapse; margin-bottom:5mm; }
    .cv-title-left  { font-size:12pt; width:50%; vertical-align:bottom; }
    .cv-title-right { font-size:16pt; font-weight:bold; text-align:right; vertical-align:bottom; }

    /* GRIGLIA */
    .cv-table { width:100%; border-collapse:collapse; flex:1; }
    .cv-table th {
      border:1px solid #555; padding:1.5mm 1mm;
      text-align:center; font-size:8pt;
      background:#f0f0f0;
    }
    .cv-table td { border:1px solid #aaa; padding:0; height:7.2mm; }
    .cv-gg  { width:10mm; text-align:center; font-size:8pt; border-right:1px solid #555 !important; }
    .cv-ann { text-align:left; padding-left:2mm !important; }
    .cv-or  { width:13mm; text-align:center; border-left:1px solid #555 !important; }

    @page { size:A4 portrait; margin:6mm; }
  </style>
  </head><body>
  ${allPages}
  <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`;

  closeModal('modal-convalida');
  const w = window.open('','_blank');
  w.document.write(html);
  w.document.close();
  toast('Convalida terapia inviata alla stampa');
}
