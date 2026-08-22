import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy,
  onSnapshot, addDoc, serverTimestamp, increment, arrayUnion, arrayRemove, getDocs, limit
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { ref, uploadString, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";
import { compressImage, escapeHtml, formatDate } from './utils.js';
import { t } from './lang.js';
import { openStickerModal } from './stickers-data.js';

function renderAvatar(photoUrl, isVerified, wrapperClass = "avatar-container", imgClass = "user-avatar") {
  const avatarImage = photoUrl
    ? `<img src="${photoUrl}" class="${imgClass}" alt="Avatar" loading="lazy" />`
    : `<div class="${imgClass}-placeholder"><i data-lucide="user"></i></div>`;

  const badge = isVerified
    ? `<div class="verified-crown-badge">
         <img src="verificato.jpg" alt="Verificato" class="verified-crown-img" />
       </div>`
    : '';

  return `
    <div class="${wrapperClass}">
      ${avatarImage}
      ${badge}
    </div>
  `;
}

// Elementi DOM Profilo
const profileUsername = document.getElementById('profileUsername');
const profileBio = document.getElementById('profileBio');
const currentLogo = document.getElementById('currentLogo');
const logoPlaceholder = document.getElementById('logoPlaceholder');
const statPosts = document.getElementById('statPosts') || document.querySelector('.profile-stat:nth-child(1) .profile-stat-number') || {};
const statFollowers = document.getElementById('statFollowers') || document.querySelector('.profile-stat:nth-child(2) .profile-stat-number') || {};
const statFollowing = document.getElementById('statFollowing') || document.querySelector('.profile-stat:nth-child(3) .profile-stat-number') || {};

const editProfileBtn = document.getElementById('editProfileBtn');
const editProfileCard = document.getElementById('editProfileCard');
const editProfileForm = document.getElementById('editProfileForm');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const displayNameInput = document.getElementById('displayNameInput');
const bioEditInput = document.getElementById('bioEditInput');
const usernameEditInput = document.getElementById('usernameEditInput');
const logoInput = document.getElementById('logoInput');
const editLogoPreview = document.getElementById('editLogoPreview');
const editLogoPlaceholder = document.getElementById('editLogoPlaceholder');

const postsGrid = document.getElementById('postsGrid') || document.getElementById('profilePostsGrid');
const postsLoader = document.getElementById('postsLoader');
const logoutBtn = document.getElementById('logoutBtn');

// Modale Commenti
const commentsModal = document.getElementById('commentsModal');
const closeCommentsBtn = document.getElementById('closeCommentsBtn');
const commentsList = document.getElementById('commentsList');
const commentForm = document.getElementById('commentForm');
const commentInput = document.getElementById('commentInput');
const commentStickerBtn = document.getElementById('commentStickerBtn');
const commentsPostMedia = document.getElementById('commentsPostMedia');
const commentsPostCaption = document.getElementById('commentsPostCaption');

// Modale Modifica Post
const editPostModal = document.getElementById('editPostModal');
const closeEditPostModalBtn = document.getElementById('closeEditPostModalBtn');
const editPostForm = document.getElementById('editPostForm');
const editCaptionInput = document.getElementById('editCaptionInput');
const editLocationInput = document.getElementById('editLocationInput');

lucide.createIcons();

let currentUser = null;
let currentProfile = { displayName: '', logoUrl: '', username: '' };
let currentUsername = '';
let currentLogoUrl = '';
let userPosts = [];
let savedPostIds = new Set();
let postsCache = new Map();
let activeCommentsPostId = null;
let unsubscribeComments = null;
let editingPostId = null;

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'login.html';
  });
}

function updateAvatarDisplay(url, imgEl, placeholderEl) {
  if (!imgEl || !placeholderEl) return;
  if (url) {
    imgEl.src = url;
    imgEl.classList.remove('hidden');
    placeholderEl.classList.add('hidden');
  } else {
    imgEl.classList.add('hidden');
    placeholderEl.classList.remove('hidden');
  }
}

// Inizializzazione Auth e Caricamento Profilo
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const data = userDoc.exists() ? userDoc.data() : {};
  currentProfile = data;

  currentUsername = data.username || '';

  if (profileUsername) profileUsername.textContent = currentUsername ? `@${currentUsername}` : `@${user.email.split('@')[0]}`;
  if (profileBio) profileBio.textContent = data.bio || '';
  currentLogoUrl = data.logoUrl || '';
  updateAvatarDisplay(currentLogoUrl, currentLogo, logoPlaceholder);

  // Badge Verificato
  if (currentLogo && currentLogo.parentElement) {
    const profileAvatarContainer = currentLogo.parentElement;
    let existingBadge = profileAvatarContainer.querySelector('.verified-crown-badge');

    if (data.isVerified || currentUsername === 'elisabel_messa') {
      if (!existingBadge) {
        const badgeEl = document.createElement('div');
        badgeEl.className = 'verified-crown-badge';
        badgeEl.innerHTML = `<img src="verificato.jpg" alt="Verificato" class="verified-crown-img" />`;
        profileAvatarContainer.style.position = 'relative';
        profileAvatarContainer.appendChild(badgeEl);
      }
    } else if (existingBadge) {
      existingBadge.remove();
    }
  }

  if (statFollowers) statFollowers.textContent = (data.followers || []).length;
  if (statFollowing) statFollowing.textContent = (data.following || []).length;

  if (displayNameInput) displayNameInput.value = data.displayName || currentUsername || user.email.split('@')[0];
  if (bioEditInput) bioEditInput.value = data.bio || '';
  if (usernameEditInput) usernameEditInput.value = currentUsername;
  updateAvatarDisplay(currentLogoUrl, editLogoPreview, editLogoPlaceholder);

  await loadSavedPosts();
  startListeningToUserPosts(user.uid);
});

// Salvataggi
async function loadSavedPosts() {
  if (!currentUser) return;
  const myDoc = await getDoc(doc(db, 'users', currentUser.uid));
  const data = myDoc.exists() ? myDoc.data() : {};
  savedPostIds = new Set(data.savedPosts || []);
}

function getPostMedia(post) {
  if (post.media && post.media.length > 0) return post.media;
  if (post.photoUrl) return [{ type: 'photo', url: post.photoUrl, path: post.photoPath || '' }];
  return [];
}

// Caricamento Post dell'utente
function startListeningToUserPosts(uid) {
  const postsQuery = query(
    collection(db, 'posts'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc')
  );

  if (postsLoader) postsLoader.classList.remove('hidden');

  onSnapshot(postsQuery, (snapshot) => {
    if (postsLoader) postsLoader.classList.add('hidden');
    if (!postsGrid) return;

    if (statPosts) statPosts.textContent = snapshot.docs.length;

    if (snapshot.empty) {
      postsGrid.innerHTML = '<p class="search-empty" style="grid-column: 1 / -1; text-align:center; padding: 40px 0; color:#94a3b8;">Non hai ancora pubblicato nessun post.</p>';
      postsCache.clear();
      return;
    }

    postsCache.clear();

    postsGrid.innerHTML = snapshot.docs.map(docSnap => {
      const post = docSnap.data();
      const id = docSnap.id;
      postsCache.set(id, post);

      const media = getPostMedia(post);
      const firstMedia = media[0];
      const likes = post.likes || [];
      const commentCount = post.commentCount || 0;

      return `
        <div class="profile-post-card" data-id="${id}">
          ${firstMedia && firstMedia.type === 'video'
            ? `<video src="${firstMedia.url}" class="profile-post-thumb"></video>`
            : `<img src="${firstMedia ? firstMedia.url : ''}" class="profile-post-thumb" alt="Post" loading="lazy" />`
          }
          <div class="profile-post-overlay">
            <span><i data-lucide="heart"></i> ${likes.length}</span>
            <span><i data-lucide="message-circle"></i> ${commentCount}</span>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();

    document.querySelectorAll('.profile-post-card').forEach(card => {
      card.addEventListener('click', () => {
        openComments(card.dataset.id);
      });
    });
  }, (error) => {
    if (postsLoader) postsLoader.classList.add('hidden');
    console.error("Errore caricamento post profilo:", error);
  });
}

// Modale Commenti e Sticker
function openComments(postId) {
  activeCommentsPostId = postId;
  if (commentsModal) commentsModal.classList.remove('hidden');

  const post = postsCache.get(postId);
  if (post) {
    const media = getPostMedia(post);
    if (commentsPostMedia) {
      commentsPostMedia.innerHTML = media[0]?.type === 'video'
        ? `<video src="${media[0].url}" controls style="width:100%; border-radius:12px; max-height:360px; object-fit:contain;"></video>`
        : `<img src="${media[0]?.url || ''}" style="width:100%; border-radius:12px; max-height:360px; object-fit:contain;" alt="" />`;
    }
    if (commentsPostCaption) {
      commentsPostCaption.textContent = post.caption || '';
      commentsPostCaption.classList.toggle('hidden', !post.caption);
    }
  }

  if (commentsList) commentsList.innerHTML = '<p style="color:#94a3b8; text-align:center;">Caricamento...</p>';

  const commentsQuery = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc')
  );

  unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
    if (!commentsList) return;
    if (snapshot.empty) {
      commentsList.innerHTML = '<p style="color:#94a3b8; text-align:center;">Nessun commento ancora. Scrivi il primo!</p>';
      return;
    }

    commentsList.innerHTML = snapshot.docs.map(docSnap => {
      const c = docSnap.data();
      const commentId = docSnap.id;
      const isSticker = c.type === 'sticker';
      const isVerified = c.isVerified === true || c.authorName === 'elisabel_messa';
      
      const avatarPhoto = (c.uid === currentUser?.uid)
        ? (currentProfile.logoUrl || currentUser?.photoURL || c.userPhoto || '')
        : (c.userPhoto || '');
        
      const canDelete = currentUser && (c.uid === currentUser.uid || (post && post.uid === currentUser.uid));

      let bodyHtml;
      if (isSticker) {
        bodyHtml = `<img src="${c.sticker}" class="comment-sticker-media" alt="sticker" />`;
      } else {
        bodyHtml = `<p class="comment-text">${escapeHtml(c.text || '')}</p>`;
      }

      return `
        <div class="comment-row ${isSticker ? 'is-sticker' : ''}" data-comment-id="${commentId}">
          ${renderAvatar(avatarPhoto, isVerified, "comment-avatar-wrap", "comment-avatar-img")}
          <div class="comment-bubble">
            <div class="comment-bubble-header">
              <a href="user.html?u=${encodeURIComponent(c.authorName || '')}" class="comment-author-name">
                @${escapeHtml(c.authorName || 'utente')}
              </a>
              ${canDelete ? `
                <button type="button" class="delete-comment-btn" data-comment-id="${commentId}" title="Elimina commento">
                  <i data-lucide="trash-2"></i>
                </button>
              ` : ''}
            </div>
            ${bodyHtml}
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
    attachDeleteCommentListeners(postId);
    commentsList.scrollTop = commentsList.scrollHeight;
  });
}

function closeComments() {
  if (commentsModal) commentsModal.classList.add('hidden');
  if (unsubscribeComments) unsubscribeComments();
  activeCommentsPostId = null;
  if (commentInput) commentInput.value = '';
}

if (closeCommentsBtn) closeCommentsBtn.addEventListener('click', closeComments);
if (commentsModal) {
  commentsModal.addEventListener('click', (e) => { if (e.target === commentsModal) closeComments(); });
}

// Invio commento testo
if (commentForm) {
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeCommentsPostId || !currentUser) return;

    const text = commentInput.value.trim();
    if (!text) return;

    const authorName = currentProfile.username || currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'utente');
    const userPhoto = currentProfile.logoUrl || currentUser.photoURL || '';

    try {
      await addDoc(collection(db, 'posts', activeCommentsPostId, 'comments'), {
        uid: currentUser.uid,
        authorName: authorName,
        userPhoto: userPhoto,
        isVerified: authorName === 'elisabel_messa',
        type: 'text',
        text: text,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'posts', activeCommentsPostId), {
        commentCount: increment(1)
      });

      commentInput.value = '';
    } catch (error) {
      console.error("Errore invio commento:", error);
    }
  });
}

// Invio Sticker
async function sendCommentSticker(postId, stickerUrl) {
  if (!postId || !currentUser) return;

  const authorName = currentProfile.username || currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'utente');
  const userPhoto = currentProfile.logoUrl || currentUser.photoURL || '';

  try {
    await addDoc(collection(db, 'posts', postId, 'comments'), {
      uid: currentUser.uid,
      authorName: authorName,
      userPhoto: userPhoto,
      isVerified: authorName === 'elisabel_messa',
      type: 'sticker',
      sticker: stickerUrl,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, 'posts', postId), {
      commentCount: increment(1)
    });
  } catch (error) {
    console.error("Errore invio sticker:", error);
  }
}

// Click sull'icona sticker nei commenti del profilo
if (commentStickerBtn) {
  commentStickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activeCommentsPostId) return;

    openStickerModal(commentStickerBtn, (selectedUrl) => {
      sendCommentSticker(activeCommentsPostId, selectedUrl);
    });
  });
}

// Eliminazione commenti
function attachDeleteCommentListeners(postId) {
  document.querySelectorAll('.delete-comment-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const commentId = btn.dataset.commentId;
      if (!confirm('Vuoi davvero eliminare questo commento?')) return;

      try {
        await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
        await updateDoc(doc(db, 'posts', postId), {
          commentCount: increment(-1)
        });
      } catch (error) {
        console.error('Errore durante l\'eliminazione del commento:', error);
      }
    });
  });
}

// Modifica Profilo
if (editProfileBtn) {
  editProfileBtn.addEventListener('click', () => {
    if (editProfileCard) editProfileCard.classList.toggle('hidden');
  });
}
if (cancelEditBtn) {
  cancelEditBtn.addEventListener('click', () => {
    if (editProfileCard) editProfileCard.classList.add('hidden');
  });
}

if (logoInput) {
  logoInput.addEventListener('change', async () => {
    const file = logoInput.files[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 400, 0.8);
      updateAvatarDisplay(compressed, editLogoPreview, editLogoPlaceholder);
      currentLogoUrl = compressed;
    } catch (err) {
      console.error("Errore anteprima foto profilo:", err);
    }
  });
}

if (editProfileForm) {
  editProfileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const newDisplayName = displayNameInput ? displayNameInput.value.trim() : '';
    const newBio = bioEditInput ? bioEditInput.value.trim() : '';
    const newUsername = usernameEditInput ? usernameEditInput.value.trim().toLowerCase() : currentUsername;

    try {
      let finalPhotoUrl = currentProfile.logoUrl || '';

      if (logoInput && logoInput.files[0]) {
        const file = logoInput.files[0];
        const compressed = await compressImage(file, 400, 0.8);
        const photoPath = `profile_photos/${currentUser.uid}_${Date.now()}.jpg`;
        const storageRef = ref(storage, photoPath);
        await uploadString(storageRef, compressed, 'data_url');
        finalPhotoUrl = await getDownloadURL(storageRef);
      }

      await updateDoc(doc(db, 'users', currentUser.uid), {
        displayName: newDisplayName,
        bio: newBio,
        username: newUsername,
        logoUrl: finalPhotoUrl
      });

      currentProfile.displayName = newDisplayName;
      currentProfile.bio = newBio;
      currentProfile.username = newUsername;
      currentProfile.logoUrl = finalPhotoUrl;

      if (profileUsername) profileUsername.textContent = `@${newUsername}`;
      if (profileBio) profileBio.textContent = newBio;
      updateAvatarDisplay(finalPhotoUrl, currentLogo, logoPlaceholder);

      if (editProfileCard) editProfileCard.classList.add('hidden');
      alert('Profilo aggiornato con successo!');
    } catch (error) {
      console.error("Errore aggiornamento profilo:", error);
      alert('Si è verificato un errore durante il salvataggio.');
    }
  });
}