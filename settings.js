import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged, signOut, updateEmail, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { escapeHtml } from './utils.js';
import { applyLanguage } from './lang.js';

const logoutBtn = document.getElementById('logoutBtn');
const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
const currentEmailDisplay = document.getElementById('currentEmailDisplay');

const changeEmailForm = document.getElementById('changeEmailForm');
const newEmailInput = document.getElementById('newEmailInput');
const emailCurrentPasswordInput = document.getElementById('emailCurrentPasswordInput');
const emailMsg = document.getElementById('emailMsg');

const changePasswordForm = document.getElementById('changePasswordForm');
const currentPasswordInput = document.getElementById('currentPasswordInput');
const newPasswordInput = document.getElementById('newPasswordInput');
const passwordMsg = document.getElementById('passwordMsg');

const blockedUsersList = document.getElementById('blockedUsersList');
const cookieSettingsBtn = document.getElementById('cookieSettingsBtn');

const storyDurationSelect = document.getElementById('storyDurationSelect');
const saveStoryDurationBtn = document.getElementById('saveStoryDurationBtn');
const storyDurationMsg = document.getElementById('storyDurationMsg');

const langSelect = document.getElementById('langSelect');

lucide.createIcons();

// ===== Gestione Cambio Lingua =====
const savedLang = localStorage.getItem('app_lang') || 'it';
if (langSelect) {
  langSelect.value = savedLang;
  langSelect.addEventListener('change', () => {
    const chosen = langSelect.value;
    localStorage.setItem('app_lang', chosen);
    applyLanguage(chosen);
  });
}
applyLanguage();

let currentUser = null;

async function doLogout() {
  await signOut(auth);
  window.location.href = 'login.html';
}

logoutBtn.addEventListener('click', doLogout);
settingsLogoutBtn.addEventListener('click', doLogout);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;
  currentEmailDisplay.textContent = user.email || '-';

  loadBlockedUsers();

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const data = userDoc.exists() ? userDoc.data() : {};
  storyDurationSelect.value = data.storyDuration || '24';
});

async function reauthenticate(password) {
  const credential = EmailAuthProvider.credential(currentUser.email, password);
  await reauthenticateWithCredential(currentUser, credential);
}

changeEmailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  emailMsg.classList.add('hidden');

  try {
    await reauthenticate(emailCurrentPasswordInput.value);
    await updateEmail(currentUser, newEmailInput.value.trim());

    await updateDoc(doc(db, 'users', currentUser.uid), {
      contactValue: newEmailInput.value.trim()
    }).catch(() => {});

    currentEmailDisplay.textContent = newEmailInput.value.trim();
    emailMsg.textContent = 'Email aggiornata con successo!';
    emailMsg.classList.remove('hidden', 'auth-error');
    emailMsg.classList.add('auth-success');
    changeEmailForm.reset();
  } catch (error) {
    console.error(error);
    emailMsg.textContent = translateAuthError(error.code);
    emailMsg.classList.remove('hidden');
    emailMsg.classList.add('auth-error');
  }
});

changePasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  passwordMsg.classList.add('hidden');

  try {
    await reauthenticate(currentPasswordInput.value);
    await updatePassword(currentUser, newPasswordInput.value);

    passwordMsg.textContent = 'Password aggiornata con successo!';
    passwordMsg.classList.remove('hidden', 'auth-error');
    passwordMsg.classList.add('auth-success');
    changePasswordForm.reset();
  } catch (error) {
    console.error(error);
    passwordMsg.textContent = translateAuthError(error.code);
    passwordMsg.classList.remove('hidden');
    passwordMsg.classList.add('auth-error');
  }
});

function translateAuthError(code) {
  const map = {
    'auth/wrong-password': 'Password attuale errata.',
    'auth/invalid-credential': 'Password attuale errata.',
    'auth/email-already-in-use': 'Questa email è già in uso.',
    'auth/invalid-email': 'Email non valida.',
    'auth/weak-password': 'La nuova password deve avere almeno 6 caratteri.',
    'auth/requires-recent-login': 'Per sicurezza, esci e rientra nel tuo account prima di riprovare.'
  };
  return map[code] || 'Si è verificato un errore. Riprova.';
}

// ===== Utenti bloccati =====
async function loadBlockedUsers() {
  const myDoc = await getDoc(doc(db, 'users', currentUser.uid));
  const data = myDoc.exists() ? myDoc.data() : {};
  const blocked = data.blockedUsers || [];

  if (blocked.length === 0) {
    blockedUsersList.innerHTML = '<p class="search-empty">Nessun utente bloccato.</p>';
    return;
  }

  const users = await Promise.all(blocked.map(async (uid) => {
    const d = await getDoc(doc(db, 'users', uid));
    return { uid, data: d.exists() ? d.data() : {} };
  }));

  blockedUsersList.innerHTML = users.map(u => `
    <div class="conversation-item">
      ${u.data.logoUrl
        ? `<img src="${u.data.logoUrl}" class="conversation-avatar" alt="" />`
        : `<div class="conversation-avatar-placeholder"><i data-lucide="user"></i></div>`
      }
      <div class="conversation-info">
        <span class="conversation-username">@${escapeHtml(u.data.username || 'utente')}</span>
      </div>
      <button type="button" class="btn-compact unblock-btn" data-uid="${u.uid}">Sblocca</button>
    </div>
  `).join('');

  lucide.createIcons();

  document.querySelectorAll('.unblock-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        blockedUsers: arrayRemove(btn.dataset.uid)
      });
      loadBlockedUsers();
    });
  });
}

// ===== Cookie =====
cookieSettingsBtn.addEventListener('click', () => {
  localStorage.removeItem('pose_cookie_consent');
  alert('Le preferenze sui cookie sono state reimpostate. Ricarica la pagina per rivedere il banner.');
});

// ===== Durata Storie =====
saveStoryDurationBtn.addEventListener('click', async () => {
  if (!currentUser) return;
  saveStoryDurationBtn.disabled = true;

  try {
    await updateDoc(doc(db, 'users', currentUser.uid), {
      storyDuration: storyDurationSelect.value
    });
    storyDurationMsg.textContent = 'Durata storie aggiornata!';
    storyDurationMsg.classList.remove('hidden', 'auth-error');
    storyDurationMsg.classList.add('auth-success');
  } catch (error) {
    console.error(error);
    storyDurationMsg.textContent = 'Errore durante il salvataggio.';
    storyDurationMsg.classList.remove('hidden');
  } finally {
    saveStoryDurationBtn.disabled = false;
  }
});
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-functions.js";

const functionsInstance = getFunctions(app);
const verifyStatusText = document.getElementById('verifyStatusText');
const startVerifyBtn = document.getElementById('startVerifyBtn');

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const data = userDoc.exists() ? userDoc.data() : {};
  const followers = (data.followers || []).length;

  if (data.verified) {
    verifyStatusText.textContent = 'Il tuo account è verificato ✓';
    return;
  }

  if (followers < 100000) {
    verifyStatusText.textContent = `Ti servono almeno 100.000 follower per richiedere la verifica (attualmente: ${followers}).`;
    return;
  }

  const reqDoc = await getDoc(doc(db, 'verificationRequests', user.uid));
  if (reqDoc.exists()) {
    const r = reqDoc.data();
    verifyStatusText.textContent = `Richiesta in corso — Identità: ${r.identityStatus || 'da avviare'}, Pagamento: ${r.paymentStatus || 'da avviare'}`;
  } else {
    verifyStatusText.textContent = 'Hai i requisiti per richiedere la verifica!';
  }

  startVerifyBtn.classList.remove('hidden');
});

startVerifyBtn.addEventListener('click', async () => {
  startVerifyBtn.disabled = true;
  try {
    const createIdentitySession = httpsCallable(functionsInstance, 'createIdentitySession');
    const identityResult = await createIdentitySession();
    window.open(identityResult.data.url, '_blank');

    const createCheckoutSession = httpsCallable(functionsInstance, 'createCheckoutSession');
    const checkoutResult = await createCheckoutSession();
    window.location.href = checkoutResult.data.url;
  } catch (error) {
    console.error(error);
    alert('Errore: ' + error.message);
    startVerifyBtn.disabled = false;
  }
});