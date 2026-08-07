import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  collection, addDoc, onSnapshot, query, orderBy, limit,
  serverTimestamp, doc, getDoc, deleteDoc, updateDoc,
  arrayUnion, arrayRemove, increment
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { ref, uploadString, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";
import { compressImage, escapeHtml, formatDate } from './utils.js';

// Riferimenti DOM
const addPostBtn = document.getElementById('addPostBtn');
const postModal = document.getElementById('postModal');
const postModalTitle = document.getElementById('postModalTitle');
const closeModalBtn = document.getElementById('closeModalBtn');
const postForm = document.getElementById('postForm');
const publishBtn = document.getElementById('publishBtn');
const photoInput = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
const captionInput = document.getElementById('captionInput');
const postsGrid = document.getElementById('postsGrid');
const postsLoader = document.getElementById('postsLoader');
const logoutBtn = document.getElementById('logoutBtn');

const commentsModal = document.getElementById('commentsModal');
const closeCommentsBtn = document.getElementById('closeCommentsBtn');
const commentsList = document.getElementById('commentsList');
const commentForm = document.getElementById('commentForm');
const commentInput = document.getElementById('commentInput');

lucide.createIcons();

let currentUser = null;
let currentProfile = { displayName: '', logoUrl: '' };
let postsCache = new Map();
let editingPostId = null;
let activeCommentsPostId = null;
let unsubscribeComments = null;

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

// ===== Modale Crea/Modifica Post =====
addPostBtn.addEventListener('click', () => openCreateModal());
closeModalBtn.addEventListener('click', closeModal);
postModal.addEventListener('click', (e) => { if (e.target === postModal) closeModal(); });

function openCreateModal() {
  editingPostId = null;
  postModalTitle.textContent = 'Crea un nuovo post';
  publishBtn.textContent = 'Pubblica';
  photoInput.required = true;
  postForm.reset();
  photoPreview.classList.add('hidden');
  postModal.classList.remove('hidden');
}

function openEditModal(postId) {
  const post = postsCache.get(postId);
  if (!post) return;

  editingPostId = postId;
  postModalTitle.textContent = 'Modifica post';
  publishBtn.textContent = 'Salva modifiche';
  photoInput.required = false;
  photoInput.value = '';
  captionInput.value = post.caption || '';
  photoPreview.src = post.photoUrl;
  photoPreview.classList.remove('hidden');
  postModal.classList.remove('hidden');
}

function closeModal() {
  postModal.classList.add('hidden');
  postForm.reset();
  photoPreview.classList.add('hidden');
  editingPostId = null;
}

photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    photoPreview.src = e.target.result;
    photoPreview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

postForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const photoFile = photoInput.files[0];
  if (!editingPostId && !photoFile) return;

  publishBtn.disabled = true;
  publishBtn.textContent = editingPostId ? 'Salvataggio...' : 'Pubblicazione in corso...';

  try {
    if (editingPostId) {
      const updateData = { caption: captionInput.value.trim() };

      if (photoFile) {
        const compressed = await compressImage(photoFile);
        const photoPath = `photos/${currentUser.uid}_${Date.now()}.jpg`;
        const photoRef = ref(storage, photoPath);
        await uploadString(photoRef, compressed, 'data_url');
        updateData.photoUrl = await getDownloadURL(photoRef);
        updateData.photoPath = photoPath;

        const oldPost = postsCache.get(editingPostId);
        if (oldPost?.photoPath) {
          deleteObject(ref(storage, oldPost.photoPath)).catch(() => {});
        }
      }

      await updateDoc(doc(db, 'posts', editingPostId), updateData);
    } else {
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
        likes: [],
        commentCount: 0,
        createdAt: serverTimestamp()
      });
    }

    closeModal();
  } catch (error) {
    console.error('Errore:', error);
    alert('Si è verificato un errore. Riprova.');
  } finally {
    publishBtn.disabled = false;
    publishBtn.textContent = editingPostId ? 'Salva modifiche' : 'Pubblica';
  }
});

// ===== Lista Post =====
function startListeningToPosts() {
  const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(30));
  postsLoader.classList.remove('hidden');

  onSnapshot(postsQuery, (snapshot) => {
    postsLoader.classList.add('hidden');

    if (snapshot.empty) {
      postsGrid.innerHTML = '<p style="color:#94a3b8;">Nessun post ancora. Clicca su "+" per crearne uno!</p>';
      postsCache.clear();
      return;
    }

    postsCache.clear();

    postsGrid.innerHTML = snapshot.docs.map(docSnap => {
      const post = docSnap.data();
      const id = docSnap.id;
      postsCache.set(id, post);

      const isOwner = currentUser && post.uid === currentUser.uid;
      const likes = post.likes || [];
      const isLiked = currentUser && likes.includes(currentUser.uid);
      const commentCount = post.commentCount || 0;

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
            ${isOwner ? `
              <div class="post-menu">
                <button class="post-menu-btn" data-id="${id}">
                  <i data-lucide="more-vertical"></i>
                </button>
                <div class="post-menu-dropdown hidden" data-menu-for="${id}">
                  <button class="menu-item edit-post-btn" data-id="${id}">
                    <i data-lucide="pencil"></i> Modifica
                  </button>
                  <button class="menu-item menu-item-danger delete-post-btn" data-id="${id}" data-photopath="${post.photoPath || ''}">
                    <i data-lucide="trash-2"></i> Elimina
                  </button>
                </div>
              </div>
            ` : ''}
          </div>
          <img src="${post.photoUrl}" class="post-photo" alt="Post" loading="lazy" />
          ${post.caption ? `<p class="post-caption">${escapeHtml(post.caption)}</p>` : ''}
          <div class="post-actions">
            <button class="action-btn like-btn ${isLiked ? 'liked' : ''}" data-id="${id}">
              <i data-lucide="heart"></i>
              <span>${likes.length}</span>
            </button>
            <button class="action-btn comment-btn" data-id="${id}">
              <i data-lucide="message-circle"></i>
              <span>${commentCount}</span>
            </button>
          </div>
        </article>
      `;
    }).join('');

    lucide.createIcons();
    attachPostListeners();
  }, (error) => {
    postsLoader.classList.add('hidden');
    console.error('Errore nel caricamento dei post:', error);
    postsGrid.innerHTML = '<p style="color:#ef4444;">Errore nel caricamento dei post.</p>';
  });
}

function attachPostListeners() {
  // Menu tre puntini
  document.querySelectorAll('.post-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const dropdown = document.querySelector(`.post-menu-dropdown[data-menu-for="${id}"]`);
      closeAllMenus();
      dropdown.classList.toggle('hidden');
    });
  });

  // Modifica
  document.querySelectorAll('.edit-post-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllMenus();
      openEditModal(btn.dataset.id);
    });
  });

  // Elimina
  document.querySelectorAll('.delete-post-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      closeAllMenus();
      if (!confirm('Vuoi eliminare questo post?')) return;

      const postId = btn.dataset.id;
      const photoPath = btn.dataset.photopath;

      try {
        await deleteDoc(doc(db, 'posts', postId));
        if (photoPath) deleteObject(ref(storage, photoPath)).catch(() => {});
      } catch (error) {
        console.error('Errore durante l\'eliminazione:', error);
        alert('Errore durante l\'eliminazione del post.');
      }
    });
  });

  // Like
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!currentUser) return;
      const postId = btn.dataset.id;
      const post = postsCache.get(postId);
      const likes = post?.likes || [];
      const isLiked = likes.includes(currentUser.uid);

      try {
        await updateDoc(doc(db, 'posts', postId), {
          likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
        });
      } catch (error) {
        console.error('Errore like:', error);
      }
    });
  });

  // Commenti
  document.querySelectorAll('.comment-btn').forEach(btn => {
    btn.addEventListener('click', () => openComments(btn.dataset.id));
  });
}

function closeAllMenus() {
  document.querySelectorAll('.post-menu-dropdown').forEach(d => d.classList.add('hidden'));
}

document.addEventListener('click', closeAllMenus);

// ===== Commenti =====
function openComments(postId) {
  activeCommentsPostId = postId;
  commentsModal.classList.remove('hidden');
  commentsList.innerHTML = '<p style="color:#94a3b8; text-align:center;">Caricamento...</p>';

  const commentsQuery = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc')
  );

  unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
    if (snapshot.empty) {
      commentsList.innerHTML = '<p style="color:#94a3b8; text-align:center;">Nessun commento ancora. Scrivi il primo!</p>';
      return;
    }

    commentsList.innerHTML = snapshot.docs.map(docSnap => {
      const c = docSnap.data();
      return `
        <div class="comment-item">
          <span class="comment-author">${escapeHtml(c.authorName || 'Utente')}</span>
          <p class="comment-text">${escapeHtml(c.text || '')}</p>
        </div>
      `;
    }).join('');

    commentsList.scrollTop = commentsList.scrollHeight;
  });
}

closeCommentsBtn.addEventListener('click', closeComments);
commentsModal.addEventListener('click', (e) => { if (e.target === commentsModal) closeComments(); });

function closeComments() {
  commentsModal.classList.add('hidden');
  if (unsubscribeComments) unsubscribeComments();
  activeCommentsPostId = null;
  commentInput.value = '';
}

commentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeCommentsPostId || !currentUser) return;

  const text = commentInput.value.trim();
  if (!text) return;

  try {
    await addDoc(collection(db, 'posts', activeCommentsPostId, 'comments'), {
      uid: currentUser.uid,
      authorName: currentProfile.displayName || currentUser.email.split('@')[0],
      text,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, 'posts', activeCommentsPostId), {
      commentCount: increment(1)
    });

    commentInput.value = '';
  } catch (error) {
    console.error('Errore nell\'invio del commento:', error);
  }
});
import { collection as fsCollection, query as fsQuery, where as fsWhere, limit as fsLimit, getDocs as fsGetDocs } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const searchBarContainer = document.getElementById('searchBarContainer');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

let searchTimeout;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const term = searchInput.value.trim().toLowerCase();

  if (!term) {
    searchResults.classList.add('hidden');
    searchResults.innerHTML = '';
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      const usersQuery = fsQuery(
        fsCollection(db, 'users'),
        fsWhere('username', '>=', term),
        fsWhere('username', '<=', term + '\uf8ff'),
        fsLimit(8)
      );

      const snapshot = await fsGetDocs(usersQuery);

      if (snapshot.empty) {
        searchResults.innerHTML = '<p class="search-empty">Nessun utente trovato</p>';
      } else {
        searchResults.innerHTML = snapshot.docs.map(docSnap => {
          const u = docSnap.data();
          return `
            <div class="search-result-item">
              ${u.logoUrl
                ? `<img src="${u.logoUrl}" class="search-result-avatar" alt="${u.username}" />`
                : `<div class="search-result-avatar-placeholder"><i data-lucide="user"></i></div>`
              }
              <span>@${escapeHtml(u.username)}</span>
            </div>
          `;
        }).join('');
        lucide.createIcons();
      }

      searchResults.classList.remove('hidden');
    } catch (error) {
      console.error('Errore nella ricerca:', error);
    }
  }, 300);
});

// Chiudi risultati cliccando fuori
document.addEventListener('click', (e) => {
  if (!searchBarContainer.contains(e.target)) {
    searchResults.classList.add('hidden');
  }
});