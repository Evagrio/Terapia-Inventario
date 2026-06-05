// Funzione per sanificare le stringhe (previene XSS)
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, function(tag) {
    const charsToReplace = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
    return charsToReplace[tag] || tag;
  });
}

// ============================================================
// STORAGE
// ============================================================
const SK = {
  pazienti:   'fcra_pazienti',
  terapie:    'fcra_terapie',
  contatori:  'fcra_contatori',
  movimenti:  'fcra_movimenti',
};

const DEVICE_KEY    = 'fcra_device_trusted';
const PWD_KEY       = 'fcra_password';
const DEFAULT_PWD   = 'farmacia2026';

function storageGet(key) {
  try { return localStorage.getItem(key); }
  catch (err) { return null; }
}

function storageSet(key, value) {
  try {
    const previous = localStorage.getItem(key);
    if (previous !== null) localStorage.setItem(key + '_last_good', previous);
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    alert('Salvataggio non riuscito: spazio locale esaurito o browser non disponibile. Esporta un backup prima di continuare.');
    return false;
  }
}

function safeParse(raw, fallback, key) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); }
  catch (err) {
    const backup = storageGet(key + '_last_good');
    if (backup) {
      try { return JSON.parse(backup); } catch (_) {}
    }
    console.warn('Dato locale corrotto:', key);
    return fallback;
  }
}

const load  = k => {
  const value = safeParse(storageGet(k), [], k);
  return Array.isArray(value) ? value : [];
};
const loadO = k => {
  const value = safeParse(storageGet(k), {}, k);
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};
const save  = (k,v) => storageSet(k, JSON.stringify(v));
const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
