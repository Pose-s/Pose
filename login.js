import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const errorMsg = document.getElementById('errorMsg');
const authBtn = document.getElementById('authBtn');
const formTitle = document.getElementById('formTitle');
const toggleText = document.getElementById('toggleText');
const toggleLink = document.getElementById('toggleLink');

let isLoginMode = true;

// Se già loggato, vai direttamente alla Home
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = 'home.html';
});

toggleLink.addEventListener('click', (e) => {
  e.preventDefault();
  isLoginMode = !isLoginMode;
  formTitle.textContent = isLoginMode ? 'Accedi' : 'Registrati';
  authBtn.textContent = isLoginMode ? 'Accedi' : 'Registrati';
  toggleText.textContent = isLoginMode ? 'Non hai un account?' : 'Hai già un account?';
  toggleLink.textContent = isLoginMode ? 'Registrati' : 'Accedi';
  errorMsg.classList.add('hidden');
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.classList.add('hidden');
  authBtn.disabled = true;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    if (isLoginMode) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Crea documento profilo vuoto per il nuovo utente
      await setDoc(doc(db, 'users', cred.user.uid), {
        displayName: email.split('@')[0],
        logoUrl: ''
      });
    }
    window.location.href = 'home.html';
  } catch (error) {
    errorMsg.textContent = translateError(error.code);
    errorMsg.classList.remove('hidden');
  } finally {
    authBtn.disabled = false;
  }
});

function translateError(code) {
  const map = {
    'auth/email-already-in-use': 'Questa email è già registrata.',
    'auth/invalid-email': 'Email non valida.',
    'auth/weak-password': 'La password deve avere almeno 6 caratteri.',
    'auth/user-not-found': 'Utente non trovato.',
    'auth/wrong-password': 'Password errata.',
    'auth/invalid-credential': 'Email o password errati.'
  };
  return map[code] || 'Si è verificato un errore. Riprova.';
}