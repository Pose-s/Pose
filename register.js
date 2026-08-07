import { auth, db, storage } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";
import { compressImage } from './utils.js';

const registerForm = document.getElementById('registerForm');
const otpForm = document.getElementById('otpForm');
const successStep = document.getElementById('successStep');
const successMsg = document.getElementById('successMsg');

const emailField = document.getElementById('emailField');
const phoneField = document.getElementById('phoneField');
const emailInput = document.getElementById('emailInput');
const phoneInput = document.getElementById('phoneInput');
const usernameInput = document.getElementById('usernameInput');
const usernameHint = document.getElementById('usernameHint');
const birthdateInput = document.getElementById('birthdateInput');
const passwordInput = document.getElementById('passwordInput');
const bioInput = document.getElementById('bioInput');
const avatarInput = document.getElementById('avatarInput');
const avatarPreview = document.getElementById('avatarPreview');
const errorMsg = document.getElementById('errorMsg');
const registerBtn = document.getElementById('registerBtn');

const otpPhoneDisplay = document.getElementById('otpPhoneDisplay');
const otpInput = document.getElementById('otpInput');
const otpErrorMsg = document.getElementById('otpErrorMsg');
const verifyOtpBtn = document.getElementById('verifyOtpBtn');

let contactType = 'email';
let confirmationResult = null;
let pendingUserData = null;

lucide.createIcons();

// Toggle Email / Telefono
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    contactType = btn.dataset.type;

    if (contactType === 'email') {
      emailField.classList.remove('hidden');
      phoneField.classList.add('hidden');
    } else {
      emailField.classList.add('hidden');
      phoneField.classList.remove('hidden');
    }
  });
});

// Anteprima avatar
avatarInput.addEventListener('change', () => {
  const file = avatarInput.files[0];
  if (!file) { avatarPreview.classList.add('hidden'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    avatarPreview.src = e.target.result;
    avatarPreview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

// Controllo disponibilità username (mentre l'utente scrive)
let usernameCheckTimeout;
usernameInput.addEventListener('input', () => {
  clearTimeout(usernameCheckTimeout);
  const username = usernameInput.value.trim().toLowerCase();
  usernameHint.textContent = '';
  usernameHint.className = 'field-hint';

  if (username.length < 3) return;

  usernameCheckTimeout = setTimeout(async () => {
    const docSnap = await getDoc(doc(db, 'usernames', username));
    if (docSnap.exists()) {
      usernameHint.textContent = 'Nome utente già in uso';
      usernameHint.className = 'field-hint hint-error';
    } else {
      usernameHint.textContent = 'Disponibile ✓';
      usernameHint.className = 'field-hint hint-ok';
    }
  }, 400);
});

function calculateAge(birthdateStr) {
  const birth = new Date(birthdateStr);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.classList.add('hidden');

  const username = usernameInput.value.trim().toLowerCase();
  const birthdate = birthdateInput.value;
  const password = passwordInput.value;
  const bio = bioInput.value.trim();

  // Validazione età
  if (calculateAge(birthdate) < 13) {
    errorMsg.textContent = 'Devi avere almeno 13 anni per registrarti.';
    errorMsg.classList.remove('hidden');
    return;
  }

  // Validazione username univoco
  const usernameDoc = await getDoc(doc(db, 'usernames', username));
  if (usernameDoc.exists()) {
    errorMsg.textContent = 'Questo nome utente è già in uso.';
    errorMsg.classList.remove('hidden');
    return;
  }

  registerBtn.disabled = true;
  registerBtn.textContent = 'Attendere...';

  // Prepara logo (se presente), comprimendolo
  let avatarBase64 = null;
  const avatarFile = avatarInput.files[0];
  if (avatarFile) {
    avatarBase64 = await compressImage(avatarFile, 400, 0.8);
  }

  pendingUserData = { username, birthdate, password, bio, avatarBase64 };

  try {
    if (contactType === 'email') {
      await completeEmailRegistration(emailInput.value.trim());
    } else {
      await startPhoneVerification(phoneInput.value.trim());
    }
  } catch (error) {
    console.error(error);
    errorMsg.textContent = translateError(error.code);
    errorMsg.classList.remove('hidden');
    registerBtn.disabled = false;
    registerBtn.textContent = 'Continua';
  }
});

async function completeEmailRegistration(email) {
  const cred = await createUserWithEmailAndPassword(auth, email, pendingUserData.password);
  await finalizeProfile(cred.user.uid, { contactType: 'email', contactValue: email });
  await sendEmailVerification(cred.user);
  await signOut(auth);

  registerForm.classList.add('hidden');
  successStep.classList.remove('hidden');
  successMsg.textContent = `Ti abbiamo inviato un'email di conferma a ${email}. Clicca sul link per attivare l'account, poi torna ad accedere.`;
}

async function startPhoneVerification(phoneNumber) {
  window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible'
  });

  confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);

  registerForm.classList.add('hidden');
  otpForm.classList.remove('hidden');
  otpPhoneDisplay.textContent = phoneNumber;

  registerBtn.disabled = false;
  registerBtn.textContent = 'Continua';
}

otpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  otpErrorMsg.classList.add('hidden');
  verifyOtpBtn.disabled = true;
  verifyOtpBtn.textContent = 'Verifica in corso...';

  try {
    const code = otpInput.value.trim();
    const result = await confirmationResult.confirm(code);
    const phoneUid = result.user.uid;
    const phoneNumber = phoneInput.value.trim();

    await finalizeProfile(phoneUid, { contactType: 'phone', contactValue: phoneNumber });

    otpForm.classList.add('hidden');
    successStep.classList.remove('hidden');
    successMsg.textContent = 'Registrazione completata! Ora puoi accedere.';

    setTimeout(() => { window.location.href = 'login.html'; }, 2000);
  } catch (error) {
    console.error(error);
    otpErrorMsg.textContent = 'Codice non valido. Riprova.';
    otpErrorMsg.classList.remove('hidden');
    verifyOtpBtn.disabled = false;
    verifyOtpBtn.textContent = 'Verifica e completa registrazione';
  }
});

// Salva username (riservato), profilo utente, e carica avatar se presente
async function finalizeProfile(uid, contactInfo) {
  const { username, birthdate, bio, avatarBase64 } = pendingUserData;

  let logoUrl = '';
  if (avatarBase64) {
    const storageRef = ref(storage, `logos/${uid}.jpg`);
    await uploadString(storageRef, avatarBase64, 'data_url');
    logoUrl = await getDownloadURL(storageRef);
  }

  await setDoc(doc(db, 'usernames', username), { uid });

  await setDoc(doc(db, 'users', uid), {
    username,
    displayName: username,
    birthdate,
    bio: bio || '',
    logoUrl,
    contactType: contactInfo.contactType,
    contactValue: contactInfo.contactValue,
    createdAt: new Date().toISOString()
  });
}

function translateError(code) {
  const map = {
    'auth/email-already-in-use': 'Questa email è già registrata.',
    'auth/invalid-email': 'Email non valida.',
    'auth/weak-password': 'La password deve avere almeno 6 caratteri.',
    'auth/invalid-phone-number': 'Numero di telefono non valido (usa il formato +39...).',
    'auth/too-many-requests': 'Troppi tentativi. Riprova più tardi.'
  };
  return map[code] || 'Si è verificato un errore. Riprova.';
}