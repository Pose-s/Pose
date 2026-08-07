import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";
import { compressImage } from './utils.js';

lucide.createIcons();

const currentLogo = document.getElementById('currentLogo');
const logoPlaceholder = document.getElementById('logoPlaceholder');
const avatarUploadBtn = document.getElementById('avatarUploadBtn');
const newLogoInput = document.getElementById('newLogoInput');
const displayNameInput = document.getElementById('displayNameInput');
const profileForm = document.getElementById('profileForm');
const profileMsg = document.getElementById('profileMsg');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const logoutBtn = document.getElementById('logoutBtn');

let currentUser = null;
let currentLogoUrl = '';

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const data = userDoc.exists() ? userDoc.data() : {};

  displayNameInput.value = data.displayName || user.email.split('@')[0];
  currentLogoUrl = data.logoUrl || '';

  updateAvatarPreview(currentLogoUrl);
});

function updateAvatarPreview(url) {
  if (url) {
    currentLogo.src = url;
    currentLogo.classList.remove('hidden');
    logoPlaceholder.classList.add('hidden');
  } else {
    currentLogo.classList.add('hidden');
    logoPlaceholder.classList.remove('hidden');
  }
}

// Cliccando sull'avatar si apre il selettore file
avatarUploadBtn.addEventListener('click', () => {
  newLogoInput.click();
});

// Anteprima immediata dopo la scelta del file
newLogoInput.addEventListener('change', () => {
  const file = newLogoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => updateAvatarPreview(e.target.result);
  reader.readAsDataURL(file);
});

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'login.html';
});

profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  profileMsg.classList.add('hidden');
  saveProfileBtn.disabled = true;
  saveProfileBtn.textContent = 'Salvataggio...';

  try {
    let logoUrl = currentLogoUrl;
    const file = newLogoInput.files[0];

    if (file) {
      const compressed = await compressImage(file, 400, 0.8);
      const storageRef = ref(storage, `logos/${currentUser.uid}.jpg`);
      await uploadString(storageRef, compressed, 'data_url');
      logoUrl = await getDownloadURL(storageRef);
    }

    await setDoc(doc(db, 'users', currentUser.uid), {
      displayName: displayNameInput.value.trim(),
      logoUrl
    });

    currentLogoUrl = logoUrl;
    profileMsg.textContent = 'Profilo aggiornato con successo!';
    profileMsg.classList.remove('hidden', 'auth-error');
    profileMsg.classList.add('auth-success');
  } catch (error) {
    console.error(error);
    profileMsg.textContent = 'Errore durante il salvataggio. Riprova.';
    profileMsg.classList.remove('hidden');
  } finally {
    saveProfileBtn.disabled = false;
    saveProfileBtn.textContent = 'Salva modifiche';
  }
});