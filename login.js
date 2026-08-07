import { auth } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { sendEmailVerification } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

const resendBtn = document.getElementById('resendBtn');
let lastUnverifiedUser = null;

const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('emailInput');
const phoneInput = document.getElementById('phoneInput');
const passwordInput = document.getElementById('passwordInput');
const errorMsg = document.getElementById('errorMsg');
const authBtn = document.getElementById('authBtn');
const loginEmailField = document.getElementById('loginEmailField');
const loginPhoneField = document.getElementById('loginPhoneField');

let contactType = 'email';

onAuthStateChanged(auth, (user) => {
  if (user && user.emailVerified) {
    window.location.href = 'home.html';
  }
});

document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    contactType = btn.dataset.type;

    if (contactType === 'email') {
      loginEmailField.classList.remove('hidden');
      loginPhoneField.classList.add('hidden');
    } else {
      loginEmailField.classList.add('hidden');
      loginPhoneField.classList.remove('hidden');
    }
  });
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.classList.add('hidden');
  authBtn.disabled = true;

  const password = passwordInput.value;

  try {
    if (contactType === 'email') {
      const email = emailInput.value.trim();
      const cred = await signInWithEmailAndPassword(auth, email, password);

      if (!cred.user.emailVerified) {
        errorMsg.textContent = 'Devi prima confermare la tua email tramite il link che ti abbiamo inviato.';
        errorMsg.classList.remove('hidden');
        resendBtn.classList.remove('hidden');
  lastUnverifiedUser = cred.user;
        authBtn.disabled = false;
        return;
      }
    } else {
      errorMsg.textContent = 'Il login diretto via telefono richiede di reinviare un codice OTP: funzionalità in arrivo. Per ora usa l\'email associata, se presente.';
      errorMsg.classList.remove('hidden');
      authBtn.disabled = false;
      return;
    }

    window.location.href = 'home.html';
  } catch (error) {
    errorMsg.textContent = translateError(error.code);
    errorMsg.classList.remove('hidden');
    authBtn.disabled = false;
  }
});

function translateError(code) {
  const map = {
    'auth/invalid-email': 'Email non valida.',
    'auth/user-not-found': 'Utente non trovato.',
    'auth/wrong-password': 'Password errata.',
    'auth/invalid-credential': 'Email o password errati.'
  };
  return map[code] || 'Si è verificato un errore. Riprova.';
}
resendBtn.addEventListener('click', async () => {
  if (!lastUnverifiedUser) return;
  resendBtn.disabled = true;
  resendBtn.textContent = 'Invio in corso...';

  try {
    await sendEmailVerification(lastUnverifiedUser);
    errorMsg.textContent = 'Nuova email inviata! Controlla anche Spam e Promozioni.';
    errorMsg.classList.remove('hidden');
  } catch (error) {
    errorMsg.textContent = 'Errore durante l\'invio. Riprova tra qualche minuto.';
    errorMsg.classList.remove('hidden');
  } finally {
    resendBtn.disabled = false;
    resendBtn.textContent = 'Reinvia email di conferma';
  }
});