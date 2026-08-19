import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { onAuthStateChanged, signOut, getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit,
  serverTimestamp, doc, getDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove,
  where, getDocs, increment, setDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getStorage, ref, uploadString, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";
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

const locationInput = document.getElementById('locationInput');
const locationSuggestions = document.getElementById('locationSuggestions');
const productLabelInput = document.getElementById('productLabelInput');
const productUrlInput = document.getElementById('productUrlInput');

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
const commentsPostMedia = document.getElementById('commentsPostMedia');
const commentsPostCaption = document.getElementById('commentsPostCaption');

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
const storyDeleteBtn = document.getElementById('storyDeleteBtn');

const shareModal = document.getElementById('shareModal');
const closeShareBtn = document.getElementById('closeShareBtn');
const shareSearchInput = document.getElementById('shareSearchInput');
const shareEmptyMsg = document.getElementById('shareEmptyMsg');
const shareFriendsList = document.getElementById('shareFriendsList');

const storyEditor = document.getElementById('storyEditor');
const storyEditorCanvas = document.getElementById('storyEditorCanvas');
const storyEditorCloseBtn = document.getElementById('storyEditorCloseBtn');
const storyDrawToolBtn = document.getElementById('storyDrawToolBtn');
const storyEraserToolBtn = document.getElementById('storyEraserToolBtn');
const storyTextToolBtn = document.getElementById('storyTextToolBtn');
const colorPickerBtn = document.getElementById('colorPickerBtn');
const storyColorInput = document.getElementById('storyColorInput');
const storyUndoBtn = document.getElementById('storyUndoBtn');
const storyEditorDiscardBtn = document.getElementById('storyEditorDiscardBtn');
const storyEditorPublishBtn = document.getElementById('storyEditorPublishBtn');
const storyTextInput = document.getElementById('storyTextInput');
const textStyleBar = document.getElementById('textStyleBar');
const storyTagBtn = document.getElementById('storyTagBtn');

const tagModal = document.getElementById('tagModal');
const closeTagModalBtn = document.getElementById('closeTagModalBtn');
const tagSearchInput = document.getElementById('tagSearchInput');
const tagResultsList = document.getElementById('tagResultsList');
const taggedSelectedList = document.getElementById('taggedSelectedList');
const tagModalDoneBtn = document.getElementById('tagModalDoneBtn');
const openTagModalBtn = document.getElementById('openTagModalBtn');
const taggedPreview = document.getElementById('taggedPreview');

const tagChoiceModal = document.getElementById('tagChoiceModal');
const closeTagChoiceBtn = document.getElementById('closeTagChoiceBtn');
const viewTagsChoiceBtn = document.getElementById('viewTagsChoiceBtn');
const addTagsChoiceBtn = document.getElementById('addTagsChoiceBtn');

const storyTagViewBtn2 = document.getElementById('storyTagViewBtn2');
const storyRepostBtn = document.getElementById('storyRepostBtn');
const commentStickerBtn = document.getElementById('commentStickerBtn');

lucide.createIcons();

let currentUser = null;
let currentProfile = { displayName: '', logoUrl: '', username: '' };
let postsCache = new Map();
let editingPostId = null;
let activeCommentsPostId = null;
let unsubscribeComments = null;
let searchTimeout;
let savedPostIds = new Set();
let pendingTaggedUsers = [];
let storyPendingTaggedUsers = [];
let activeTagPostId = null;
let activeTagCache = null;

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

let sharingPostId = null;
let allShareFriends = [];

const TEXT_STYLES = [
  { id: 'classic', label: 'Classico', font: '700 36px Inter, sans-serif' },
  { id: 'serif', label: 'Serif', font: '700 38px Georgia, serif' },
  { id: 'hand', label: 'Corsivo', font: 'italic 40px cursive' },
  { id: 'outline', label: 'Contorno', font: '700 40px Inter, sans-serif', outline: true },
  { id: 'pill', label: 'Evidenziato', font: '700 34px Inter, sans-serif', pill: true },
  { id: 'shadow', label: 'Ombra', font: '700 38px Inter, sans-serif', shadow: true },
  { id: 'spaced', label: 'Spaziato', font: '600 32px Inter, sans-serif', spaced: true, upper: true },
  { id: 'thin', label: 'Sottile', font: '300 38px Inter, sans-serif' },
  { id: 'mono', label: 'Monospace', font: '700 34px "Courier New", monospace' },
  { id: 'gradient', label: 'Sfumato', font: '800 40px Inter, sans-serif', gradient: true }
];

let storyCtx = null;
let storyBaseImage = null;
let storyCurrentTool = null;
let storyCurrentColor = '#ffffff';
let storyCurrentTextStyle = TEXT_STYLES[0].id;
let storyIsDrawing = false;
let storyUndoStack = [];
let storyTextLayers = [];
let storyDrawingLayer = null;
let storyDraggingTextIdx = null;
let storyDragOffset = { x: 0, y: 0 };
let storyDragMoved = false;
let storyDragStartPos = null;
let storyEditingTextIdx = null;
let storyPendingTextPos = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (userDoc.exists()) currentProfile = userDoc.data();

  await loadSavedPosts();
  startListeningToPosts();
  startListeningToStories(user.uid);
});

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'login.html';
  });
}

function conversationIdFor(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

function getPostMedia(post) {
  if (post.media && post.media.length > 0) return post.media;
  if (post.photoUrl) return [{ type: 'photo', url: post.photoUrl, path: post.photoPath || '' }];
  return [];
}

// ===== Salvati =====
async function loadSavedPosts() {
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
          btn.classList.remove('saved');
        } else {
          savedPostIds.add(postId);
          btn.classList.add('saved');
        }
      } catch (error) {
        console.error('Errore salvataggio post:', error);
      }
    });
  });
}

// ===== Repost + Tag post =====
async function attachRepostAndTagListeners(scopeSelector, cache) {
  const repostBtns = document.querySelectorAll(`${scopeSelector} .repost-action-btn`);

  for (const btn of repostBtns) {
    const postId = btn.dataset.id;
    const existingRepostQuery = query(
      collection(db, 'reposts'),
      where('uid', '==', currentUser.uid),
      where('postId', '==', postId)
    );
    const existingSnap = await getDocs(existingRepostQuery);
    if (!existingSnap.empty) {
      btn.classList.add('reposted');
      btn.dataset.repostDocId = existingSnap.docs[0].id;
    }
  }

  document.querySelectorAll(`${scopeSelector} .repost-action-btn`).forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const postId = btn.dataset.id;
      const post = cache.get(postId);
      if (!post) return;

      if (post.uid === currentUser.uid) {
        alert('Non puoi repostare i tuoi stessi post.');
        return;
      }

      btn.disabled = true;

      try {
        if (btn.classList.contains('reposted')) {
          await deleteDoc(doc(db, 'reposts', btn.dataset.repostDocId));
          btn.classList.remove('reposted');
          delete btn.dataset.repostDocId;
        } else {
          const docRef = await addDoc(collection(db, 'reposts'), {
            uid: currentUser.uid,
            postId,
            originalAuthorUid: post.uid,
            createdAt: serverTimestamp()
          });
          btn.classList.add('reposted');
          btn.dataset.repostDocId = docRef.id;

          await addDoc(collection(db, 'notifications'), {
            toUid: post.uid,
            fromUid: currentUser.uid,
            fromUsername: currentProfile.username || currentProfile.displayName || 'Utente',
            fromLogoUrl: currentProfile.logoUrl || '',
            type: 'repost',
            postId,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      } catch (error) {
        console.error('Errore repost:', error);
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll(`${scopeSelector} .tag-view-btn`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllMenus();
      openTagChoiceModal(btn.dataset.id, cache);
    });
  });
}

function openTagChoiceModal(postId, cache) {
  activeTagPostId = postId;
  activeTagCache = cache;
  if (tagChoiceModal) tagChoiceModal.classList.remove('hidden');
}

if (closeTagChoiceBtn) {
  closeTagChoiceBtn.addEventListener('click', () => tagChoiceModal.classList.add('hidden'));
}
if (tagChoiceModal) {
  tagChoiceModal.addEventListener('click', (e) => { if (e.target === tagChoiceModal) tagChoiceModal.classList.add('hidden'); });
}

if (viewTagsChoiceBtn) {
  viewTagsChoiceBtn.addEventListener('click', () => {
    tagChoiceModal.classList.add('hidden');
    const post = activeTagCache.get(activeTagPostId);
    const tags = post?.taggedUsernames || [];
    if (tags.length === 0) {
      alert('Nessuna persona taggata in questo post.');
    } else {
      alert('Persone taggate: ' + tags.map(u => '@' + u).join(', '));
    }
  });
}

if (addTagsChoiceBtn) {
  addTagsChoiceBtn.addEventListener('click', () => {
    tagChoiceModal.classList.add('hidden');
    const post = activeTagCache.get(activeTagPostId);
    pendingTaggedUsers = (post?.taggedUids || []).map((uid, i) => ({ uid, username: (post?.taggedUsernames || [])[i] || '' }));

    tagModal.classList.remove('hidden');
    tagSearchInput.value = '';
    tagResultsList.innerHTML = '';
    renderTaggedSelected();
  });
}

// ===== Modale tag persone =====
if (openTagModalBtn) {
  openTagModalBtn.addEventListener('click', () => {
    tagModal.classList.remove('hidden');
    tagSearchInput.value = '';
    tagResultsList.innerHTML = '';
    renderTaggedSelected();
  });
}

if (closeTagModalBtn) {
  closeTagModalBtn.addEventListener('click', () => tagModal.classList.add('hidden'));
}
if (tagModal) {
  tagModal.addEventListener('click', (e) => { if (e.target === tagModal) tagModal.classList.add('hidden'); });
}

if (tagModalDoneBtn) {
  tagModalDoneBtn.addEventListener('click', async () => {
    tagModal.classList.add('hidden');

    if (activeTagPostId) {
      try {
        await updateDoc(doc(db, 'posts', activeTagPostId), {
          taggedUids: pendingTaggedUsers.map(t => t.uid),
          taggedUsernames: pendingTaggedUsers.map(t => t.username)
        });
        alert('Tag aggiornati!');
      } catch (error) {
        console.error('Errore aggiornamento tag:', error);
      }
      activeTagPostId = null;
    } else {
      renderTaggedPreview();
    }
  });
}

let tagSearchTimeout;
if (tagSearchInput) {
  tagSearchInput.addEventListener('input', () => {
    clearTimeout(tagSearchTimeout);
    const term = tagSearchInput.value.trim().toLowerCase();
    if (!term) { tagResultsList.innerHTML = ''; return; }

    tagSearchTimeout = setTimeout(async () => {
      const usersQuery = query(
        collection(db, 'users'),
        where('username', '>=', term),
        where('username', '<=', term + '\uf8ff'),
        limit(8)
      );
      const snapshot = await getDocs(usersQuery);

      const activeTagList = !storyEditor.classList.contains('hidden') ? storyPendingTaggedUsers : pendingTaggedUsers;

      tagResultsList.innerHTML = snapshot.docs
        .filter(d => d.id !== currentUser.uid && !activeTagList.some(t => t.uid === d.id))
        .map(docSnap => {
          const u = docSnap.data();
          return `
            <div class="conversation-item" data-uid="${docSnap.id}" data-username="${escapeHtml(u.username || '')}">
              ${renderAvatar(u.logoUrl, u.isVerified, "conversation-avatar-wrap", "conversation-avatar")}
              <div class="conversation-info"><span class="conversation-username">@${escapeHtml(u.username || '')}</span></div>
            </div>
          `;
        }).join('');
      lucide.createIcons();

      tagResultsList.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', () => {
          if (!storyEditor.classList.contains('hidden')) {
            storyPendingTaggedUsers.push({ uid: item.dataset.uid, username: item.dataset.username });
            renderStoryTaggedSelected();
          } else {
            pendingTaggedUsers.push({ uid: item.dataset.uid, username: item.dataset.username });
            renderTaggedSelected();
          }
          tagSearchInput.value = '';
          tagResultsList.innerHTML = '';
        });
      });
    }, 300);
  });
}

function renderTaggedSelected() {
  if (!taggedSelectedList) return;
  taggedSelectedList.innerHTML = pendingTaggedUsers.map(t => `
    <span class="tagged-chip">@${escapeHtml(t.username)} <button type="button" data-uid="${t.uid}" class="tagged-chip-remove">×</button></span>
  `).join('');

  taggedSelectedList.querySelectorAll('.tagged-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingTaggedUsers = pendingTaggedUsers.filter(t => t.uid !== btn.dataset.uid);
      renderTaggedSelected();
    });
  });
}

function renderTaggedPreview() {
  if (!taggedPreview) return;
  if (pendingTaggedUsers.length === 0) {
    taggedPreview.innerHTML = '';
    return;
  }
  taggedPreview.innerHTML = `<span class="tagged-preview-text">Con: ${pendingTaggedUsers.map(t => '@' + escapeHtml(t.username)).join(', ')}</span>`;
}

function renderStoryTaggedSelected() {
  if (!taggedSelectedList) return;
  taggedSelectedList.innerHTML = storyPendingTaggedUsers.map(t => `
    <span class="tagged-chip">@${escapeHtml(t.username)} <button type="button" data-uid="${t.uid}" class="tagged-chip-remove-story">×</button></span>
  `).join('');

  taggedSelectedList.querySelectorAll('.tagged-chip-remove-story').forEach(btn => {
    btn.addEventListener('click', () => {
      storyPendingTaggedUsers = storyPendingTaggedUsers.filter(t => t.uid !== btn.dataset.uid);
      renderStoryTaggedSelected();
    });
  });
}

// ===== Modale Crea/Modifica Post =====
if (addPostBtn) {
  addPostBtn.addEventListener('click', () => openCreateModal());
}
if (closeModalBtn) {
  closeModalBtn.addEventListener('click', closeModal);
}
if (postModal) {
  postModal.addEventListener('click', (e) => { if (e.target === postModal) closeModal(); });
}

function openCreateModal() {
  editingPostId = null;
  pendingNewFiles = [];
  existingEditMedia = [];
  pendingTaggedUsers = [];
  if (postModalTitle) postModalTitle.textContent = 'Crea un nuovo post';
  if (publishBtn) publishBtn.textContent = 'Pubblica';
  if (postForm) postForm.reset();
  if (locationInput) locationInput.value = '';
  if (productLabelInput) productLabelInput.value = '';
  if (productUrlInput) productUrlInput.value = '';
  renderMediaPreview();
  renderTaggedPreview();
  if (postModal) postModal.classList.remove('hidden');
}

function closeModal() {
  if (postModal) postModal.classList.add('hidden');
  if (postForm) postForm.reset();
  if (locationInput) locationInput.value = '';
  if (productLabelInput) productLabelInput.value = '';
  if (productUrlInput) productUrlInput.value = '';
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
  pendingTaggedUsers = (post.taggedUids || []).map((uid, i) => ({ uid, username: (post.taggedUsernames || [])[i] || '' }));
  
  if (postModalTitle) postModalTitle.textContent = 'Modifica post';
  if (publishBtn) publishBtn.textContent = 'Salva modifiche';
  if (captionInput) captionInput.value = post.caption || '';
  if (locationInput) locationInput.value = post.location || '';
  if (productLabelInput) productLabelInput.value = post.productTags?.[0]?.label || '';
  if (productUrlInput) productUrlInput.value = post.productTags?.[0]?.url || '';
  
  renderMediaPreview();
  renderTaggedPreview();
  if (postModal) postModal.classList.remove('hidden');
}

if (photoInput) {
  photoInput.addEventListener('change', () => {
    const files = Array.from(photoInput.files);
    files.forEach(file => {
      if (existingEditMedia.length + pendingNewFiles.length >= 10) return;
      pendingNewFiles.push(file);
    });
    photoInput.value = '';
    renderMediaPreview();
  });
}

function renderMediaPreview() {
  if (!mediaPreviewStrip) return;
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

if (postForm) {
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

      let initialProductTags = [];
      const pLabel = productLabelInput?.value.trim();
      let pUrl = productUrlInput?.value.trim();

      if (pLabel && pUrl) {
        if (!pUrl.startsWith('http://') && !pUrl.startsWith('https://')) {
          pUrl = 'https://' + pUrl;
        }
        initialProductTags.push({
          label: pLabel,
          url: pUrl,
          x: 50,
          y: 50,
          slideIndex: 0,
          addedBy: currentProfile.username || currentUser.email.split('@')[0],
          createdAt: new Date().toISOString()
        });
      }

      if (editingPostId) {
        const oldPost = postsCache.get(editingPostId);
        const oldMedia = getPostMedia(oldPost);
        const removedMedia = oldMedia.filter(om => !finalMedia.some(fm => fm.path === om.path));
        removedMedia.forEach(m => {
          if (m.path) deleteObject(ref(storage, m.path)).catch(() => {});
        });

        await updateDoc(doc(db, 'posts', editingPostId), {
          caption: captionInput.value.trim(),
          location: locationInput ? locationInput.value.trim() : '',
          media: finalMedia,
          photoUrl: finalMedia[0]?.url || '',
          photoPath: finalMedia[0]?.path || '',
          taggedUids: pendingTaggedUsers.map(t => t.uid),
          taggedUsernames: pendingTaggedUsers.map(t => t.username),
          ...(initialProductTags.length > 0 ? { productTags: initialProductTags } : {})
        });
      } else {
        await addDoc(collection(db, 'posts'), {
          uid: currentUser.uid,
          authorName: currentProfile.username || currentUser.email.split('@')[0],
          logoUrl: currentProfile.logoUrl || '',
          location: locationInput ? locationInput.value.trim() : '',
          media: finalMedia,
          photoUrl: finalMedia[0]?.url || '',
          photoPath: finalMedia[0]?.path || '',
          caption: captionInput.value.trim(),
          likes: [],
          commentCount: 0,
          taggedUids: pendingTaggedUsers.map(t => t.uid),
          taggedUsernames: pendingTaggedUsers.map(t => t.username),
          productTags: initialProductTags,
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
}

// ===== Ricerca Luoghi OpenStreetMap =====
let locationSearchTimeout;
if (locationInput && locationSuggestions) {
  locationInput.addEventListener('input', () => {
    clearTimeout(locationSearchTimeout);
    const query = locationInput.value.trim();

    if (query.length < 2) {
      locationSuggestions.innerHTML = '';
      locationSuggestions.classList.add('hidden');
      return;
    }

    locationSearchTimeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`
        );
        const results = await response.json();

        if (!results || results.length === 0) {
          locationSuggestions.innerHTML = '<div class="location-item" style="color:#94a3b8; cursor:default;">Nessun luogo trovato</div>';
          locationSuggestions.classList.remove('hidden');
          return;
        }

        locationSuggestions.innerHTML = results.map(item => {
          const title = item.name || item.display_name.split(',')[0];
          const subtitle = item.display_name;
          return `
            <div class="location-item" data-name="${escapeHtml(title)}">
              <i data-lucide="map-pin"></i>
              <div style="overflow:hidden;">
                <span class="location-item-title">${escapeHtml(title)}</span>
                <span class="location-item-subtitle">${escapeHtml(subtitle)}</span>
              </div>
            </div>
          `;
        }).join('');

        lucide.createIcons();
        locationSuggestions.classList.remove('hidden');

        locationSuggestions.querySelectorAll('.location-item').forEach(el => {
          el.addEventListener('click', () => {
            if (el.dataset.name) {
              locationInput.value = el.dataset.name;
            }
            locationSuggestions.classList.add('hidden');
          });
        });
      } catch (error) {
        console.error('Errore ricerca luoghi:', error);
      }
    }, 350);
  });

  document.addEventListener('click', (e) => {
    if (!locationInput.contains(e.target) && !locationSuggestions.contains(e.target)) {
      locationSuggestions.classList.add('hidden');
    }
  });
}

function renderProductTagsForSlide(tags, slideIdx) {
  if (!tags || !Array.isArray(tags)) return '';
  const filtered = tags.filter(t => (t.slideIndex !== undefined ? t.slideIndex === slideIdx : slideIdx === 0));
  if (filtered.length === 0) return '';

  return `
    <div class="product-tags-overlay hidden">
      ${filtered.map(tag => `
        <div class="product-tag-pin" style="left: ${tag.x}%; top: ${tag.y}%;">
          <button type="button" class="product-tag-dot" onclick="event.stopPropagation(); window.open('${tag.url}', '_blank')">
            <span class="product-tag-pulse"></span>
            <span class="product-tag-label">${escapeHtml(tag.label)} <i data-lucide="external-link"></i></span>
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

// ===== Lista Post =====
function startListeningToPosts() {
  const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(30));
  if (postsLoader) postsLoader.classList.remove('hidden');

  onSnapshot(postsQuery, async (snapshot) => {
    if (postsLoader) postsLoader.classList.add('hidden');

    if (!postsGrid) return;

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
      const isSaved = savedPostIds.has(id);

      return `
        <article class="post-card">
          <div class="post-header">
            ${post.logoUrl
        ? `${renderAvatar(
            post.logoUrl || post.userPhoto || post.authorPhoto || '',
            post.isVerified === true || isOwner || post.authorName === 'elisabel_messa',
            "post-avatar-wrap",
            "post-logo"
          )}`
        : `<div class="post-logo-placeholder"><i data-lucide="user"></i></div>`
      }
        
            <div class="post-header-info">
              <a href="user.html?u=${encodeURIComponent(post.authorName || '')}" class="post-author" onclick="event.stopPropagation()">${escapeHtml(post.authorName || 'Utente')}</a>
              ${post.location ? `<span class="post-location" style="display: block; font-size: 12px; color: #64748b;"><i data-lucide="map-pin" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 2px;"></i>${escapeHtml(post.location)}</span>` : ''}
              <span class="post-date">${formatDate(post.createdAt)}</span>
            </div>
            <div class="post-menu">
              <button class="post-menu-btn" data-id="${id}">
                <i data-lucide="more-vertical"></i>
              </button>
              <div class="post-menu-dropdown hidden" data-menu-for="${id}">
                ${isOwner ? `
                  <button class="menu-item edit-post-btn" data-id="${id}">
                    <i data-lucide="pencil"></i> ${t('menu_edit')}
                  </button>
                ` : ''}
                <button class="menu-item repost-story-btn" data-id="${id}">
                  <i data-lucide="clapperboard"></i> ${t('menu_share_story')}
                </button>
                <button class="menu-item tag-view-btn" data-id="${id}">
                  <i data-lucide="tag"></i> Tag
                </button>
                <button class="menu-item add-product-tag-btn" data-id="${id}">
                  <i data-lucide="shopping-bag"></i> ${t('tag_products')}
                </button>
                ${isOwner ? `
                  <button class="menu-item menu-item-danger delete-post-btn" data-id="${id}" data-photopath="${post.photoPath || ''}">
                    <i data-lucide="trash-2"></i> ${t('menu_delete')}
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
          <div class="post-media-clickable" data-id="${id}">
            ${renderMediaCarousel(getPostMedia(post), id)}
          </div>
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
            <button class="action-btn share-btn" data-id="${id}">
              <i data-lucide="send"></i>
            </button>
            <button class="action-btn repost-action-btn" data-id="${id}">
              <i data-lucide="repeat"></i>
            </button>
            <button class="action-btn save-btn ${isSaved ? 'saved' : ''}" data-id="${id}">
              <i data-lucide="bookmark"></i>
            </button>
          </div>
        </article>
      `;
    }).join('');

    lucide.createIcons();
    attachPostListeners();
    attachCarouselListeners();
    attachSaveListeners('#postsGrid');
    attachProductTagListeners();
    await attachRepostAndTagListeners('#postsGrid', postsCache);
    await attachRepostersDisplay();
  }, (error) => {
    if (postsLoader) postsLoader.classList.add('hidden');
    console.error('Errore nel caricamento dei post:', error);
    if (postsGrid) postsGrid.innerHTML = '<p style="color:#ef4444;">Errore nel caricamento dei post.</p>';
  });
}

async function attachRepostersDisplay() {
  const following = currentProfile.following || [];
  if (following.length === 0) return;

  const postCards = document.querySelectorAll('#postsGrid .post-card');

  for (const card of postCards) {
    const mediaEl = card.querySelector('.post-media-clickable');
    if (!mediaEl) continue;
    const postId = mediaEl.dataset.id;

    const repostersQuery = query(
      collection(db, 'reposts'),
      where('postId', '==', postId),
      where('uid', 'in', following.slice(0, 30))
    );

    const snap = await getDocs(repostersQuery);
    if (snap.empty) continue;

    const reposterUids = [...new Set(snap.docs.map(d => d.data().uid))];
    const users = await Promise.all(reposterUids.slice(0, 5).map(async (uid) => {
      const uDoc = await getDoc(doc(db, 'users', uid));
      return uDoc.exists() ? { uid, ...uDoc.data() } : null;
    }));

    const validUsers = users.filter(u => u);
    if (validUsers.length === 0) continue;

    const badge = document.createElement('div');
    badge.className = 'reposters-badge';
    badge.innerHTML = validUsers.map(u => `
      <a href="user.html?u=${encodeURIComponent(u.username || '')}" class="reposter-avatar" title="@${escapeHtml(u.username || '')}">
        ${u.logoUrl
          ? `<img src="${u.logoUrl}" alt="" />`
          : `<div class="reposter-avatar-placeholder"><i data-lucide="user"></i></div>`
        }
      </a>
    `).join('');

    card.style.position = 'relative';
    card.appendChild(badge);
  }

  lucide.createIcons();
}

function renderMediaCarousel(mediaItems, postId) {
  if (mediaItems.length === 0) return '';

  const post = postsCache.get(postId);
  const tags = post?.productTags || [];

  const slides = mediaItems.map((m, i) => `
    <div class="carousel-slide" data-slide-index="${i}" style="position: relative;">
      ${m.type === 'video'
        ? `<video src="${m.url}" class="post-photo" controls></video>`
        : `<img src="${m.url}" class="post-photo" alt="Post" loading="lazy" />`
      }
      ${renderProductTagsForSlide(tags, i)}
    </div>
  `).join('');

  const dots = mediaItems.length > 1
    ? `<div class="carousel-dots">${mediaItems.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}"></span>`).join('')}</div>`
    : '';

  const arrows = mediaItems.length > 1
    ? `
      <button type="button" class="carousel-arrow carousel-arrow-left" data-carousel-nav="prev"><i data-lucide="chevron-left"></i></button>
      <button type="button" class="carousel-arrow carousel-arrow-right" data-carousel-nav="next"><i data-lucide="chevron-right"></i></button>
    `
    : '';

  return `
    <div class="carousel-container" data-carousel-id="${postId}">
      <div class="carousel-track">${slides}</div>
      ${arrows}
      ${dots}
    </div>
  `;
}

function attachCarouselListeners() {
  document.querySelectorAll('.carousel-container').forEach(container => {
    const track = container.querySelector('.carousel-track');
    const dots = container.querySelectorAll('.carousel-dot');

    if (dots.length > 0) {
      track.addEventListener('scroll', () => {
        const idx = Math.round(track.scrollLeft / track.clientWidth);
        dots.forEach((d, i) => d.classList.toggle('active', i === idx));
      });
    }

    const prevBtn = container.querySelector('[data-carousel-nav="prev"]');
    const nextBtn = container.querySelector('[data-carousel-nav="next"]');

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' });
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        track.scrollBy({ left: track.clientWidth, behavior: 'smooth' });
      });
    }

    track.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        track.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  });
}

function attachPostListeners() {
  document.querySelectorAll('.post-media-clickable').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.carousel-arrow') || e.target.closest('.carousel-dots') || e.target.closest('.product-tag-dot')) return;

      const slide = e.target.closest('.carousel-slide');
      if (slide) {
        const overlay = slide.querySelector('.product-tags-overlay');
        if (overlay) {
          overlay.classList.toggle('hidden');
          return; 
        }
      }
      openComments(el.dataset.id);
    });
  });

  document.querySelectorAll('.post-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const dropdown = document.querySelector(`.post-menu-dropdown[data-menu-for="${id}"]`);
      closeAllMenus();
      if (dropdown) dropdown.classList.toggle('hidden');
    });
  });

  document.querySelectorAll('.edit-post-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllMenus();
      openEditModal(btn.dataset.id);
    });
  });

  document.querySelectorAll('.repost-story-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      closeAllMenus();

      const postId = btn.dataset.id;
      const post = postsCache.get(postId);
      if (!post) return;

      const media = getPostMedia(post);
      if (media.length === 0) return;

      try {
        const durationHours = parseInt(currentProfile.storyDuration || '24');
        const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

        await addDoc(collection(db, 'stories'), {
          uid: currentUser.uid,
          username: currentProfile.username || currentUser.email.split('@')[0],
          logoUrl: currentProfile.logoUrl || '',
          mediaUrl: media[0].url,
          type: 'post_share',
          sharedPostId: postId,
          sharedPostAuthor: post.authorName || '',
          sharedPostCaption: post.caption || '',
          viewedBy: [],
          likes: [],
          expiresAt,
          createdAt: serverTimestamp()
        });

        alert('Post pubblicato nelle tue storie!');
      } catch (error) {
        console.error('Errore pubblicazione post nelle storie:', error);
      }
    });
  });

  document.querySelectorAll('.delete-post-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      closeAllMenus();
      if (!confirm(t('confirm_delete_post'))) return;

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
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
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
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openComments(btn.dataset.id);
    });
  });

  document.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openShareModal(btn.dataset.id);
    });
  });
}

function closeAllMenus() {
  document.querySelectorAll('.post-menu-dropdown').forEach(d => d.classList.add('hidden'));
}

document.addEventListener('click', closeAllMenus);

// ===== Dettaglio post + Commenti =====
function openComments(postId) {
  activeCommentsPostId = postId;
  if (commentsModal) commentsModal.classList.remove('hidden');

  const post = postsCache.get(postId);
  if (post) {
    if (commentsPostMedia) commentsPostMedia.innerHTML = renderMediaCarousel(getPostMedia(post), 'detail-' + postId);
    if (post.caption) {
      if (commentsPostCaption) {
        commentsPostCaption.textContent = post.caption;
        commentsPostCaption.classList.remove('hidden');
      }
    } else {
      if (commentsPostCaption) commentsPostCaption.classList.add('hidden');
    }
    lucide.createIcons();
    attachCarouselListeners();
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
      const isSticker = c.type === 'sticker';
      const isVerified = c.isVerified === true || c.authorName === 'elisabel_messa';
      const avatarPhoto = c.userPhoto || (currentUser && c.uid === currentUser.uid ? currentProfile.logoUrl : '');

      let bodyHtml;
      if (isSticker) {
        bodyHtml = `<img src="${c.sticker}" class="comment-sticker-media" alt="sticker" />`;
      } else {
        bodyHtml = `<p class="comment-text">${escapeHtml(c.text || '')}</p>`;
      }

      return `
        <div class="comment-row">
          ${renderAvatar(avatarPhoto, isVerified, "comment-avatar-wrap", "comment-avatar-img")}
          <div class="comment-bubble">
            <a href="user.html?u=${encodeURIComponent(c.authorName || '')}" class="comment-author-name">
              @${escapeHtml(c.authorName || 'utente')}
            </a>
            ${bodyHtml}
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
    commentsList.scrollTop = commentsList.scrollHeight;
  }); 
}

if (closeCommentsBtn) {
  closeCommentsBtn.addEventListener('click', closeComments);
}
if (commentsModal) {
  commentsModal.addEventListener('click', (e) => { if (e.target === commentsModal) closeComments(); });
}

function closeComments() {
  if (commentsModal) commentsModal.classList.add('hidden');
  if (unsubscribeComments) unsubscribeComments();
  activeCommentsPostId = null;
  if (commentInput) commentInput.value = '';
}

if (commentForm) {
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeCommentsPostId || !currentUser) return;

    const text = commentInput.value.trim();
    if (!text) return;

    try {
      // Nel submit del commentForm:
await addDoc(collection(db, 'posts', activeCommentsPostId, 'comments'), {
  uid: currentUser.uid,
  authorName: currentProfile.username || currentUser.email.split('@')[0],
  userPhoto: currentProfile.logoUrl || '',
  isVerified: currentProfile.username === 'elisabel_messa',
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
}

// ===== Ricerca Utenti =====
if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const term = searchInput.value.trim().toLowerCase();

    if (!term) {
      if (searchResults) {
        searchResults.classList.add('hidden');
        searchResults.innerHTML = '';
      }
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

        if (!searchResults) return;

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
}

document.addEventListener('click', (e) => {
  if (searchBarContainer && !searchBarContainer.contains(e.target)) {
    if (searchResults) searchResults.classList.add('hidden');
  }
});

// ===== Storie =====
function startListeningToStories(myUid) {
  getDoc(doc(db, 'users', myUid)).then(myDoc => {
    const myData = myDoc.exists() ? myDoc.data() : {};
    const following = myData.following || [];
    const relevantUids = [myUid, ...following];

    const storiesQuery = query(
      collection(db, 'stories'),
      where('uid', 'in', relevantUids.slice(0, 30)),
      orderBy('createdAt', 'desc')
    );

    onSnapshot(storiesQuery, (snapshot) => {
      const now = new Date();
      const fallbackCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const active = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => {
          if (s.expiresAt) {
            const expires = s.expiresAt.toDate ? s.expiresAt.toDate() : new Date(s.expiresAt);
            return expires > now;
          }
          const created = s.createdAt?.toDate ? s.createdAt.toDate() : new Date();
          return created > fallbackCutoff;
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

      Object.values(groups).forEach(g => g.stories.reverse());

      groupedStories = Object.values(groups).sort((a, b) => {
        if (a.uid === myUid) return -1;
        if (b.uid === myUid) return 1;
        return 0;
      });

      renderStoriesBar(myUid);

      if (storyViewer && !storyViewer.classList.contains('hidden')) {
        refreshCurrentStoryLiveData();
      }
    });
  });
}

function renderStoriesBar(myUid) {
  if (!storiesBar) return;
  const myGroup = groupedStories.find(g => g.uid === myUid);
  const others = groupedStories.filter(g => g.uid !== myUid);

  let html = '';

  html += `
    <div class="story-circle-wrap">
      <div class="story-circle-outer">
        <button type="button" class="story-circle ${myGroup ? 'seen' : 'no-story'}" id="myStoryCircle">
          ${currentProfile.logoUrl
            ? `<img src="${currentProfile.logoUrl}" class="story-avatar-img" alt="" />`
            : `<div class="story-avatar-placeholder"><i data-lucide="user"></i></div>`
          }
        </button>
        <button type="button" class="story-add-btn" id="addStoryBtnStory">
          <i data-lucide="plus"></i>
        </button>
      </div>
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
  if (myCircleBtn) {
    myCircleBtn.addEventListener('click', () => {
      if (myGroup) {
        openStoryViewer(groupedStories.indexOf(myGroup));
      } else {
        storyPhotoInput.click();
      }
    });
  }

  const addStoryBtnStory = document.getElementById('addStoryBtnStory');
  if (addStoryBtnStory) {
    addStoryBtnStory.addEventListener('click', (e) => {
      e.stopPropagation();
      storyPhotoInput.click();
    });
  }

  document.querySelectorAll('.story-circle[data-group-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      openStoryViewer(parseInt(btn.dataset.groupIdx));
    });
  });
}

function allSeen(group, myUid) {
  return group.stories.every(s => (s.viewedBy || []).includes(myUid));
}

if (storyPhotoInput) {
  storyPhotoInput.addEventListener('change', () => {
    const file = storyPhotoInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => openStoryEditor(e.target.result);
    reader.readAsDataURL(file);

    storyPhotoInput.value = '';
  });
}

// ===== Editor Storie =====
function getContrastColor(hex) {
  const r = parseInt(hex.substr(1, 2), 16);
  const g = parseInt(hex.substr(3, 2), 16);
  const b = parseInt(hex.substr(5, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000000' : '#ffffff';
}

function openStoryEditor(imageDataUrl) {
  const img = new Image();
  img.onload = () => {
    storyEditorCanvas.width = window.innerWidth;
    storyEditorCanvas.height = window.innerHeight;
    storyCtx = storyEditorCanvas.getContext('2d');
    storyBaseImage = img;
    storyTextLayers = [];
    storyDrawingLayer = null;
    storyCurrentTool = null;
    storyPendingTaggedUsers = [];
    redrawStoryCanvas();
    storyUndoStack = [captureStoryState()];
    if (storyEditor) storyEditor.classList.remove('hidden');
    if (textStyleBar) textStyleBar.classList.add('hidden');
  };
  img.src = imageDataUrl;
}

function drawStyledText(ctx, t) {
  const style = TEXT_STYLES.find(s => s.id === t.styleId) || TEXT_STYLES[0];
  ctx.font = style.font;
  ctx.textBaseline = 'alphabetic';

  let text = t.text;
  if (style.upper) text = text.toUpperCase();

  if (style.spaced) {
    let x = t.x;
    for (const char of text) {
      if (style.outline) {
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.strokeText(char, x, t.y);
      } else {
        ctx.fillStyle = t.color;
        ctx.fillText(char, x, t.y);
      }
      x += ctx.measureText(char).width + 6;
    }
    return;
  }

  if (style.pill) {
    const metrics = ctx.measureText(text);
    const padX = 14, padY = 10;
    ctx.fillStyle = t.color;
    const rectX = t.x - padX;
    const rectY = t.y - 30 - padY / 2;
    const rectW = metrics.width + padX * 2;
    const rectH = 40 + padY;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(rectX, rectY, rectW, rectH, 10);
    } else {
      ctx.rect(rectX, rectY, rectW, rectH);
    }
    ctx.fill();
    ctx.fillStyle = getContrastColor(t.color);
    ctx.fillText(text, t.x, t.y);
    return;
  }

  if (style.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = t.color;
    ctx.fillText(text, t.x, t.y);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    return;
  }

  if (style.outline) {
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 2.5;
    ctx.strokeText(text, t.x, t.y);
    return;
  }

  if (style.gradient) {
    const metrics = ctx.measureText(text);
    const gradient = ctx.createLinearGradient(t.x, 0, t.x + metrics.width, 0);
    gradient.addColorStop(0, t.color);
    gradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = gradient;
    ctx.fillText(text, t.x, t.y);
    return;
  }

  ctx.fillStyle = t.color;
  ctx.fillText(text, t.x, t.y);
}

function redrawStoryCanvas() {
  if (!storyEditorCanvas || !storyCtx) return;
  const cw = storyEditorCanvas.width;
  const ch = storyEditorCanvas.height;

  storyCtx.clearRect(0, 0, cw, ch);
  storyCtx.fillStyle = '#000000';
  storyCtx.fillRect(0, 0, cw, ch);

  if (storyBaseImage) {
    const iw = storyBaseImage.width;
    const ih = storyBaseImage.height;
    const scale = Math.min(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    storyCtx.drawImage(storyBaseImage, dx, dy, dw, dh);
  }

  if (storyDrawingLayer) storyCtx.drawImage(storyDrawingLayer, 0, 0);
  storyTextLayers.forEach(t => drawStyledText(storyCtx, t));
}

function captureStoryState() {
  return {
    drawing: storyDrawingLayer ? storyDrawingLayer.toDataURL() : null,
    texts: JSON.parse(JSON.stringify(storyTextLayers))
  };
}

function restoreStoryState(state) {
  storyTextLayers = JSON.parse(JSON.stringify(state.texts));
  if (state.drawing) {
    const img = new Image();
    img.onload = () => {
      storyDrawingLayer = document.createElement('canvas');
      storyDrawingLayer.width = storyEditorCanvas.width;
      storyDrawingLayer.height = storyEditorCanvas.height;
      storyDrawingLayer.getContext('2d').drawImage(img, 0, 0);
      redrawStoryCanvas();
    };
    img.src = state.drawing;
  } else {
    storyDrawingLayer = null;
    redrawStoryCanvas();
  }
}

function saveStoryUndo() {
  storyUndoStack.push(captureStoryState());
  if (storyUndoStack.length > 20) storyUndoStack.shift();
}

if (storyEditorCloseBtn) {
  storyEditorCloseBtn.addEventListener('click', () => storyEditor.classList.add('hidden'));
}
if (storyEditorDiscardBtn) {
  storyEditorDiscardBtn.addEventListener('click', () => storyEditor.classList.add('hidden'));
}

if (storyDrawToolBtn) {
  storyDrawToolBtn.addEventListener('click', () => {
    storyCurrentTool = storyCurrentTool === 'draw' ? null : 'draw';
    storyDrawToolBtn.classList.toggle('active', storyCurrentTool === 'draw');
    if (storyEraserToolBtn) storyEraserToolBtn.classList.remove('active');
    if (textStyleBar) textStyleBar.classList.add('hidden');
  });
}

if (storyEraserToolBtn) {
  storyEraserToolBtn.addEventListener('click', () => {
    storyCurrentTool = storyCurrentTool === 'erase' ? null : 'erase';
    storyEraserToolBtn.classList.toggle('active', storyCurrentTool === 'erase');
    if (storyDrawToolBtn) storyDrawToolBtn.classList.remove('active');
    if (textStyleBar) textStyleBar.classList.add('hidden');
  });
}

if (storyTextToolBtn) {
  storyTextToolBtn.addEventListener('click', () => {
    const centerPos = {
      x: storyEditorCanvas.width / 2,
      y: storyEditorCanvas.height / 2,
      clientX: window.innerWidth / 2,
      clientY: window.innerHeight / 2
    };
    openStoryTextInputAt(centerPos);
  });
}

if (storyTagBtn) {
  storyTagBtn.addEventListener('click', () => {
    tagModal.classList.remove('hidden');
    tagSearchInput.value = '';
    tagResultsList.innerHTML = '';
    renderStoryTaggedSelected();
  });
}

function renderTextStyleBar() {
  if (!textStyleBar) return;
  textStyleBar.innerHTML = TEXT_STYLES.map(s => `
    <button type="button" class="text-style-option ${s.id === storyCurrentTextStyle ? 'active' : ''}" data-style="${s.id}">${s.label}</button>
  `).join('');

  textStyleBar.querySelectorAll('.text-style-option').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      storyCurrentTextStyle = btn.dataset.style;
      renderTextStyleBar();

      if (storyEditingTextIdx !== null) {
        storyTextLayers[storyEditingTextIdx].styleId = storyCurrentTextStyle;
        redrawStoryCanvas();
      }
    });
  });
}

if (colorPickerBtn) {
  colorPickerBtn.addEventListener('mousedown', (e) => e.preventDefault());
}

if (storyColorInput) {
  storyColorInput.addEventListener('input', () => {
    storyCurrentColor = storyColorInput.value;
    if (colorPickerBtn) colorPickerBtn.style.background = storyCurrentColor;
    if (storyEditingTextIdx !== null) {
      storyTextLayers[storyEditingTextIdx].color = storyCurrentColor;
      redrawStoryCanvas();
    }
  });
}

if (storyUndoBtn) {
  storyUndoBtn.addEventListener('mousedown', (e) => e.preventDefault());
  storyUndoBtn.addEventListener('click', () => {
    if (storyUndoStack.length <= 1) return;
    storyUndoStack.pop();
    restoreStoryState(storyUndoStack[storyUndoStack.length - 1]);
  });
}

function ensureDrawingLayer() {
  if (!storyDrawingLayer) {
    storyDrawingLayer = document.createElement('canvas');
    storyDrawingLayer.width = storyEditorCanvas.width;
    storyDrawingLayer.height = storyEditorCanvas.height;
  }
}

function getStoryCanvasPos(e) {
  const rect = storyEditorCanvas.getBoundingClientRect();
  const scaleX = storyEditorCanvas.width / rect.width;
  const scaleY = storyEditorCanvas.height / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY, clientX: e.clientX, clientY: e.clientY };
}

function findTextAt(pos) {
  for (let i = storyTextLayers.length - 1; i >= 0; i--) {
    const t = storyTextLayers[i];
    const style = TEXT_STYLES.find(s => s.id === t.styleId) || TEXT_STYLES[0];
    storyCtx.font = style.font;
    const width = storyCtx.measureText(t.text).width;
    if (pos.x >= t.x - 20 && pos.x <= t.x + width + 20 && pos.y <= t.y + 20 && pos.y >= t.y - 55) {
      return i;
    }
  }
  return -1;
}

function openStoryTextInputAt(pos) {
  storyPendingTextPos = pos;
  storyEditingTextIdx = null;
  storyTextInput.style.left = `${pos.clientX}px`;
  storyTextInput.style.top = `${pos.clientY}px`;
  storyTextInput.style.color = storyCurrentColor;
  storyTextInput.value = '';
  storyTextInput.classList.remove('hidden');
  renderTextStyleBar();
  textStyleBar.classList.remove('hidden');
  storyTextInput.focus();
}

function storyPointerDown(e) {
  const pos = getStoryCanvasPos(e);

  if (storyCurrentTool === 'draw' || storyCurrentTool === 'erase') {
    ensureDrawingLayer();
    storyIsDrawing = true;
    const dctx = storyDrawingLayer.getContext('2d');
    dctx.beginPath();
    dctx.moveTo(pos.x, pos.y);
    return;
  }

  const idx = findTextAt(pos);
  if (idx !== -1) {
    storyDraggingTextIdx = idx;
    storyDragOffset = { x: pos.x - storyTextLayers[idx].x, y: pos.y - storyTextLayers[idx].y };
    storyDragMoved = false;
    storyDragStartPos = pos;
    return;
  }

  openStoryTextInputAt(pos);
}

function storyPointerMove(e) {
  const pos = getStoryCanvasPos(e);

  if (storyIsDrawing && (storyCurrentTool === 'draw' || storyCurrentTool === 'erase')) {
    const dctx = storyDrawingLayer.getContext('2d');
    dctx.lineTo(pos.x, pos.y);
    if (storyCurrentTool === 'erase') {
      dctx.globalCompositeOperation = 'destination-out';
      dctx.lineWidth = 30;
    } else {
      dctx.globalCompositeOperation = 'source-over';
      dctx.strokeStyle = storyCurrentColor;
      dctx.lineWidth = 6;
    }
    dctx.lineCap = 'round';
    dctx.stroke();
    redrawStoryCanvas();
    return;
  }

  if (storyDraggingTextIdx !== null) {
    const dist = Math.hypot(pos.x - storyDragStartPos.x, pos.y - storyDragStartPos.y);
    if (dist > 15) storyDragMoved = true;

    if (storyDragMoved) {
      storyTextLayers[storyDraggingTextIdx].x = pos.x - storyDragOffset.x;
      storyTextLayers[storyDraggingTextIdx].y = pos.y - storyDragOffset.y;
      redrawStoryCanvas();
    }
  }
}

function storyPointerUp() {
  if (storyIsDrawing) {
    saveStoryUndo();
    storyCurrentTool = null;
    if (storyDrawToolBtn) storyDrawToolBtn.classList.remove('active');
    if (storyEraserToolBtn) storyEraserToolBtn.classList.remove('active');
  }
  storyIsDrawing = false;

  if (storyDraggingTextIdx !== null) {
    if (storyDragMoved) {
      saveStoryUndo();
    } else {
      openTextEditMode(storyDraggingTextIdx);
    }
    storyDraggingTextIdx = null;
    storyDragMoved = false;
  }
}

if (storyEditorCanvas) {
  storyEditorCanvas.style.touchAction = 'none';
  storyEditorCanvas.addEventListener('pointerdown', storyPointerDown);
  storyEditorCanvas.addEventListener('pointermove', storyPointerMove);
  storyEditorCanvas.addEventListener('pointerup', storyPointerUp);
}

function openTextEditMode(idx) {
  const t = storyTextLayers[idx];
  storyEditingTextIdx = idx;
  storyPendingTextPos = { x: t.x, y: t.y };
  storyCurrentColor = t.color;
  storyCurrentTextStyle = t.styleId;

  if (colorPickerBtn) colorPickerBtn.style.background = t.color;
  if (storyColorInput) storyColorInput.value = t.color;

  const rect = storyEditorCanvas.getBoundingClientRect();
  const scaleX = rect.width / storyEditorCanvas.width;
  const scaleY = rect.height / storyEditorCanvas.height;

  storyTextInput.style.left = `${rect.left + t.x * scaleX}px`;
  storyTextInput.style.top = `${rect.top + t.y * scaleY}px`;
  storyTextInput.style.color = t.color;
  storyTextInput.value = t.text;
  storyTextInput.classList.remove('hidden');
  storyTextInput.focus();
  storyTextInput.select();

  renderTextStyleBar();
  textStyleBar.classList.remove('hidden');
}

function commitStoryText() {
  if (!storyPendingTextPos) return;

  const value = storyTextInput.value.trim();

  if (!value) {
    if (storyEditingTextIdx !== null) {
      storyTextLayers.splice(storyEditingTextIdx, 1);
    }
  } else if (storyEditingTextIdx !== null) {
    storyTextLayers[storyEditingTextIdx].text = value;
    storyTextLayers[storyEditingTextIdx].color = storyCurrentColor;
    storyTextLayers[storyEditingTextIdx].styleId = storyCurrentTextStyle;
  } else {
    storyTextLayers.push({
      text: value,
      x: storyPendingTextPos.x,
      y: storyPendingTextPos.y,
      color: storyCurrentColor,
      styleId: storyCurrentTextStyle
    });
  }

  redrawStoryCanvas();
  storyTextInput.classList.add('hidden');
  textStyleBar.classList.add('hidden');
  storyPendingTextPos = null;
  storyEditingTextIdx = null;
  saveStoryUndo();
}

if (storyTextInput) {
  storyTextInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitStoryText();
    }
  });

  let storyTextBlurTimeout;
  storyTextInput.addEventListener('blur', () => {
    storyTextBlurTimeout = setTimeout(() => {
      commitStoryText();
    }, 200);
  });

  storyTextInput.addEventListener('focus', () => {
    clearTimeout(storyTextBlurTimeout);
  });
}

// ===== Notifica via Messaggio per Tag Storia =====
async function notifyTaggedUsersInStory(taggedUsers, storyMediaUrl) {
  for (const t of taggedUsers) {
    if (t.uid === currentUser.uid) continue;

    try {
      const convId = conversationIdFor(currentUser.uid, t.uid);
      const convRef = doc(db, 'conversations', convId);
      const convDoc = await getDoc(convRef);

      if (!convDoc.exists()) {
        await setDoc(convRef, {
          participants: [currentUser.uid, t.uid],
          lastMessage: '',
          lastMessageAt: serverTimestamp(),
          unread: { [currentUser.uid]: 0, [t.uid]: 0 }
        });
      }

      await addDoc(collection(db, 'conversations', convId, 'messages'), {
        from: currentUser.uid,
        type: 'story_tag',
        storyMediaUrl,
        text: 'Ti ha taggato in una storia',
        createdAt: serverTimestamp()
      });

      await updateDoc(convRef, {
        lastMessage: '🎬 Ti ha taggato in una storia',
        lastMessageAt: serverTimestamp(),
        [`unread.${t.uid}`]: increment(1)
      });

      await addDoc(collection(db, 'notifications'), {
        toUid: t.uid,
        fromUid: currentUser.uid,
        fromUsername: currentProfile.username || currentProfile.displayName || 'Utente',
        fromLogoUrl: currentProfile.logoUrl || '',
        type: 'story_tag',
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Errore notifica tag storia:', error);
    }
  }
}

if (storyEditorPublishBtn) {
  storyEditorPublishBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    storyEditorPublishBtn.disabled = true;

    try {
      const dataUrl = storyEditorCanvas.toDataURL('image/jpeg', 0.85);
      const storyPath = `stories/${currentUser.uid}_${Date.now()}.jpg`;
      const storyRef = ref(storage, storyPath);
      await uploadString(storyRef, dataUrl, 'data_url');
      const mediaUrl = await getDownloadURL(storyRef);

      const durationHours = parseInt(currentProfile.storyDuration || '24');
      const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

      await addDoc(collection(db, 'stories'), {
        uid: currentUser.uid,
        username: currentProfile.username || currentUser.email.split('@')[0],
        logoUrl: currentProfile.logoUrl || '',
        mediaUrl,
        mediaPath: storyPath,
        viewedBy: [],
        likes: [],
        expiresAt,
        taggedUids: storyPendingTaggedUsers.map(t => t.uid),
        taggedUsernames: storyPendingTaggedUsers.map(t => t.username),
        createdAt: serverTimestamp()
      });

      if (storyPendingTaggedUsers.length > 0) {
        await notifyTaggedUsersInStory(storyPendingTaggedUsers, mediaUrl);
      }

      storyPendingTaggedUsers = [];
      storyEditor.classList.add('hidden');
    } catch (error) {
      console.error('Errore pubblicazione storia:', error);
    } finally {
      storyEditorPublishBtn.disabled = false;
    }
  });
}

// ===== Visualizzatore Storie =====
function openStoryViewer(groupIdx) {
  currentStoryGroupIndex = groupIdx;
  currentStoryIndex = 0;
  if (storyViewer) storyViewer.classList.remove('hidden');
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

  if (storyViewerUsername) storyViewerUsername.textContent = `@${group.username}`;

  if (storyViewerImage) {
    storyViewerImage.onclick = null;
    storyViewerImage.style.cursor = 'default';
  }

  const sharedPostCard = document.getElementById('sharedPostStoryCard');
  if (sharedPostCard) sharedPostCard.remove();

  if (story.type === 'post_share' && story.sharedPostAuthor) {
    if (storyViewerImage) {
      storyViewerImage.src = '';
      storyViewerImage.style.display = 'none';
    }

    const card = document.createElement('div');
    card.id = 'sharedPostStoryCard';
    card.className = 'shared-post-story-card';
    card.innerHTML = `
      <div class="shared-post-story-inner">
        <img src="${story.mediaUrl}" class="shared-post-story-img" alt="" />
        <div class="shared-post-story-info">
          <span class="shared-post-story-author">@${escapeHtml(story.sharedPostAuthor)}</span>
          ${story.sharedPostCaption ? `<p class="shared-post-story-caption">${escapeHtml(story.sharedPostCaption)}</p>` : ''}
        </div>
      </div>
    `;
    card.addEventListener('click', () => {
      window.location.href = `user.html?u=${encodeURIComponent(story.sharedPostAuthor)}`;
    });
    if (storyViewerImage && storyViewerImage.parentElement) {
      storyViewerImage.parentElement.appendChild(card);
    }
  } else {
    if (storyViewerImage) {
      storyViewerImage.style.display = 'block';
      storyViewerImage.src = story.mediaUrl;
    }
  }

  const avatarToShow = group.uid === currentUser.uid
    ? (currentProfile.logoUrl || group.logoUrl)
    : group.logoUrl;

  if (avatarToShow) {
    if (storyViewerAvatar) {
      storyViewerAvatar.src = avatarToShow;
      storyViewerAvatar.classList.remove('hidden');
    }
    if (storyViewerPlaceholder) storyViewerPlaceholder.classList.add('hidden');
  } else {
    if (storyViewerAvatar) storyViewerAvatar.classList.add('hidden');
    if (storyViewerPlaceholder) storyViewerPlaceholder.classList.remove('hidden');
  }

  const created = story.createdAt?.toDate ? story.createdAt.toDate() : new Date();
  const hoursAgo = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60)));
  if (storyViewerTime) storyViewerTime.textContent = hoursAgo < 1 ? 'Ora' : `${hoursAgo}h fa`;

  renderProgressBars(group.stories.length, currentStoryIndex);

  const isOwner = group.uid === currentUser.uid;

  if (isOwner) {
    if (storyOwnerBar) storyOwnerBar.classList.remove('hidden');
    if (storyViewerBar) storyViewerBar.classList.add('hidden');
    if (storyViewersCount) storyViewersCount.textContent = (story.viewedBy || []).length;
  } else {
    if (storyOwnerBar) storyOwnerBar.classList.add('hidden');
    if (storyViewerBar) storyViewerBar.classList.remove('hidden');
    
    if (storyLikeBtn) {
      const likes = story.likes || [];
      const isLiked = likes.includes(currentUser.uid);
      storyLikeBtn.classList.toggle('liked', isLiked);
    }

    if (storyRepostBtn) {
      const repostQuery = query(
        collection(db, 'storyReposts'),
        where('uid', '==', currentUser.uid),
        where('storyId', '==', story.id)
      );
      getDocs(repostQuery).then(snap => {
        storyRepostBtn.classList.toggle('reposted', !snap.empty);
      });
    }

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
  if (isOwner && storyViewersCount) {
    storyViewersCount.textContent = (story.viewedBy || []).length;
  }
}

function renderProgressBars(count, activeIdx) {
  if (!storyProgressBar) return;
  storyProgressBar.innerHTML = Array.from({ length: count }, (_, i) => `
    <div class="story-progress-segment">
      <div class="story-progress-fill ${i < activeIdx ? 'filled' : ''} ${i === activeIdx ? 'active' : ''}"></div>
    </div>
  `).join('');
}

function startStoryTimer() {
  clearTimeout(storyTimer);
  isStoryPaused = false;
  if (!storyProgressBar) return;
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
  if (!storyProgressBar) return;
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
  if (storyViewer) storyViewer.classList.add('hidden');
  if (storyViewersPanel) storyViewersPanel.classList.add('hidden');
  if (unsubscribeStoryComments) unsubscribeStoryComments();
}

if (storyViewerClose) {
  storyViewerClose.addEventListener('click', closeStoryViewer);
}

function handleNavTap(e, action) {
  e.stopPropagation();
  action();
}

if (storyNavRight) {
  storyNavRight.addEventListener('click', (e) => handleNavTap(e, nextStory));
  storyNavRight.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleNavTap(e, nextStory);
  });
}

if (storyNavLeft) {
  storyNavLeft.addEventListener('click', (e) => handleNavTap(e, prevStory));
  storyNavLeft.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleNavTap(e, prevStory);
  });
}

if (storyLikeBtn) {
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
}

if (storyRepostBtn) {
  storyRepostBtn.addEventListener('click', async () => {
    const data = getCurrentStoryData();
    if (!data || !data.story) return;
    const { group, story } = data;

    if (group.uid === currentUser.uid) {
      alert('Non puoi repostare le tue stesse storie.');
      return;
    }

    storyRepostBtn.disabled = true;

    try {
      const existingQuery = query(
        collection(db, 'storyReposts'),
        where('uid', '==', currentUser.uid),
        where('storyId', '==', story.id)
      );
      const existingSnap = await getDocs(existingQuery);

      if (!existingSnap.empty) {
        await deleteDoc(doc(db, 'storyReposts', existingSnap.docs[0].id));
        storyRepostBtn.classList.remove('reposted');
      } else {
        await addDoc(collection(db, 'storyReposts'), {
          uid: currentUser.uid,
          storyId: story.id,
          originalUid: group.uid,
          createdAt: serverTimestamp()
        });
        storyRepostBtn.classList.add('reposted');

        await addDoc(collection(db, 'notifications'), {
          toUid: group.uid,
          fromUid: currentUser.uid,
          fromUsername: currentProfile.username || currentProfile.displayName || 'Utente',
          fromLogoUrl: currentProfile.logoUrl || '',
          type: 'story_repost',
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Errore repost storia:', error);
    } finally {
      storyRepostBtn.disabled = false;
    }
  });
}

if (storyTagViewBtn2) {
  storyTagViewBtn2.addEventListener('click', () => {
    const data = getCurrentStoryData();
    if (!data || !data.story) return;
    const tags = data.story.taggedUsernames || [];
    if (tags.length === 0) {
      alert('Nessuna persona taggata in questa storia.');
    } else {
      alert('Persone taggate: ' + tags.map(u => '@' + u).join(', '));
    }
  });
}

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

if (storyCommentSendBtn) {
  storyCommentSendBtn.addEventListener('click', sendStoryComment);
}

if (storyCommentInput) {
  storyCommentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendStoryComment(); }
  });
  storyCommentInput.addEventListener('focus', pauseStoryTimer);
  storyCommentInput.addEventListener('blur', () => { if (!isStoryPaused) startStoryTimer(); });
}

async function openViewersPanel() {
  const data = getCurrentStoryData();
  if (!data || !data.story) return;
  const isOwner = data.group.uid === currentUser.uid;
  if (!isOwner) return;

  pauseStoryTimer();
  if (storyViewersPanel) storyViewersPanel.classList.remove('hidden');
  if (viewersSearchInput) viewersSearchInput.value = '';
  switchViewersTab('views');

  await loadViewersList(data.story);
  loadStoryCommentsForOwner(data.story.id);
}

if (storyViewersBtn) {
  storyViewersBtn.addEventListener('click', openViewersPanel);
}

if (storyDeleteBtn) {
  storyDeleteBtn.addEventListener('click', async () => {
    const data = getCurrentStoryData();
    if (!data || !data.story) return;
    if (!confirm('Vuoi eliminare questa storia?')) return;

    try {
      await deleteDoc(doc(db, 'stories', data.story.id));
      if (data.story.mediaPath) {
        deleteObject(ref(storage, data.story.mediaPath)).catch(() => {});
      }
    } catch (error) {
      console.error('Errore eliminazione storia:', error);
    }
  });
}

let touchStartY = 0;
let touchStartX = 0;
if (storyViewer) {
  storyViewer.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  });
  storyViewer.addEventListener('touchend', (e) => {
    const deltaY = touchStartY - e.changedTouches[0].clientY;
    const deltaX = Math.abs(touchStartX - e.changedTouches[0].clientX);
    if (deltaY > 60 && deltaX < 40) openViewersPanel();
  });

  let mouseStartY = 0;
  let isMouseSwipe = false;
  storyViewer.addEventListener('mousedown', (e) => {
    if (e.target.closest('#storyEditorCanvas') || e.target.closest('.camera-edit-toolbar') || e.target.closest('.camera-text-input')) return;
    mouseStartY = e.clientY;
    isMouseSwipe = true;
  });
  storyViewer.addEventListener('mouseup', (e) => {
    if (!isMouseSwipe) return;
    isMouseSwipe = false;
    const deltaY = mouseStartY - e.clientY;
    if (deltaY > 60) openViewersPanel();
  });
}

if (closeViewersPanelBtn) {
  closeViewersPanelBtn.addEventListener('click', () => {
    storyViewersPanel.classList.add('hidden');
    if (unsubscribeStoryComments) unsubscribeStoryComments();
    startStoryTimer();
  });
}

document.querySelectorAll('.story-viewers-tab').forEach(tab => {
  tab.addEventListener('click', () => switchViewersTab(tab.dataset.tab));
});

function switchViewersTab(tabName) {
  document.querySelectorAll('.story-viewers-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  if (storyViewersList) storyViewersList.classList.toggle('hidden', tabName !== 'views');
  if (storyCommentsOwnerList) storyCommentsOwnerList.classList.toggle('hidden', tabName !== 'comments');
}

async function loadViewersList(story) {
  const viewedBy = story.viewedBy || [];

  if (viewedBy.length === 0) {
    allViewersCache = [];
    if (storyViewersList) storyViewersList.innerHTML = '<p class="search-empty">Nessuna visualizzazione ancora.</p>';
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
  if (!storyViewersList) return;
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

if (viewersSearchInput) {
  viewersSearchInput.addEventListener('input', () => {
    const term = viewersSearchInput.value.trim().toLowerCase();
    if (!term) {
      renderViewersList(allViewersCache);
      return;
    }
    const filtered = allViewersCache.filter(v => (v.data.username || '').toLowerCase().includes(term));
    renderViewersList(filtered);
  });
}

function loadStoryCommentsForOwner(storyId) {
  if (unsubscribeStoryComments) unsubscribeStoryComments();

  const q = query(collection(db, 'stories', storyId, 'comments'), orderBy('createdAt', 'asc'));

  unsubscribeStoryComments = onSnapshot(q, (snapshot) => {
    if (!storyCommentsOwnerList) return;
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

// ===== Invia Post nei Messaggi =====
async function openShareModal(postId) {
  sharingPostId = postId;
  if (shareModal) shareModal.classList.remove('hidden');
  if (shareSearchInput) shareSearchInput.value = '';
  if (shareFriendsList) shareFriendsList.innerHTML = '<p class="search-empty">Caricamento...</p>';

  const freshDoc = await getDoc(doc(db, 'users', currentUser.uid));
  const freshData = freshDoc.exists() ? freshDoc.data() : {};
  const following = freshData.following || [];
  const followers = freshData.followers || [];
  const mutualIds = following.filter(id => followers.includes(id));

  if (mutualIds.length === 0) {
    if (shareFriendsList) shareFriendsList.innerHTML = '';
    if (shareEmptyMsg) shareEmptyMsg.classList.remove('hidden');
    allShareFriends = [];
    return;
  }
  if (shareEmptyMsg) shareEmptyMsg.classList.add('hidden');

  allShareFriends = await Promise.all(mutualIds.map(async (uid) => {
    const d = await getDoc(doc(db, 'users', uid));
    return { uid, data: d.exists() ? d.data() : {} };
  }));

  renderShareFriends(allShareFriends);
}

function renderShareFriends(users) {
  if (!shareFriendsList) return;
  if (users.length === 0) {
    shareFriendsList.innerHTML = '<p class="search-empty">Nessun risultato.</p>';
    return;
  }
  shareFriendsList.innerHTML = users.map(u => `
    <div class="conversation-item" data-uid="${u.uid}">
      ${u.data.logoUrl ? `<img src="${u.data.logoUrl}" class="conversation-avatar" alt="" />` : `<div class="conversation-avatar-placeholder"><i data-lucide="user"></i></div>`}
      <div class="conversation-info"><span class="conversation-username">@${escapeHtml(u.data.username || 'utente')}</span></div>
    </div>
  `).join('');
  lucide.createIcons();

  document.querySelectorAll('#shareFriendsList .conversation-item').forEach(item => {
    item.addEventListener('click', async () => {
      await sendPostToChat(item.dataset.uid, sharingPostId);
      if (shareModal) shareModal.classList.add('hidden');
    });
  });
}

if (shareSearchInput) {
  shareSearchInput.addEventListener('input', () => {
    const term = shareSearchInput.value.trim().toLowerCase();
    if (!term) { renderShareFriends(allShareFriends); return; }
    renderShareFriends(allShareFriends.filter(u => (u.data.username || '').toLowerCase().includes(term)));
  });
}

if (closeShareBtn) {
  closeShareBtn.addEventListener('click', () => shareModal.classList.add('hidden'));
}
if (shareModal) {
  shareModal.addEventListener('click', (e) => { if (e.target === shareModal) shareModal.classList.add('hidden'); });
}

async function sendPostToChat(otherUid, postId) {
  const postDoc = await getDoc(doc(db, 'posts', postId));
  if (!postDoc.exists()) return;
  const post = postDoc.data();
  const media = getPostMedia(post);

  const convId = conversationIdFor(currentUser.uid, otherUid);
  const convRef = doc(db, 'conversations', convId);
  const convDoc = await getDoc(convRef);

  if (!convDoc.exists()) {
    await setDoc(convRef, {
      participants: [currentUser.uid, otherUid],
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      unread: { [currentUser.uid]: 0, [otherUid]: 0 }
    });
  }

  await addDoc(collection(db, 'conversations', convId, 'messages'), {
    from: currentUser.uid,
    type: 'shared_post',
    postId,
    postPhotoUrl: media[0]?.url || '',
    postCaption: post.caption || '',
    postAuthor: post.authorName || '',
    createdAt: serverTimestamp()
  });

  await updateDoc(convRef, {
    lastMessage: '📤 Post condiviso',
    lastMessageAt: serverTimestamp(),
    [`unread.${otherUid}`]: increment(1)
  });
}

// ===== Gestione Tag Prodotti sui Post =====
function attachProductTagListeners() {
  document.querySelectorAll('.add-product-tag-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllMenus();
      const postId = btn.dataset.id;
      enableProductTaggingMode(postId);
    });
  });
}

function enableProductTaggingMode(postId) {
  const container = document.querySelector(`.carousel-container[data-carousel-id="${postId}"]`);
  if (!container) return;

  alert('Tocca il punto della foto in cui vuoi inserire il link!');
  container.style.cursor = 'crosshair';

  const clickHandler = async (e) => {
    if (e.target.closest('.carousel-arrow') || e.target.closest('.carousel-dots')) return;

    const track = container.querySelector('.carousel-track');
    const activeSlideIndex = track ? Math.round(track.scrollLeft / track.clientWidth) : 0;
    const slides = container.querySelectorAll('.carousel-slide');
    const currentSlide = slides[activeSlideIndex] || container;

    const rect = currentSlide.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const label = prompt('Nome del prodotto (es: Maglia Zara):');
    if (!label) {
      cleanup();
      return;
    }

    let url = prompt('Inserisci il link del sito web (es: https://...):');
    if (!url) {
      cleanup();
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const newTag = {
      label: label.trim(),
      url: url.trim(),
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      slideIndex: activeSlideIndex,
      addedBy: currentProfile.username || currentUser.email.split('@')[0],
      createdAt: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, 'posts', postId), {
        productTags: arrayUnion(newTag)
      });
      alert('Tag prodotto aggiunto!');
    } catch (err) {
      console.error('Errore salvataggio tag prodotto:', err);
      alert('Errore durante il salvataggio.');
    } finally {
      cleanup();
    }
  };

  function cleanup() {
    container.style.cursor = 'default';
    container.removeEventListener('click', clickHandler);
  }

  container.addEventListener('click', clickHandler, { once: true });
}
// Aggiungi o sostituisci questa funzione nei file .js
function verifiedBadgeHtml(isVerified) {
  if (!isVerified) return '';
  return `
    <div class="verified-crown-container">
      <img 
        src="assets/images/verified-badge.webp" 
        alt="Account Verificato" 
        class="verified-crown-icon"
      >
    </div>
  `;
}
// Invio dello sticker come commento
async function sendCommentSticker(postId, stickerTextOrUrl) {
  if (!postId || !currentUser) return;

  try {
    await addDoc(collection(db, 'posts', postId, 'comments'), {
      uid: currentUser.uid,
      authorName: currentProfile.username || currentUser.email.split('@')[0],
      type: 'sticker',
      sticker: stickerTextOrUrl,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, 'posts', postId), {
      commentCount: increment(1)
    });
  } catch (error) {
    console.error("Errore invio sticker commento:", error);
  }
}

// Click sull'icona sticker nei commenti
if (commentStickerBtn) {
  commentStickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activeCommentsPostId) return;

    // Apre il pannello sticker di messages o la funzione picker
    const sticker = prompt("Scegli un'emoji/sticker da inviare:", "🔥");
    if (sticker) {
      sendCommentSticker(activeCommentsPostId, sticker);
    }
  });
}
// Invio commento di testo classico
if (commentForm) {
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeCommentsPostId || !currentUser) return;

    const text = commentInput.value.trim();
    if (!text) return;

    try {
      await addDoc(collection(db, 'posts', activeCommentsPostId, 'comments'), {
        uid: currentUser.uid,
        authorName: currentProfile.username || currentUser.email.split('@')[0],
        userPhoto: currentProfile.logoUrl || '',
        isVerified: currentProfile.username === 'elisabel_messa',
        type: 'text',
        text: text,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'posts', activeCommentsPostId), {
        commentCount: increment(1)
      });

      commentInput.value = '';
    } catch (error) {
      console.error("Errore nell'invio del commento:", error);
    }
  });
}

// Invio Sticker come Commento
async function sendCommentSticker(postId, stickerUrl) {
  if (!postId || !currentUser) return;

  try {
    await addDoc(collection(db, 'posts', postId, 'comments'), {
      uid: currentUser.uid,
      authorName: currentProfile.username || currentUser.email.split('@')[0],
      userPhoto: currentProfile.logoUrl || '',
      isVerified: currentProfile.username === 'elisabel_messa',
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

// Click sull'icona sticker nei commenti
const commentStickerBtn = document.getElementById('commentStickerBtn');
if (commentStickerBtn) {
  commentStickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activeCommentsPostId) return;

    openStickerModal(commentStickerBtn, (selectedUrl) => {
      sendCommentSticker(activeCommentsPostId, selectedUrl);
    });
  });
}