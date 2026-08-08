import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { onAuthStateChanged, signOut, getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit,
  serverTimestamp, doc, getDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove,
  where, getDocs, increment
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getStorage, ref, uploadString, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";
import { compressImage, escapeHtml, formatDate } from './utils.js';

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
const auth = getAuth(app);
const db = getFirestore(app, 'default');
const storage = getStorage(app);

const addPostBtn = document.getElementById('addPostBtn');
const postModal = document.getElementById('postModal');
const postModalTitle = document.getElementById('postModalTitle');
const closeModalBtn = document.getElementById('closeModalBtn');
const postForm = document.getElementById('postForm');
const publishBtn = document.getElementById('publishBtn');
const photoInput = document.getElementById('photoInput');
const mediaPreviewStrip = document.getElementById('mediaPreviewStrip');
const captionInput = document.getElementById('captionInput');
const postsGrid = document.getElementById('postsGrid');
const postsLoader = document.getElementById('postsLoader');
const logoutBtn = document.getElementById('logoutBtn');

const commentsModal = document.getElementById('commentsModal');
const closeCommentsBtn = document.getElementById('closeCommentsBtn');
const commentsList = document.getElementById('commentsList');
const commentForm = document.getElementById('commentForm');
const commentInput = document.getElementById('commentInput');

const searchBarContainer = document.getElementById('searchBarContainer');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

const storiesBar = document.getElementById('storiesBar');
const storyPhotoInput = document.getElementById('storyPhotoInput');

const storyViewer = document.getElementById('storyViewer');
const storyProgressBar = document.getElementById('storyProgressBar');
const storyViewerAvatar = document.getElementById('storyViewerAvatar');
const storyViewerPlaceholder = document.getElementById('storyViewerPlaceholder');
const storyViewerUsername = document.getElementById('storyViewerUsername');
const storyViewerTime = document.getElementById('storyViewerTime');
const storyViewerImage = document.getElementById('storyViewerImage');
const storyViewerClose = document.getElementById('storyViewerClose');
const storyNavLeft = document.getElementById('storyNavLeft');
const storyNavRight = document.getElementById('storyNavRight');

const storyOwnerBar = document.getElementById('storyOwnerBar');
const storyViewersBtn = document.getElementById('storyViewersBtn');
const storyViewersCount = document.getElementById('storyViewersCount');
const storyViewerBar = document.getElementById('storyViewerBar');
const storyLikeBtn = document.getElementById('storyLikeBtn');
const storyCommentInput = document.getElementById('storyCommentInput');
const storyCommentSendBtn = document.getElementById('storyCommentSendBtn');

const storyViewersPanel = document.getElementById('storyViewersPanel');
const closeViewersPanelBtn = document.getElementById('closeViewersPanelBtn');
const viewersSearchInput = document.getElementById('viewersSearchInput');
const storyViewersList = document.getElementById('storyViewersList');
const storyCommentsOwnerList = document.getElementById('storyCommentsOwnerList');

lucide.createIcons();

let currentUser = null;
let currentProfile = { displayName: '', logoUrl: '', username: '' };
let postsCache = new Map();
let editingPostId = null;
let activeCommentsPostId = null;
let unsubscribeComments = null;
let searchTimeout;

let pendingNewFiles = [];
let existingEditMedia = [];

let groupedStories = [];
let currentStoryGroupIndex = 0;
let currentStoryIndex = 0;
let storyTimer = null;
let isStoryPaused = false;
const STORY_DURATION = 5000;

let allViewersCache = [];
let unsubscribeStoryComments = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (userDoc.exists()) currentProfile = userDoc.data();

  startListeningToPosts();
  startListeningToStories(user.uid);
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
  pendingNewFiles = [];
  existingEditMedia = [];
  postModalTitle.textContent = 'Crea un nuovo post';
  publishBtn.textContent = 'Pubblica';
  postForm.reset();
  renderMediaPreview();
  postModal.classList.remove('hidden');
}

function closeModal() {
  postModal.classList.add('hidden');
  postForm.reset();
  pendingNewFiles = [];
  existingEditMedia = [];
  renderMediaPreview();
  editingPostId = null;
}

function openEditModal(postId) {
  const post = postsCache.get(postId);
  if (!post) return;

  editingPostId = postId;
  pendingNewFiles = [];
  existingEditMedia = getPostMedia(post).map(m => ({ ...m }));
  postModalTitle.textContent = 'Modifica post';
  publishBtn.textContent = 'Salva modifiche';
  captionInput.value = post.caption || '';
  renderMediaPreview();
  postModal.classList.remove('hidden');
}

function getPostMedia(post) {
  if (post.media && post.media.length > 0) return post.media;
  if (post.photoUrl) return [{ type: 'photo', url: post.photoUrl, path: post.photoPath || '' }];
  return [];
}

photoInput.addEventListener('change', () => {
  const files = Array.from(photoInput.files);

  files.forEach(file => {
    if (existingEditMedia.length + pendingNewFiles.length >= 10) return;
    pendingNewFiles.push(file);
  });

  photoInput.value = '';
  renderMediaPreview();
});

function renderMediaPreview() {
  const existingHtml = existingEditMedia.map((m, idx) => `
    <div class="media-thumb" data-existing-idx="${idx}">
      ${m.type === 'video'
        ? `<video src="${m.url}" class="media-thumb-content"></video>`
        : `<img src="${m.url}" class="media-thumb-content" alt="" />`
      }
      <button type="button" class="media-thumb-remove" data-existing-idx="${idx}"><i data-lucide="x"></i></button>
      <div class="media-thumb-move">
        <button type="button" class="media-move-btn" data-dir="up" data-existing-idx="${idx}"><i data-lucide="chevron-left"></i></button>
        <button type="button" class="media-move-btn" data-dir="down" data-existing-idx="${idx}"><i data-lucide="chevron-right"></i></button>
      </div>
    </div>
  `).join('');

  const newHtml = pendingNewFiles.map((file, idx) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video');
    return `
      <div class="media-thumb media-thumb-new">
        ${isVideo
          ? `<video src="${url}" class="media-thumb-content"></video>`
          : `<img src="${url}" class="media-thumb-content" alt="" />`
        }
        <button type="button" class="media-thumb-remove" data-new-idx="${idx}"><i data-lucide="x"></i></button>
      </div>
    `;
  }).join('');

  mediaPreviewStrip.innerHTML = existingHtml + newHtml;
  lucide.createIcons();

  mediaPreviewStrip.querySelectorAll('.media-thumb-remove[data-existing-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      existingEditMedia.splice(parseInt(btn.dataset.existingIdx), 1);
      renderMediaPreview();
    });
  });

  mediaPreviewStrip.querySelectorAll('.media-thumb-remove[data-new-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingNewFiles.splice(parseInt(btn.dataset.newIdx), 1);
      renderMediaPreview();
    });
  });

  mediaPreviewStrip.querySelectorAll('.media-move-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.existingIdx);
      const dir = btn.dataset.dir;
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= existingEditMedia.length) return;
      [existingEditMedia[idx], existingEditMedia[targetIdx]] = [existingEditMedia[targetIdx], existingEditMedia[idx]];
      renderMediaPreview();
    });
  });
}

async function uploadSingleMedia(file) {
  const isVideo = file.type.startsWith('video');

  if (isVideo) {
    const videoPath = `videos/${currentUser.uid}_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
    const videoRef = ref(storage, videoPath);
    await uploadBytes(videoRef, file);
    const url = await getDownloadURL(videoRef);
    return { type: 'video', url, path: videoPath };
  } else {
    const compressed = await compressImage(file);
    const photoPath = `photos/${currentUser.uid}_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const photoRef = ref(storage, photoPath);
    await uploadString(photoRef, compressed, 'data_url');
    const url = await getDownloadURL(photoRef);
    return { type: 'photo', url, path: photoPath };
  }
}

postForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const totalMedia = existingEditMedia.length + pendingNewFiles.length;
  if (totalMedia === 0) {
    alert('Aggiungi almeno una foto o un video.');
    return;
  }

  publishBtn.disabled = true;
  publishBtn.textContent = editingPostId ? 'Salvataggio...' : 'Pubblicazione in corso...';

  try {
    const uploadedNew = [];
    for (const file of pendingNewFiles) {
      uploadedNew.push(await uploadSingleMedia(file));
    }

    const finalMedia = [...existingEditMedia, ...uploadedNew];

    if (editingPostId) {
      const oldPost = postsCache.get(editingPostId);
      const oldMedia = getPostMedia(oldPost);
      const removedMedia = oldMedia.filter(om => !finalMedia.some(fm => fm.path === om.path));
      removedMedia.forEach(m => {
        if (m.path) deleteObject(ref(storage, m.path)).catch(() => {});
      });

      await updateDoc(doc(db, 'posts', editingPostId), {
        caption: captionInput.value.trim(),
        media: finalMedia,
        photoUrl: finalMedia[0]?.url || '',
        photoPath: finalMedia[0]?.path || ''
      });
    } else {
      await addDoc(collection(db, 'posts'), {
        uid: currentUser.uid,
        authorName: currentProfile.username || currentUser.email.split('@')[0],
        logoUrl: currentProfile.logoUrl || '',
        media: finalMedia,
        photoUrl: finalMedia[0]?.url || '',
        photoPath: finalMedia[0]?.path || '',
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
          ${renderMediaCarousel(getPostMedia(post), id)}
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
    attachCarouselListeners();
  }, (error) => {
    postsLoader.classList.add('hidden');
    console.error('Errore nel caricamento dei post:', error);
    postsGrid.innerHTML = '<p style="color:#ef4444;">Errore nel caricamento dei post.</p>';
  });
}

function renderMediaCarousel(mediaItems, postId) {
  if (mediaItems.length === 0) return '';

  const slides = mediaItems.map(m =>
    m.type === 'video'
      ? `<div class="carousel-slide"><video src="${m.url}" class="post-photo" controls></video></div>`
      : `<div class="carousel-slide"><img src="${m.url}" class="post-photo" alt="Post" loading="lazy" /></div>`
  ).join('');

  const dots = mediaItems.length > 1
    ? `<div class="carousel-dots">${mediaItems.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}"></span>`).join('')}</div>`
    : '';

  return `
    <div class="carousel-container" data-carousel-id="${postId}">
      <div class="carousel-track">${slides}</div>
      ${dots}
    </div>
  `;
}

function attachCarouselListeners() {
  document.querySelectorAll('.carousel-container').forEach(container => {
    const track = container.querySelector('.carousel-track');
    const dots = container.querySelectorAll('.carousel-dot');
    if (dots.length === 0) return;

    track.addEventListener('scroll', () => {
      const idx = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    });
  });
}

function attachPostListeners() {
  document.querySelectorAll('.post-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const dropdown = document.querySelector(`.post-menu-dropdown[data-menu-for="${id}"]`);
      closeAllMenus();
      dropdown.classList.toggle('hidden');
    });
  });

  document.querySelectorAll('.edit-post-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllMenus();
      openEditModal(btn.dataset.id);
    });
  });

  document.querySelectorAll('.delete-post-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      closeAllMenus();
      if (!confirm('Vuoi eliminare questo post?')) return;

      const postId = btn.dataset.id;
      const post = postsCache.get(postId);
      const mediaList = getPostMedia(post);

      try {
        await deleteDoc(doc(db, 'posts', postId));
        mediaList.forEach(m => {
          if (m.path) deleteObject(ref(storage, m.path)).catch(() => {});
        });
      } catch (error) {
        console.error('Errore durante l\'eliminazione:', error);
        alert('Errore durante l\'eliminazione del post.');
      }
    });
  });

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

        if (!isLiked && post.uid !== currentUser.uid) {
          await addDoc(collection(db, 'notifications'), {
            toUid: post.uid,
            fromUid: currentUser.uid,
            fromUsername: currentProfile.username || currentProfile.displayName || 'Utente',
            fromLogoUrl: currentProfile.logoUrl || '',
            type: 'like',
            postId,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      } catch (error) {
        console.error('Errore like:', error);
      }
    });
  });

  document.querySelectorAll('.comment-btn').forEach(btn => {
    btn.addEventListener('click', () => openComments(btn.dataset.id));
  });
}

function closeAllMenus() {
  document.querySelectorAll('.post-menu-dropdown').forEach(d => d.classList.add('hidden'));
}

document.addEventListener('click', closeAllMenus);

// ===== Commenti sui post =====
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
      authorName: currentProfile.username || currentUser.email.split('@')[0],
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

// ===== Ricerca utenti (con filtro bloccati) =====
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
      const usersQuery = query(
        collection(db, 'users'),
        where('username', '>=', term),
        where('username', '<=', term + '\uf8ff'),
        limit(8)
      );

      const snapshot = await getDocs(usersQuery);

      const myDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const myBlocked = (myDoc.exists() ? myDoc.data().blockedUsers : []) || [];

      const filteredDocs = snapshot.docs.filter(d => !myBlocked.includes(d.id));

      if (filteredDocs.length === 0) {
        searchResults.innerHTML = '<p class="search-empty">Nessun utente trovato</p>';
      } else {
        searchResults.innerHTML = filteredDocs.map(docSnap => {
          const u = docSnap.data();
          return `
            <a href="user.html?u=${encodeURIComponent(u.username)}" class="search-result-item">
              ${u.logoUrl
                ? `<img src="${u.logoUrl}" class="search-result-avatar" alt="${u.username}" />`
                : `<div class="search-result-avatar-placeholder"><i data-lucide="user"></i></div>`
              }
              <span>@${escapeHtml(u.username)}</span>
            </a>
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

document.addEventListener('click', (e) => {
  if (!searchBarContainer.contains(e.target)) {
    searchResults.classList.add('hidden');
  }
});

// ===== Storie =====
function startListeningToStories(myUid) {
  getDoc(doc(db, 'users', myUid)).then(myDoc => {
    const myData = myDoc.exists() ? myDoc.data() : {};
    const following = myData.following || [];
    const relevantUids = [myUid, ...following];

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const storiesQuery = query(
      collection(db, 'stories'),
      where('uid', 'in', relevantUids.slice(0, 30)),
      orderBy('createdAt', 'desc')
    );

    onSnapshot(storiesQuery, (snapshot) => {
      const active = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => {
          const created = s.createdAt?.toDate ? s.createdAt.toDate() : new Date();
          return created > cutoff;
        });

      const groups = {};
      active.forEach(story => {
        if (!groups[story.uid]) {
          groups[story.uid] = {
            uid: story.uid,
            username: story.username,
            logoUrl: story.logoUrl,
            stories: []
          };
        }
        groups[story.uid].stories.push(story);
      });

      groupedStories = Object.values(groups).sort((a, b) => {
        if (a.uid === myUid) return -1;
        if (b.uid === myUid) return 1;
        return 0;
      });

      renderStoriesBar(myUid);

      if (!storyViewer.classList.contains('hidden')) {
        refreshCurrentStoryLiveData();
      }
    });
  });
}

function renderStoriesBar(myUid) {
  const myGroup = groupedStories.find(g => g.uid === myUid);
  const others = groupedStories.filter(g => g.uid !== myUid);

  let html = '';

  html += `
    <div class="story-circle-wrap">
      <button type="button" class="story-circle ${myGroup ? (allSeen(myGroup, myUid) ? 'seen' : 'unseen') : 'no-story'}" id="myStoryCircle">
        ${currentProfile.logoUrl
          ? `<img src="${currentProfile.logoUrl}" class="story-avatar-img" alt="" />`
          : `<div class="story-avatar-placeholder"><i data-lucide="user"></i></div>`
        }
        ${!myGroup ? `<span class="story-add-badge">+</span>` : ''}
      </button>
      <span class="story-username-label">La tua storia</span>
    </div>
  `;

  others.forEach((group) => {
    const seen = allSeen(group, myUid);
    html += `
      <div class="story-circle-wrap">
        <button type="button" class="story-circle ${seen ? 'seen' : 'unseen'}" data-group-idx="${groupedStories.indexOf(group)}">
          ${group.logoUrl
            ? `<img src="${group.logoUrl}" class="story-avatar-img" alt="" />`
            : `<div class="story-avatar-placeholder"><i data-lucide="user"></i></div>`
          }
        </button>
        <span class="story-username-label">${escapeHtml(group.username)}</span>
      </div>
    `;
  });

  storiesBar.innerHTML = html;
  lucide.createIcons();

  const myCircleBtn = document.getElementById('myStoryCircle');
  myCircleBtn.addEventListener('click', () => {
    if (myGroup) {
      openStoryViewer(groupedStories.indexOf(myGroup));
    } else {
      storyPhotoInput.click();
    }
  });

  document.querySelectorAll('.story-circle[data-group-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      openStoryViewer(parseInt(btn.dataset.groupIdx));
    });
  });
}

function allSeen(group, myUid) {
  return group.stories.every(s => (s.viewedBy || []).includes(myUid));
}

storyPhotoInput.addEventListener('change', async () => {
  const file = storyPhotoInput.files[0];
  if (!file || !currentUser) return;

  try {
    const compressed = await compressImage(file, 1080, 0.8);
    const storyPath = `stories/${currentUser.uid}_${Date.now()}.jpg`;
    const storyRef = ref(storage, storyPath);
    await uploadString(storyRef, compressed, 'data_url');
    const mediaUrl = await getDownloadURL(storyRef);

    await addDoc(collection(db, 'stories'), {
      uid: currentUser.uid,
      username: currentProfile.username || currentUser.email.split('@')[0],
      logoUrl: currentProfile.logoUrl || '',
      mediaUrl,
      viewedBy: [],
      likes: [],
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Errore caricamento storia:', error);
  } finally {
    storyPhotoInput.value = '';
  }
});

function openStoryViewer(groupIdx) {
  currentStoryGroupIndex = groupIdx;
  currentStoryIndex = 0;
  storyViewer.classList.remove('hidden');
  showCurrentStory();
}

function getCurrentStoryData() {
  const group = groupedStories[currentStoryGroupIndex];
  if (!group) return null;
  const story = group.stories[currentStoryIndex];
  return { group, story };
}

function showCurrentStory() {
  const data = getCurrentStoryData();
  if (!data) { closeStoryViewer(); return; }

  const { group, story } = data;
  if (!story) {
    if (currentStoryGroupIndex < groupedStories.length - 1) {
      currentStoryGroupIndex++;
      currentStoryIndex = 0;
      showCurrentStory();
    } else {
      closeStoryViewer();
    }
    return;
  }

  storyViewerUsername.textContent = `@${group.username}`;
  storyViewerImage.src = story.mediaUrl;

  const avatarToShow = group.uid === currentUser.uid
    ? (currentProfile.logoUrl || group.logoUrl)
    : group.logoUrl;

  if (avatarToShow) {
    storyViewerAvatar.src = avatarToShow;
    storyViewerAvatar.classList.remove('hidden');
    storyViewerPlaceholder.classList.add('hidden');
  } else {
    storyViewerAvatar.classList.add('hidden');
    storyViewerPlaceholder.classList.remove('hidden');
  }

  const created = story.createdAt?.toDate ? story.createdAt.toDate() : new Date();
  const hoursAgo = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60)));
  storyViewerTime.textContent = hoursAgo < 1 ? 'Ora' : `${hoursAgo}h fa`;

  renderProgressBars(group.stories.length, currentStoryIndex);

  const isOwner = group.uid === currentUser.uid;

  if (isOwner) {
    storyOwnerBar.classList.remove('hidden');
    storyViewerBar.classList.add('hidden');
    storyViewersCount.textContent = (story.viewedBy || []).length;
  } else {
    storyOwnerBar.classList.add('hidden');
    storyViewerBar.classList.remove('hidden');
    const likes = story.likes || [];
    const isLiked = likes.includes(currentUser.uid);
    storyLikeBtn.classList.toggle('liked', isLiked);

    if (!(story.viewedBy || []).includes(currentUser.uid)) {
      updateDoc(doc(db, 'stories', story.id), {
        viewedBy: arrayUnion(currentUser.uid)
      }).catch(() => {});
    }
  }

  startStoryTimer();
}

function refreshCurrentStoryLiveData() {
  const data = getCurrentStoryData();
  if (!data || !data.story) return;
  const { group, story } = data;
  const isOwner = group.uid === currentUser.uid;
  if (isOwner) {
    storyViewersCount.textContent = (story.viewedBy || []).length;
  }
}

function renderProgressBars(count, activeIdx) {
  storyProgressBar.innerHTML = Array.from({ length: count }, (_, i) => `
    <div class="story-progress-segment">
      <div class="story-progress-fill ${i < activeIdx ? 'filled' : ''} ${i === activeIdx ? 'active' : ''}"></div>
    </div>
  `).join('');
}

function startStoryTimer() {
  clearTimeout(storyTimer);
  isStoryPaused = false;
  const activeFill = storyProgressBar.querySelector('.story-progress-fill.active');
  if (activeFill) {
    activeFill.style.animation = 'none';
    void activeFill.offsetWidth;
    activeFill.style.animation = `story-fill ${STORY_DURATION}ms linear forwards`;
  }
  storyTimer = setTimeout(nextStory, STORY_DURATION);
}

function pauseStoryTimer() {
  clearTimeout(storyTimer);
  isStoryPaused = true;
  const activeFill = storyProgressBar.querySelector('.story-progress-fill.active');
  if (activeFill) activeFill.style.animationPlayState = 'paused';
}

function nextStory() {
  currentStoryIndex++;
  showCurrentStory();
}

function prevStory() {
  if (currentStoryIndex > 0) {
    currentStoryIndex--;
    showCurrentStory();
  } else if (currentStoryGroupIndex > 0) {
    currentStoryGroupIndex--;
    const prevGroup = groupedStories[currentStoryGroupIndex];
    currentStoryIndex = prevGroup.stories.length - 1;
    showCurrentStory();
  }
}

function closeStoryViewer() {
  clearTimeout(storyTimer);
  storyViewer.classList.add('hidden');
  storyViewersPanel.classList.add('hidden');
  if (unsubscribeStoryComments) unsubscribeStoryComments();
}

storyViewerClose.addEventListener('click', closeStoryViewer);
storyNavRight.addEventListener('click', nextStory);
storyNavLeft.addEventListener('click', prevStory);

storyLikeBtn.addEventListener('click', async () => {
  const data = getCurrentStoryData();
  if (!data || !data.story) return;
  const { group, story } = data;

  const likes = story.likes || [];
  const isLiked = likes.includes(currentUser.uid);

  try {
    await updateDoc(doc(db, 'stories', story.id), {
      likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
    });
    storyLikeBtn.classList.toggle('liked', !isLiked);

    if (!isLiked) {
      await addDoc(collection(db, 'notifications'), {
        toUid: group.uid,
        fromUid: currentUser.uid,
        fromUsername: currentProfile.username || currentProfile.displayName || 'Utente',
        fromLogoUrl: currentProfile.logoUrl || '',
        type: 'story_like',
        read: false,
        createdAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Errore like storia:', error);
  }
});

async function sendStoryComment() {
  const data = getCurrentStoryData();
  if (!data || !data.story) return;
  const { group, story } = data;

  const text = storyCommentInput.value.trim();
  if (!text) return;

  storyCommentInput.value = '';

  try {
    await addDoc(collection(db, 'stories', story.id, 'comments'), {
      uid: currentUser.uid,
      authorName: currentProfile.username || currentProfile.displayName || 'Utente',
      logoUrl: currentProfile.logoUrl || '',
      text,
      createdAt: serverTimestamp()
    });

    await addDoc(collection(db, 'notifications'), {
      toUid: group.uid,
      fromUid: currentUser.uid,
      fromUsername: currentProfile.username || currentProfile.displayName || 'Utente',
      fromLogoUrl: currentProfile.logoUrl || '',
      type: 'story_comment',
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Errore commento storia:', error);
  }
}

storyCommentSendBtn.addEventListener('click', sendStoryComment);
storyCommentInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); sendStoryComment(); }
});
storyCommentInput.addEventListener('focus', pauseStoryTimer);
storyCommentInput.addEventListener('blur', () => { if (!isStoryPaused) startStoryTimer(); });

storyViewersBtn.addEventListener('click', async () => {
  const data = getCurrentStoryData();
  if (!data || !data.story) return;

  pauseStoryTimer();
  storyViewersPanel.classList.remove('hidden');
  viewersSearchInput.value = '';
  switchViewersTab('views');

  await loadViewersList(data.story);
  loadStoryCommentsForOwner(data.story.id);
});

closeViewersPanelBtn.addEventListener('click', () => {
  storyViewersPanel.classList.add('hidden');
  if (unsubscribeStoryComments) unsubscribeStoryComments();
  startStoryTimer();
});

document.querySelectorAll('.story-viewers-tab').forEach(tab => {
  tab.addEventListener('click', () => switchViewersTab(tab.dataset.tab));
});

function switchViewersTab(tabName) {
  document.querySelectorAll('.story-viewers-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  storyViewersList.classList.toggle('hidden', tabName !== 'views');
  storyCommentsOwnerList.classList.toggle('hidden', tabName !== 'comments');
}

async function loadViewersList(story) {
  const viewedBy = story.viewedBy || [];

  if (viewedBy.length === 0) {
    allViewersCache = [];
    storyViewersList.innerHTML = '<p class="search-empty">Nessuna visualizzazione ancora.</p>';
    return;
  }

  const likes = story.likes || [];

  allViewersCache = await Promise.all(viewedBy.map(async (uid) => {
    const d = await getDoc(doc(db, 'users', uid));
    return { uid, data: d.exists() ? d.data() : {}, liked: likes.includes(uid) };
  }));

  renderViewersList(allViewersCache);
}

function renderViewersList(viewers) {
  if (viewers.length === 0) {
    storyViewersList.innerHTML = '<p class="search-empty">Nessun risultato.</p>';
    return;
  }

  storyViewersList.innerHTML = viewers.map(v => `
    <div class="conversation-item">
      ${v.data.logoUrl
        ? `<img src="${v.data.logoUrl}" class="conversation-avatar" alt="" />`
        : `<div class="conversation-avatar-placeholder"><i data-lucide="user"></i></div>`
      }
      <div class="conversation-info">
        <span class="conversation-username">@${escapeHtml(v.data.username || 'utente')}</span>
      </div>
      ${v.liked ? `<i data-lucide="heart" class="viewer-liked-icon"></i>` : ''}
    </div>
  `).join('');
  lucide.createIcons();
}

viewersSearchInput.addEventListener('input', () => {
  const term = viewersSearchInput.value.trim().toLowerCase();
  if (!term) {
    renderViewersList(allViewersCache);
    return;
  }
  const filtered = allViewersCache.filter(v => (v.data.username || '').toLowerCase().includes(term));
  renderViewersList(filtered);
});

function loadStoryCommentsForOwner(storyId) {
  if (unsubscribeStoryComments) unsubscribeStoryComments();

  const q = query(collection(db, 'stories', storyId, 'comments'), orderBy('createdAt', 'asc'));

  unsubscribeStoryComments = onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      storyCommentsOwnerList.innerHTML = '<p class="search-empty">Nessun commento ancora.</p>';
      return;
    }

    storyCommentsOwnerList.innerHTML = snapshot.docs.map(docSnap => {
      const c = docSnap.data();
      return `
        <div class="comment-item">
          <span class="comment-author">${escapeHtml(c.authorName || 'Utente')}</span>
          <p class="comment-text">${escapeHtml(c.text || '')}</p>
        </div>
      `;
    }).join('');
  });
}