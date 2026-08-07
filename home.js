import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  collection, addDoc, onSnapshot, query, orderBy, limit,
  serverTimestamp, doc, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { ref, uploadString, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";
import { compressImage, escapeHtml, formatDate } from './utils.js';

const addPostBtn = document.getElementById('addPostBtn');
const postModal = document.getElementById('postModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const postForm = document.getElementById('postForm');
const publishBtn = document.getElementById('publishBtn');
const photoInput = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
const captionInput = document.getElementById('captionInput');
const postsGrid = document.getElementById('postsGrid');
const postsLoader = document.getElementById('postsLoader');
const logoutBtn = document.getElementById('logoutBtn');

lucide.createIcons();

let currentUser = null;
let currentProfile = { displayName: '', logoUrl: '' };

// Protezione pagina: serve login
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (userDoc.exists()) currentProfile = userDoc.data();

  startListeningToPosts();
});

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'login.html';
});

addPostBtn.addEventListener('click', () => postModal.classList.remove('hidden'));
closeModalBtn.addEventListener('click', closeModal);
postModal.addEventListener('click', (e) => { if (e.target === postModal) closeModal(); });

function closeModal() {
  postModal.classList.add('hidden');
  postForm.reset();
  photoPreview.classList.add('hidden');
}

photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  if (!file) { photoPreview.classList.add('hidden'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    photoPreview.src = e.target.result;
    photoPreview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

postForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const photoFile = photoInput.files[0];
  if (!photoFile || !currentUser) return;

  publishBtn.disabled = true;
  publishBtn.textContent = 'Pubblicazione in corso...';

  try {
    const compressed = await compressImage(photoFile);
    const photoPath = `photos/${currentUser.uid}_${Date.now()}.jpg`;
    const photoRef = ref(storage, photoPath);
    await uploadString(photoRef, compressed, 'data_url');
    const photoUrl = await getDownloadURL(photoRef);

    await addDoc(collection(db, 'posts'), {
      uid: currentUser.uid,
      authorName: currentProfile.displayName || currentUser.email.split('@')[0],
      logoUrl: currentProfile.logoUrl || '',
      photoUrl,
      photoPath,
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

function startListeningToPosts() {
  const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(30));
  postsLoader.classList.remove('hidden');

  onSnapshot(postsQuery, (snapshot) => {
    postsLoader.classList.add('hidden');

    if (snapshot.empty) {
      postsGrid.innerHTML = '<p style="color:#94a3b8;">Nessun post ancora. Clicca su "+" per crearne uno!</p>';
      return;
    }

    postsGrid.innerHTML = snapshot.docs.map(docSnap => {
      const post = docSnap.data();
      const isOwner = currentUser && post.uid === currentUser.uid;

      return `
        <article class="post-card">
          <div class="post-header">
            ${post.logoUrl
              ? `<img src="${post.logoUrl}" class="post-logo" alt="Logo" loading="lazy" />`
              : `<div class="post-logo-placeholder"><i data-lucide="user"></i></div>`
            }
            <div class="post-header-info">
              <span class="post-author">${escapeHtml(post.authorName || 'Utente')}</span>
              <span class="post-date">${formatDate(post.createdAt)}</span>
            </div>
            ${isOwner ? `<button class="delete-post-btn" data-id="${docSnap.id}" data-photopath="${post.photoPath || ''}"><i data-lucide="trash-2"></i></button>` : ''}
          </div>
          <img src="${post.photoUrl}" class="post-photo" alt="Post" loading="lazy" />
          ${post.caption ? `<p class="post-caption">${escapeHtml(post.caption)}</p>` : ''}
        </article>
      `;
    }).join('');

    lucide.createIcons();
    attachDeleteListeners();
  }, (error) => {
    postsLoader.classList.add('hidden');
    console.error('Errore nel caricamento dei post:', error);
    postsGrid.innerHTML = '<p style="color:#ef4444;">Errore nel caricamento dei post.</p>';
  });
}

function attachDeleteListeners() {
  document.querySelectorAll('.delete-post-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Vuoi eliminare questo post?')) return;

      const postId = btn.dataset.id;
      const photoPath = btn.dataset.photopath;

      try {
        await deleteDoc(doc(db, 'posts', postId));
        if (photoPath) {
          await deleteObject(ref(storage, photoPath)).catch(() => {});
        }
      } catch (error) {
        console.error('Errore durante l\'eliminazione:', error);
        alert('Errore durante l\'eliminazione del post.');
      }
    });
  });
}