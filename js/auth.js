function getPassword() {
  return storageGet(PWD_KEY) || DEFAULT_PWD;
}

function loginApp() {
  const pwd = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  if (pwd === getPassword()) {
    if (document.getElementById('ricorda-device') &&
        document.getElementById('ricorda-device').checked) {
      localStorage.setItem(DEVICE_KEY, 'true');
    }
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('login-password').value = '';
    err.textContent = '';
  } else {
    err.textContent = 'Password errata';
    err.style.display = 'block';
  }
}

function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
         (navigator.maxTouchPoints > 1 && window.innerWidth < 768);
}

function checkLogin() {
  if (isMobile()) {
    document.getElementById('login-screen').style.display = 'none';
    return;
  }
  if (localStorage.getItem(DEVICE_KEY) === 'true') {
    document.getElementById('login-screen').style.display = 'none';
    return;
  }
  document.getElementById('login-screen').style.display = 'flex';
}

function logoutApp() {
  if (isMobile()) return;
  localStorage.removeItem(DEVICE_KEY);
  document.getElementById('login-password').value = '';
  document.getElementById('login-screen').style.display = 'flex';
}


// CAMBIO PASSWORD
// ============================================================
function openModalCambiaPassword() {
  ['pwd-attuale','pwd-nuova','pwd-conferma'].forEach(id =>
    document.getElementById(id).value = '');
  document.getElementById('pwd-error').style.display = 'none';
  openModal('modal-cambia-pwd');
}

function eseguiCambioPassword() {
  const attuale  = document.getElementById('pwd-attuale').value;
  const nuova    = document.getElementById('pwd-nuova').value;
  const conferma = document.getElementById('pwd-conferma').value;
  const errEl    = document.getElementById('pwd-error');
  if (attuale !== getPassword()) {
    errEl.textContent = 'Password attuale errata'; errEl.style.display='block'; return;
  }
  if (nuova.length < 6) {
    errEl.textContent = 'Min. 6 caratteri'; errEl.style.display='block'; return;
  }
  if (nuova !== conferma) {
    errEl.textContent = 'Le password non coincidono'; errEl.style.display='block'; return;
  }
  storageSet(PWD_KEY, nuova);
  closeModal('modal-cambia-pwd');
  toast('Password aggiornata');
}

