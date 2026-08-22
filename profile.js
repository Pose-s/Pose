import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  doc, getDoc, setDoc, collection, query, where, orderBy,
  onSnapshot, deleteDoc, updateDoc, addDoc, serverTimestamp,
  increment, arrayUnion, arrayRemove, limit, getDocs
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

// Elementi DOM
const locationInput = document.getElementById('locationInput');
const profileUsername = document.getElementById('profileUsername');
const profileBio = document.getElementById('profileBio');
const currentLogo = document.getElementById('currentLogo');
const logoPlaceholder = document.getElementById('logoPlaceholder');
const statPosts = document.getElementById('statPosts') || document.querySelector('.profile-stat:nth-child(1) .profile-stat-number');
const statFollowers = document.getElementById('statFollowers') || document.querySelector('.profile-stat:nth-child(2) .profile-stat-number');
const statFollowing = document.getElementById('statFollowing') || document.querySelector('.profile-stat:nth-child(3) .profile-stat-number');

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

const postsList = document.getElementById('postsList') || document.getElementById('postsGrid');
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

// Inizializzazione Profilo
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
  startListeningToPosts(user.uid);
});

// Salvataggi
async function loadSavedPosts() {
  if (!currentUser) return;
  const myDoc = await getDoc(doc(db, 'users', currentUser.uid));
  const data = myDoc.exists() ? myDoc.data() : {};
  savedPostIds = new Set(data.savedPosts || []);
}

function attachSaveListeners(scopeSelector) {
  document.querySelectorAll(`${scopeSelector} .save-btn`).forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const postId = btn.dataset.id;
      const isSaved = savedPostIds.has(postId);

      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          savedPosts: isSaved ? arrayRemove(postId) : arrayUnion(postId)
        });
        if (isSaved) {
          savedPostIds.delete(postId);
          btn.innerHTML = `<i data-lucide="bookmark"></i>`;
        } else {
          savedPostIds.add(postId);
          btn.innerHTML = `<i data-lucide="bookmark" style="fill:currentColor;"></i>`;
        }
        lucide.createIcons();
      } catch (err) {
        console.error("Errore salvataggio post:", err);
      }
    });
  });
}

function getPostMedia(post) {
  if (post.media && post.media.length > 0) return post.media;
  if (post.photoUrl) return [{ type: 'photo', url: post.photoUrl, path: post.photoPath || '' }];
  return [];
}

// Rendering Card dei Post
function renderPostCard(post, id) {
  const isOwner = currentUser && post.uid === currentUser.uid;
  const isLiked = currentUser && (post.likes || []).includes(currentUser.uid);
  const likesCount = (post.likes || []).length;
  const commentCount = post.commentCount || 0;
  const isSaved = savedPostIds.has(id);
  const media = getPostMedia(post);

  let mediaHtml = '';
  if (media.length === 1) {
    const m = media[0];
    mediaHtml = m.type === 'video'
      ? `<video src="${m.url}" controls playsinline class="post-image single-media"></video>`
      : `<img src="${m.url}" alt="Post image" class="post-image single-media" loading="lazy" />`;
  } else if (media.length > 1) {
    const slides = media.map(m =>
      m.type === 'video'
        ? `<div class="carousel-slide"><video src="${m.url}" controls playsinline class="post-image"></video></div>`
        : `<div class="carousel-slide"><img src="${m.url}" alt="Post image" class="post-image" loading="lazy" /></div>`
    ).join('');
    const dots = media.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}"></span>`).join('');

    mediaHtml = `
      <div class="carousel-container" data-carousel-id="${id}">
        <div class="carousel-track">${slides}</div>
        <button type="button" class="carousel-btn prev hidden" aria-label="Precedente"><i data-lucide="chevron-left"></i></button>
        <button type="button" class="carousel-btn next" aria-label="Successivo"><i data-lucide="chevron-right"></i></button>
        <div class="carousel-dots">${dots}</div>
      </div>
    `;
  }

  return `
    <article class="post-card" data-id="${id}">
      <div class="post-header">
        ${renderAvatar(post.authorPhoto || '', post.isVerified || post.authorName === 'elisabel_messa', "post-avatar-wrap", "post-avatar-img")}
        <div class="post-user-info">
          <div class="post-user-row">
            <span class="post-author-name">@${escapeHtml(post.authorName || 'utente')}</span>
            <span class="post-date-separator">•</span>
            <span class="post-date">${post.createdAt ? formatDate(post.createdAt.toDate()) : ''}</span>
          </div>
          ${post.location ? `<span class="post-location"><i data-lucide="map-pin"></i> ${escapeHtml(post.location)}</span>` : ''}
        </div>
        ${isOwner ? `
          <div class="post-menu-wrap">
            <button type="button" class="post-menu-btn" title="Opzioni"><i data-lucide="more-vertical"></i></button>
            <div class="post-menu-dropdown hidden">
              <button type="button" class="post-menu-item edit-post-btn" data-id="${id}"><i data-lucide="edit-3"></i> Modifica</button>
              <button type="button" class="post-menu-item delete-post-btn" data-id="${id}"><i data-lucide="trash-2"></i> Elimina</button>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="post-media-area">${mediaHtml}</div>

      <div class="post-actions">
        <div class="post-actions-left">
          <button type="button" class="action-btn like-btn ${isLiked ? 'liked' : ''}" data-id="${id}">
            <i data-lucide="heart" ${isLiked ? 'style="fill:#ef4444; color:#ef4444;"' : ''}></i>
            <span class="like-count">${likesCount}</span>
          </button>
          <button type="button" class="action-btn comment-btn" data-id="${id}">
            <i data-lucide="message-circle"></i>
            <span class="comment-count">${commentCount}</span>
          </button>
        </div>
        <button type="button" class="action-btn save-btn ${isSaved ? 'saved' : ''}" data-id="${id}">
          <i data-lucide="bookmark" ${isSaved ? 'style="fill:currentColor;"' : ''}></i>
        </button>
      </div>

      ${post.caption ? `
        <div class="post-caption">
          <span class="caption-author">@${escapeHtml(post.authorName || 'utente')}</span>
          <span class="caption-text">${escapeHtml(post.caption)}</span>
        </div>
      ` : ''}
    </article>
  `;
}

// Caricamento Post
function startListeningToPosts(uid) {
  const postsQuery = query(
    collection(db, 'posts'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc')
  );

  if (postsLoader) postsLoader.classList.remove('hidden');

  onSnapshot(postsQuery, (snapshot) => {
    if (postsLoader) postsLoader.classList.add('hidden');
    if (!postsList) return;

    if (statPosts) statPosts.textContent = snapshot.docs.length;

    if (snapshot.empty) {
      postsList.innerHTML = '<p class="search-empty" style="text-align:center; padding: 40px 0; color:#94a3b8;">Non hai ancora pubblicato nessun post.</p>';
      postsCache.clear();
      return;
    }

    postsCache.clear();
    postsList.innerHTML = snapshot.docs.map(docSnap => {
      const p = docSnap.data();
      const id = docSnap.id;
      postsCache.set(id, p);
      return renderPostCard(p, id);
    }).join('');

    lucide.createIcons();
    attachPostCardListeners('#postsList');
    attachSaveListeners('#postsList');
    initCarousels();
  }, (err) => {
    if (postsLoader) postsLoader.classList.add('hidden');
    console.error("Errore snapshot post profilo:", err);
  });
}

// Listener Card (Like, Commenti, Menu, Cancella, Modifica)
function attachPostCardListeners(scopeSelector) {
  // Menu tre puntini
  document.querySelectorAll(`${scopeSelector} .post-menu-btn`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = btn.nextElementSibling;
      document.querySelectorAll('.post-menu-dropdown').forEach(d => { if (d !== dropdown) d.classList.add('hidden'); });
      if (dropdown) dropdown.classList.toggle('hidden');
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.post-menu-dropdown').forEach(d => d.classList.add('hidden'));
  });

  // Like
  document.querySelectorAll(`${scopeSelector} .like-btn`).forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!currentUser) return;
      const postId = btn.dataset.id;
      const post = postsCache.get(postId);
      if (!post) return;

      const isLiked = (post.likes || []).includes(currentUser.uid);
      try {
        await updateDoc(doc(db, 'posts', postId), {
          likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
        });
      } catch (err) {
        console.error("Errore like:", err);
      }
    });
  });

  // Commenti
  document.querySelectorAll(`${scopeSelector} .comment-btn`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openComments(btn.dataset.id);
    });
  });

  // Elimina Post
  document.querySelectorAll(`${scopeSelector} .delete-post-btn`).forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const postId = btn.dataset.id;
      if (!confirm('Vuoi davvero eliminare questo post? L\'azione è irreversibile.')) return;

      try {
        const post = postsCache.get(postId);
        if (post) {
          const media = getPostMedia(post);
          for (const m of media) {
            if (m.path) {
              try { await deleteObject(ref(storage, m.path)); } catch (_) {}
            }
          }
        }
        await deleteDoc(doc(db, 'posts', postId));
      } catch (err) {
        console.error("Errore cancellazione post:", err);
      }
    });
  });

  // Modifica Post
  document.querySelectorAll(`${scopeSelector} .edit-post-btn`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const postId = btn.dataset.id;
      const post = postsCache.get(postId);
      if (!post || !editPostModal) return;

      editingPostId = postId;
      if (editCaptionInput) editCaptionInput.value = post.caption || '';
      if (editLocationInput) editLocationInput.value = post.location || '';
      editPostModal.classList.remove('hidden');
    });
  });
}

// Carosello Swipe / Bottoni
function initCarousels() {
  document.querySelectorAll('.carousel-container').forEach(carousel => {
    const track = carousel.querySelector('.carousel-track');
    const slides = carousel.querySelectorAll('.carousel-slide');
    const prevBtn = carousel.querySelector('.carousel-btn.prev');
    const nextBtn = carousel.querySelector('.carousel-btn.next');
    const dots = carousel.querySelectorAll('.carousel-dot');
    let currentIndex = 0;

    function update() {
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
      if (prevBtn) prevBtn.classList.toggle('hidden', currentIndex === 0);
      if (nextBtn) nextBtn.classList.toggle('hidden', currentIndex === slides.length - 1);
      dots.forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentIndex > 0) { currentIndex--; update(); }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentIndex < slides.length - 1) { currentIndex++; update(); }
      });
    }
  });
}

// Modale Commenti
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

if (commentStickerBtn) {
  commentStickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activeCommentsPostId) return;

    openStickerModal(commentStickerBtn, (selectedUrl) => {
      sendCommentSticker(activeCommentsPostId, selectedUrl);
    });
  });
}

// Cancellazione commenti
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

// Modifica Post Modal
if (closeEditPostModalBtn && editPostModal) {
  closeEditPostModalBtn.addEventListener('click', () => editPostModal.classList.add('hidden'));
}

if (editPostForm) {
  editPostForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingPostId) return;

    try {
      await updateDoc(doc(db, 'posts', editingPostId), {
        caption: editCaptionInput ? editCaptionInput.value.trim() : '',
        location: editLocationInput ? editLocationInput.value.trim() : ''
      });
      if (editPostModal) editPostModal.classList.add('hidden');
    } catch (err) {
      console.error("Errore aggiornamento post:", err);
    }
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