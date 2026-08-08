import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { onAuthStateChanged, signOut, getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit,
  serverTimestamp, doc, getDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, where, getDocs
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";
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

lucide.createIcons();

let currentUser = null;
let currentProfile = { displayName: '', logoUrl: '', username: '' };
let postsCache = new Map();
let editingPostId = null;
let activeCommentsPostId = null;
let unsubscribeComments = null;
let searchTimeout;

let groupedStories = [];
let currentStoryGroupIndex = 0;
let currentStoryIndex = 0;
let storyTimer = null;
const STORY_DURATION = 5000;

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
  postModalTitle.textContent = 'Crea un nuovo post';
  publishBtn.textContent = 'Pubblica';
  photoInput.required = true;
  postForm.reset();
  photoPreview.classList.add('hidden');
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
        authorName: currentProfile.username || currentUser.email.split('@')[0],
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

// ===== Ricerca utenti (con filtro utenti bloccati) =====
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

function showCurrentStory() {
  const group = groupedStories[currentStoryGroupIndex];
  if (!group) { closeStoryViewer(); return; }

  const story = group.stories[currentStoryIndex];
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

  if (currentUser && !(story.viewedBy || []).includes(currentUser.uid)) {
    updateDoc(doc(db, 'stories', story.id), {
      viewedBy: arrayUnion(currentUser.uid)
    }).catch(() => {});
  }

  startStoryTimer();
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
  const activeFill = storyProgressBar.querySelector('.story-progress-fill.active');
  if (activeFill) {
    activeFill.style.animation = 'none';
    void activeFill.offsetWidth;
    activeFill.style.animation = `story-fill ${STORY_DURATION}ms linear forwards`;
  }
  storyTimer = setTimeout(nextStory, STORY_DURATION);
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
}

storyViewerClose.addEventListener('click', closeStoryViewer);
storyNavRight.addEventListener('click', nextStory);
storyNavLeft.addEventListener('click', prevStory);