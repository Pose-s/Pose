import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  doc, getDoc, setDoc, collection, query, where, orderBy,
  onSnapshot, deleteDoc, updateDoc, addDoc, serverTimestamp,
  increment, arrayUnion, arrayRemove, limit
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
const usernameEditInput = document.getElementById('usernameEditInput');
const usernameEditHint = document.getElementById('usernameEditHint');
const displayNameInput = document.getElementById('displayNameInput');
const bioEditInput = document.getElementById('bioEditInput');
const profileForm = document.getElementById('profileForm');
const profileMsg = document.getElementById('profileMsg');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const logoutBtn = document.getElementById('logoutBtn');
const settingsBtn = document.getElementById('settingsBtn');

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

// ===== Riferimenti modale commenti =====
const commentsModal = document.getElementById('commentsModal');
const closeCommentsBtn = document.getElementById('closeCommentsBtn');
const commentsList = document.getElementById('commentsList');
const commentForm = document.getElementById('commentForm');
const commentInput = document.getElementById('commentInput');

let currentUser = null;
let currentLogoUrl = '';
let currentUsername = '';
let postsCacheProfile = new Map();
let postsOrderList = [];
let editingPostId = null;
let activeCommentsPostId = null;
let unsubscribeComments = null;

settingsBtn.addEventListener('click', () => {
  window.location.href = 'settings.html';
});

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

  currentUsername = data.username || '';

  profileUsername.textContent = currentUsername ? `@${currentUsername}` : `@${user.email.split('@')[0]}`;
  profileBio.textContent = data.bio || '';
  currentLogoUrl = data.logoUrl || '';
  updateAvatarDisplay(currentLogoUrl, currentLogo, logoPlaceholder);

  statFollowers.textContent = (data.followers || []).length;
  statFollowing.textContent = (data.following || []).length;

  displayNameInput.value = data.displayName || currentUsername || user.email.split('@')[0];
  bioEditInput.value = data.bio || '';
  usernameEditInput.value = currentUsername;
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

// ===== Controllo disponibilità username mentre si scrive =====
let usernameCheckTimeout;
usernameEditInput.addEventListener('input', () => {
  clearTimeout(usernameCheckTimeout);
  const value = usernameEditInput.value.trim().toLowerCase();
  usernameEditHint.textContent = '';
  usernameEditHint.className = 'field-hint';

  if (value.length < 3 || value === currentUsername) return;

  usernameCheckTimeout = setTimeout(async () => {
    const docSnap = await getDoc(doc(db, 'usernames', value));
    if (docSnap.exists()) {
      usernameEditHint.textContent = 'Nome utente già in uso';
      usernameEditHint.className = 'field-hint hint-error';
    } else {
      usernameEditHint.textContent = 'Disponibile ✓';
      usernameEditHint.className = 'field-hint hint-ok';
    }
  }, 400);
});

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

  const newUsername = usernameEditInput.value.trim().toLowerCase();

  if (newUsername !== currentUsername) {
    const usernameDoc = await getDoc(doc(db, 'usernames', newUsername));
    if (usernameDoc.exists()) {
      profileMsg.textContent = 'Questo nome utente è già in uso.';
      profileMsg.classList.remove('hidden');
      return;
    }
  }

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

    if (newUsername !== currentUsername) {
      if (currentUsername) {
        await deleteDoc(doc(db, 'usernames', currentUsername)).catch(() => {});
      }
      await setDoc(doc(db, 'usernames', newUsername), { uid: currentUser.uid });
    }

    await setDoc(doc(db, 'users', currentUser.uid), {
      username: newUsername,
      displayName: displayNameInput.value.trim(),
      bio,
      logoUrl
    }, { merge: true });

    currentUsername = newUsername;
    currentLogoUrl = logoUrl;
    profileUsername.textContent = `@${newUsername}`;
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

// ===== Lista post del profilo (con ordine personalizzabile) =====
function startListeningToOwnPosts(uid) {
  const postsQuery = query(
    collection(db, 'posts'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc')
  );

  profilePostsLoader.classList.remove('hidden');

  onSnapshot(postsQuery, async (snapshot) => {
    profilePostsLoader.classList.add('hidden');
    postsCacheProfile.clear();
    statPosts.textContent = snapshot.size;

    if (snapshot.empty) {
      profilePostsGrid.innerHTML = '<p style="color:#94a3b8;">Non hai ancora pubblicato nessun post.</p>';
      return;
    }

    const fetchedIds = [];
    snapshot.docs.forEach(docSnap => {
      postsCacheProfile.set(docSnap.id, docSnap.data());
      fetchedIds.push(docSnap.id);
    });

    // Applica ordine personalizzato salvato, se presente
    const userDoc = await getDoc(doc(db, 'users', uid));
    const savedOrder = userDoc.exists() ? (userDoc.data().postOrder || []) : [];

    const ordered = savedOrder.filter(id => fetchedIds.includes(id));
    const newOnes = fetchedIds.filter(id => !ordered.includes(id));
    postsOrderList = [...newOnes, ...ordered];

    renderProfilePosts();
  }, (error) => {
    profilePostsLoader.classList.add('hidden');
    console.error('Errore nel caricamento dei post:', error);
    profilePostsGrid.innerHTML = '<p style="color:#ef4444;">Errore nel caricamento dei post.</p>';
  });
}

function renderProfilePosts() {
  profilePostsGrid.innerHTML = postsOrderList.map(id => {
    const post = postsCacheProfile.get(id);
    if (!post) return '';

    const likes = post.likes || [];
    const isLiked = currentUser && likes.includes(currentUser.uid);
    const commentCount = post.commentCount || 0;

    return `
      <article class="post-card profile-post-card">
        <div class="post-header">
          ${currentLogoUrl
            ? `<img src="${currentLogoUrl}" class="post-logo" alt="Logo" loading="lazy" />`
            : `<div class="post-logo-placeholder"><i data-lucide="user"></i></div>`
          }
          <div class="post-header-info">
            <span class="post-author">${escapeHtml(currentUsername || 'Tu')}</span>
            <span class="post-date">${formatDate(post.createdAt)}</span>
          </div>
          <div class="post-menu">
            <button class="post-menu-btn" data-id="${id}">
              <i data-lucide="more-vertical"></i>
            </button>
            <div class="post-menu-dropdown hidden" data-menu-for="${id}">
              <button class="menu-item move-up-btn" data-id="${id}">
                <i data-lucide="arrow-left"></i> Sposta prima
              </button>
              <button class="menu-item move-down-btn" data-id="${id}">
                <i data-lucide="arrow-right"></i> Sposta dopo
              </button>
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
  attachProfilePostListeners();
}

async function savePostOrder() {
  await updateDoc(doc(db, 'users', currentUser.uid), { postOrder: postsOrderList }).catch(() => {});
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

  document.querySelectorAll('#profilePostsGrid .move-up-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllProfileMenus();
      const id = btn.dataset.id;
      const idx = postsOrderList.indexOf(id);
      if (idx > 0) {
        [postsOrderList[idx - 1], postsOrderList[idx]] = [postsOrderList[idx], postsOrderList[idx - 1]];
        renderProfilePosts();
        savePostOrder();
      }
    });
  });

  document.querySelectorAll('#profilePostsGrid .move-down-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllProfileMenus();
      const id = btn.dataset.id;
      const idx = postsOrderList.indexOf(id);
      if (idx < postsOrderList.length - 1) {
        [postsOrderList[idx + 1], postsOrderList[idx]] = [postsOrderList[idx], postsOrderList[idx + 1]];
        renderProfilePosts();
        savePostOrder();
      }
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
        postsOrderList = postsOrderList.filter(id => id !== postId);
        savePostOrder();
      } catch (error) {
        console.error(error);
        alert('Errore durante l\'eliminazione del post.');
      }
    });
  });

  document.querySelectorAll('#profilePostsGrid .like-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.id;
      const post = postsCacheProfile.get(postId);
      const likes = post?.likes || [];
      const isLiked = likes.includes(currentUser.uid);

      await updateDoc(doc(db, 'posts', postId), {
        likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
      });
    });
  });

  document.querySelectorAll('#profilePostsGrid .comment-btn').forEach(btn => {
    btn.addEventListener('click', () => openComments(btn.dataset.id));
  });
}

function closeAllProfileMenus() {
  document.querySelectorAll('#profilePostsGrid .post-menu-dropdown').forEach(d => d.classList.add('hidden'));
}

document.addEventListener('click', closeAllProfileMenus);

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
      authorName: currentUsername || 'Utente',
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

// ===== Notifiche (invariato dal codice precedente) =====
const notificationBtn = document.getElementById('notificationBtn');
const notifBadgeDot = document.getElementById('notifBadgeDot');
const notificationsPanel = document.getElementById('notificationsPanel');
const notificationsList = document.getElementById('notificationsList');

let unreadNotifIds = [];

onAuthStateChanged(auth, (user) => {
  if (!user) return;

  const notifQuery = query(
    collection(db, 'notifications'),
    where('toUid', '==', user.uid),
    orderBy('createdAt', 'desc'),
    limit(30)
  );

  onSnapshot(notifQuery, (snapshot) => {
    unreadNotifIds = [];

    if (snapshot.empty) {
      notificationsList.innerHTML = '<p class="search-empty">Nessuna notifica per ora.</p>';
      notifBadgeDot.classList.add('hidden');
      notificationBtn.classList.remove('has-notifications');
      return;
    }

    let hasUnread = false;

    notificationsList.innerHTML = snapshot.docs.map(docSnap => {
      const n = docSnap.data();
      if (!n.read) {
        hasUnread = true;
        unreadNotifIds.push(docSnap.id);
      }

      let text;
if (n.type === 'like') {
  text = `<strong>@${escapeHtml(n.fromUsername)}</strong> ha messo like a un tuo post`;
} else if (n.type === 'story_like') {
  text = `<strong>@${escapeHtml(n.fromUsername)}</strong> ha messo like alla tua storia`;
} else if (n.type === 'story_comment') {
  text = `<strong>@${escapeHtml(n.fromUsername)}</strong> ha commentato la tua storia`;
} else {
  text = `<strong>@${escapeHtml(n.fromUsername)}</strong> ha iniziato a seguirti`;
}

      return `
        <div class="notification-item ${n.read ? '' : 'unread'}">
          ${n.fromLogoUrl
            ? `<img src="${n.fromLogoUrl}" class="notification-avatar" alt="" />`
            : `<div class="notification-avatar-placeholder"><i data-lucide="user"></i></div>`
          }
          <span class="notification-text">${text}</span>
        </div>
      `;
    }).join('');

    lucide.createIcons();

    if (hasUnread) {
      notifBadgeDot.classList.remove('hidden');
      notificationBtn.classList.add('has-notifications');
    } else {
      notifBadgeDot.classList.add('hidden');
      notificationBtn.classList.remove('has-notifications');
    }
  });
});

notificationBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  notificationsPanel.classList.toggle('hidden');

  if (!notificationsPanel.classList.contains('hidden') && unreadNotifIds.length > 0) {
    for (const id of unreadNotifIds) {
      updateDoc(doc(db, 'notifications', id), { read: true }).catch(() => {});
    }
  }
});

document.addEventListener('click', (e) => {
  if (!notificationsPanel.contains(e.target) && !notificationBtn.contains(e.target)) {
    notificationsPanel.classList.add('hidden');
  }
});
import { collection as mCollection, query as mQuery, where as mWhere, onSnapshot as mOnSnapshot } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const msgBadgeDot = document.getElementById('msgBadgeDot');

onAuthStateChanged(auth, (user) => {
  if (!user) return;

  const convQuery = mQuery(
    mCollection(db, 'conversations'),
    mWhere('participants', 'array-contains', user.uid)
  );

  mOnSnapshot(convQuery, (snapshot) => {
    let totalUnread = 0;
    snapshot.docs.forEach(docSnap => {
      const conv = docSnap.data();
      totalUnread += (conv.unread && conv.unread[user.uid]) || 0;
    });
const messagesBtn = document.getElementById('messagesBtn');

if (totalUnread > 0) {
  msgBadgeDot.classList.remove('hidden');
  messagesBtn.classList.add('has-notifications');
} else {
  msgBadgeDot.classList.add('hidden');
  messagesBtn.classList.remove('has-notifications');
}
  });
});