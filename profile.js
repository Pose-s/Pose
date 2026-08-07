import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  doc, getDoc, setDoc, collection, query, where, orderBy,
  onSnapshot, deleteDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { ref, uploadString, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";
import { compressImage, escapeHtml, formatDate } from './utils.js';

lucide.createIcons();

// ===== Riferimenti header profilo =====
const profileUsername = document.getElementById('profileUsername');
const currentLogo = document.getElementById('currentLogo');
const logoPlaceholder = document.getElementById('logoPlaceholder');
const statPosts = document.getElementById('statPosts');
const statFollowers = document.getElementById('statFollowers');
const statFollowing = document.getElementById('statFollowing');
const profileBio = document.getElementById('profileBio');

// ===== Riferimenti form modifica profilo =====
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

// ===== Riferimenti sezione post del profilo =====
const profilePostsGrid = document.getElementById('profilePostsGrid');
const profilePostsLoader = document.getElementById('profilePostsLoader');

// ===== Riferimenti modale modifica post =====
const postModal = document.getElementById('postModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const postForm = document.getElementById('postForm');
const publishBtn = document.getElementById('publishBtn');
const photoInput = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
const captionInput = document.getElementById('captionInput');

let currentUser = null;
let currentLogoUrl = '';
let postsCacheProfile = new Map();
let editingPostId = null;

// ===== Autenticazione e caricamento profilo =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;
  startListeningToOwnPosts(user.uid);

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const data = userDoc.exists() ? userDoc.data() : {};

  // Header
  profileUsername.textContent = data.username ? `@${data.username}` : `@${user.email.split('@')[0]}`;
  profileBio.textContent = data.bio || '';
  currentLogoUrl = data.logoUrl || '';
  updateAvatarDisplay(currentLogoUrl, currentLogo, logoPlaceholder);

  // Statistiche follower/seguiti
  statFollowers.textContent = (data.followers || []).length;
  statFollowing.textContent = (data.following || []).length;

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

// ===== Toggle form di modifica profilo =====
editProfileToggleBtn.addEventListener('click', () => {
  editProfileCard.classList.toggle('hidden');
});

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

// ===== Modale modifica post =====
closeModalBtn.addEventListener('click', closeModal);
postModal.addEventListener('click', (e) => { if (e.target === postModal) closeModal(); });

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

function openEditModal(postId) {
  const post = postsCacheProfile.get(postId);
  if (!post) return;

  editingPostId = postId;
  captionInput.value = post.caption || '';
  photoPreview.src = post.photoUrl;
  photoPreview.classList.remove('hidden');
  photoInput.value = '';
  postModal.classList.remove('hidden');
}

postForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!editingPostId) return;

  publishBtn.disabled = true;
  publishBtn.textContent = 'Salvataggio...';

  try {
    const updateData = { caption: captionInput.value.trim() };
    const photoFile = photoInput.files[0];

    if (photoFile) {
      const compressed = await compressImage(photoFile);
      const photoPath = `photos/${currentUser.uid}_${Date.now()}.jpg`;
      const photoRef = ref(storage, photoPath);
      await uploadString(photoRef, compressed, 'data_url');
      updateData.photoUrl = await getDownloadURL(photoRef);
      updateData.photoPath = photoPath;

      const oldPost = postsCacheProfile.get(editingPostId);
      if (oldPost?.photoPath) deleteObject(ref(storage, oldPost.photoPath)).catch(() => {});
    }

    await updateDoc(doc(db, 'posts', editingPostId), updateData);
    closeModal();
  } catch (error) {
    console.error(error);
    alert('Errore durante il salvataggio. Riprova.');
  } finally {
    publishBtn.disabled = false;
    publishBtn.textContent = 'Salva modifiche';
  }
});

// ===== Lista post del profilo =====
function startListeningToOwnPosts(uid) {
  const postsQuery = query(
    collection(db, 'posts'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc')
  );

  profilePostsLoader.classList.remove('hidden');

  onSnapshot(postsQuery, (snapshot) => {
    profilePostsLoader.classList.add('hidden');
    postsCacheProfile.clear();

    statPosts.textContent = snapshot.size;

    if (snapshot.empty) {
      profilePostsGrid.innerHTML = '<p style="color:#94a3b8;">Non hai ancora pubblicato nessun post.</p>';
      return;
    }

    profilePostsGrid.innerHTML = snapshot.docs.map(docSnap => {
      const post = docSnap.data();
      const id = docSnap.id;
      postsCacheProfile.set(id, post);

      return `
        <article class="post-card">
          <div class="post-header">
            <span class="post-date">${formatDate(post.createdAt)}</span>
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
          </div>
          <img src="${post.photoUrl}" class="post-photo" alt="Post" loading="lazy" />
          ${post.caption ? `<p class="post-caption">${escapeHtml(post.caption)}</p>` : ''}
        </article>
      `;
    }).join('');

    lucide.createIcons();
    attachProfilePostListeners();
  }, (error) => {
    profilePostsLoader.classList.add('hidden');
    console.error('Errore nel caricamento dei post:', error);
    profilePostsGrid.innerHTML = '<p style="color:#ef4444;">Errore nel caricamento dei post.</p>';
  });
}

function attachProfilePostListeners() {
  document.querySelectorAll('#profilePostsGrid .post-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const dropdown = document.querySelector(`.post-menu-dropdown[data-menu-for="${id}"]`);
      closeAllProfileMenus();
      dropdown.classList.toggle('hidden');
    });
  });

  document.querySelectorAll('#profilePostsGrid .edit-post-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllProfileMenus();
      openEditModal(btn.dataset.id);
    });
  });

  document.querySelectorAll('#profilePostsGrid .delete-post-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      closeAllProfileMenus();
      if (!confirm('Vuoi eliminare questo post?')) return;

      const postId = btn.dataset.id;
      const photoPath = btn.dataset.photopath;

      try {
        await deleteDoc(doc(db, 'posts', postId));
        if (photoPath) deleteObject(ref(storage, photoPath)).catch(() => {});
      } catch (error) {
        console.error(error);
        alert('Errore durante l\'eliminazione del post.');
      }
    });
  });
}

function closeAllProfileMenus() {
  document.querySelectorAll('#profilePostsGrid .post-menu-dropdown').forEach(d => d.classList.add('hidden'));
}

document.addEventListener('click', closeAllProfileMenus);