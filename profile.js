import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";
import { compressImage, escapeHtml } from './utils.js';

lucide.createIcons();

// Riferimenti header profilo
const profileUsername = document.getElementById('profileUsername');
const currentLogo = document.getElementById('currentLogo');
const logoPlaceholder = document.getElementById('logoPlaceholder');
const statPosts = document.getElementById('statPosts');
const statFollowers = document.getElementById('statFollowers');
const statFollowing = document.getElementById('statFollowing');
const profileBio = document.getElementById('profileBio');

// Riferimenti form modifica
const editProfileToggleBtn = document.getElementById('editProfileToggleBtn');
const editProfileCard = document.getElementById('editProfileCard');
const editLogoPreview = document.getElementById('editLogoPreview');
const editLogoPlaceholder = document.getElementById('editLogoPlaceholder');
const avatarUploadBtn = document.getElementById('avatarUploadBtn');
const newLogoInput = document.getElementById('newLogoInput');
const displayNameInput = document.getElementById('displayNameInput');
const bioEditInput = document.getElementById('bioEditInput');
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

  // Header
  profileUsername.textContent = data.username ? `@${data.username}` : `@${user.email.split('@')[0]}`;
  profileBio.textContent = data.bio || '';
  currentLogoUrl = data.logoUrl || '';
  updateAvatarDisplay(currentLogoUrl, currentLogo, logoPlaceholder);

  // Statistiche
  statFollowers.textContent = (data.followers || []).length;
  statFollowing.textContent = (data.following || []).length;

  const postsQuery = query(collection(db, 'posts'), where('uid', '==', user.uid));
  const postsSnap = await getDocs(postsQuery);
  statPosts.textContent = postsSnap.size;

  // Precompila form di modifica
  displayNameInput.value = data.displayName || data.username || user.email.split('@')[0];
  bioEditInput.value = data.bio || '';
  updateAvatarDisplay(currentLogoUrl, editLogoPreview, editLogoPlaceholder);
});

function updateAvatarDisplay(url, imgEl, placeholderEl) {
  if (url) {
    imgEl.src = url;
    imgEl.classList.remove('hidden');
    placeholderEl.classList.add('hidden');
  } else {
    imgEl.classList.add('hidden');
    placeholderEl.classList.remove('hidden');
  }
}

// Toggle form di modifica
editProfileToggleBtn.addEventListener('click', () => {
  editProfileCard.classList.toggle('hidden');
});

// Upload avatar dal form di modifica
avatarUploadBtn.addEventListener('click', () => newLogoInput.click());

newLogoInput.addEventListener('change', () => {
  const file = newLogoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => updateAvatarDisplay(e.target.result, editLogoPreview, editLogoPlaceholder);
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

    const bio = bioEditInput.value.trim();

    await setDoc(doc(db, 'users', currentUser.uid), {
      displayName: displayNameInput.value.trim(),
      bio,
      logoUrl
    }, { merge: true });

    currentLogoUrl = logoUrl;
    profileBio.textContent = bio;
    updateAvatarDisplay(logoUrl, currentLogo, logoPlaceholder);

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