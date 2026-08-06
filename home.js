// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadString,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";

// Configurazione Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD5nn41jQU8Vk_ujlTO5t4r125zyq4p1z0",
  authDomain: "pose-s.firebaseapp.com",
  projectId: "pose-s",
  storageBucket: "pose-s.firebasestorage.app",
  messagingSenderId: "293624221790",
  appId: "1:293624221790:web:873913cf322c08610464cf",
  measurementId: "G-J836C70BTW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Riferimenti DOM
const addPostBtn = document.getElementById('addPostBtn');
const postModal = document.getElementById('postModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const postForm = document.getElementById('postForm');
const publishBtn = document.getElementById('publishBtn');

const logoInput = document.getElementById('logoInput');
const logoPreview = document.getElementById('logoPreview');
const photoInput = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
const captionInput = document.getElementById('captionInput');

const postsGrid = document.getElementById('postsGrid');
const postsLoader = document.getElementById('postsLoader');

// Inizializza icone Lucide
lucide.createIcons();

// Apri / chiudi modale
addPostBtn.addEventListener('click', () => {
  postModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', closeModal);
postModal.addEventListener('click', (e) => {
  if (e.target === postModal) closeModal();
});

function closeModal() {
  postModal.classList.add('hidden');
  postForm.reset();
  logoPreview.classList.add('hidden');
  photoPreview.classList.add('hidden');
}

// Anteprima immagini caricate
logoInput.addEventListener('change', () => previewImage(logoInput, logoPreview));
photoInput.addEventListener('change', () => previewImage(photoInput, photoPreview));

function previewImage(input, previewEl) {
  const file = input.files[0];
  if (!file) {
    previewEl.classList.add('hidden');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    previewEl.src = e.target.result;
    previewEl.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

// Converte un file in base64 (data URL)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Carica un'immagine su Firebase Storage e restituisce l'URL pubblico
async function uploadImage(file, folder) {
  if (!file) return '';
  const base64 = await fileToBase64(file);
  const fileName = `${folder}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, fileName);
  await uploadString(storageRef, base64, 'data_url');
  return await getDownloadURL(storageRef);
}

// Invio form
postForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const logoFile = logoInput.files[0];
  const photoFile = photoInput.files[0];

  if (!photoFile) return;

  publishBtn.disabled = true;
  publishBtn.textContent = 'Pubblicazione in corso...';

  try {
    const logoUrl = await uploadImage(logoFile, 'logos');
    const photoUrl = await uploadImage(photoFile, 'photos');

    await addDoc(collection(db, 'posts'), {
      logoUrl,
      photoUrl,
      caption: captionInput.value.trim(),
      createdAt: serverTimestamp()
    });

    closeModal();
  } catch (error) {
    console.error('Errore durante la pubblicazione:', error);
    alert('Errore durante la pubblicazione del post. Riprova.');
  } finally {
    publishBtn.disabled = false;
    publishBtn.textContent = 'Pubblica';
  }
});

// Ascolto in tempo reale dei post (tutti gli utenti vedono gli stessi post)
const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));

postsLoader.classList.remove('hidden');

onSnapshot(postsQuery, (snapshot) => {
  postsLoader.classList.add('hidden');

  if (snapshot.empty) {
    postsGrid.innerHTML = '<p style="color:#94a3b8;">Nessun post ancora. Clicca su "+" per crearne uno!</p>';
    return;
  }

  postsGrid.innerHTML = snapshot.docs.map(doc => {
    const post = doc.data();
    return `
      <article class="post-card">
        <div class="post-header">
          ${post.logoUrl 
            ? `<img src="${post.logoUrl}" class="post-logo" alt="Logo" />` 
            : `<div class="post-logo-placeholder"><i data-lucide="user"></i></div>`
          }
          <span class="post-date">${formatDate(post.createdAt)}</span>
        </div>
        <img src="${post.photoUrl}" class="post-photo" alt="Post" />
        ${post.caption ? `<p class="post-caption">${escapeHtml(post.caption)}</p>` : ''}
      </article>
    `;
  }).join('');

  lucide.createIcons();
}, (error) => {
  postsLoader.classList.add('hidden');
  console.error('Errore nel caricamento dei post:', error);
  postsGrid.innerHTML = '<p style="color:#ef4444;">Errore nel caricamento dei post.</p>';
});

function formatDate(timestamp) {
  if (!timestamp) return 'Ora';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}