import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy,
  onSnapshot, addDoc, serverTimestamp, increment, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { escapeHtml, formatDate } from './utils.js';

const logoutBtn = document.getElementById('logoutBtn');
const profilePageContent = document.getElementById('profilePageContent');
const commentsModal = document.getElementById('commentsModal');
const closeCommentsBtn = document.getElementById('closeCommentsBtn');
const commentsList = document.getElementById('commentsList');
const commentForm = document.getElementById('commentForm');
const commentInput = document.getElementById('commentInput');

lucide.createIcons();

let currentUser = null;
let currentProfile = { displayName: '', logoUrl: '', username: '' };
let viewedUid = null;
let viewedUsername = null;
let activeCommentsPostId = null;
let unsubscribeComments = null;

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'login.html';
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;

  const myDoc = await getDoc(doc(db, 'users', user.uid));
  if (myDoc.exists()) currentProfile = myDoc.data();

  const params = new URLSearchParams(window.location.search);
  const username = params.get('u');

  if (!username) {
    profilePageContent.innerHTML = '<p style="color:#ef4444; text-align:center;">Utente non specificato.</p>';
    return;
  }

  const usernameDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  if (!usernameDoc.exists()) {
    profilePageContent.innerHTML = '<p style="color:#ef4444; text-align:center;">Utente non trovato.</p>';
    return;
  }

  viewedUid = usernameDoc.data().uid;
  viewedUsername = username.toLowerCase();

  // Se è il mio stesso profilo, reindirizzo alla pagina "Profilo"
  if (viewedUid === currentUser.uid) {
    window.location.href = 'profile.html';
    return;
  }

  renderProfile();
});

async function renderProfile() {
  const userDoc = await getDoc(doc(db, 'users', viewedUid));
  const data = userDoc.exists() ? userDoc.data() : {};

  const followers = data.followers || [];
  const following = data.following || [];
  const isFollowing = followers.includes(currentUser.uid);

  profilePageContent.innerHTML = `
    <div class="profile-top-row">
      <div class="profile-username-block">
        <span class="profile-username">@${escapeHtml(data.username || viewedUsername)}</span>
      </div>

      <div class="profile-avatar-block">
        ${data.logoUrl
          ? `<img src="${data.logoUrl}" class="profile-avatar-lg" alt="Logo profilo" />`
          : `<div class="profile-logo-placeholder-lg"><i data-lucide="user"></i></div>`
        }
      </div>

      <div class="profile-stats">
        <div class="stat-item">
          <span class="stat-number" id="userStatPosts">0</span>
          <span class="stat-label">Post</span>
        </div>
        <div class="stat-item">
          <span class="stat-number" id="userStatFollowers">${followers.length}</span>
          <span class="stat-label">Follower</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">${following.length}</span>
          <span class="stat-label">Seguiti</span>
        </div>
      </div>
    </div>

    <p class="profile-bio">${escapeHtml(data.bio || '')}</p>

    <button type="button" class="edit-profile-btn ${isFollowing ? 'following-btn' : ''}" id="followBtn">
      ${isFollowing ? 'Segui già' : 'Segui'}
    </button>

    <div class="profile-posts-section">
      <div id="userPostsLoader" class="loader hidden">
        <div class="spinner"></div>
      </div>
      <div class="posts-grid" id="userPostsGrid"></div>
    </div>
  `;

  lucide.createIcons();

  document.getElementById('followBtn').addEventListener('click', toggleFollow);

  startListeningToUserPosts();
}

async function toggleFollow() {
  const followBtn = document.getElementById('followBtn');
  followBtn.disabled = true;

  const targetRef = doc(db, 'users', viewedUid);
  const myRef = doc(db, 'users', currentUser.uid);

  const targetDoc = await getDoc(targetRef);
  const followers = targetDoc.data()?.followers || [];
  const isFollowing = followers.includes(currentUser.uid);

  try {
    if (isFollowing) {
      await updateDoc(targetRef, { followers: arrayRemove(currentUser.uid) });
      await updateDoc(myRef, { following: arrayRemove(viewedUid) });
    } else {
      await updateDoc(targetRef, { followers: arrayUnion(currentUser.uid) });
      await updateDoc(myRef, { following: arrayUnion(viewedUid) });

      await addDoc(collection(db, 'notifications'), {
        toUid: viewedUid,
        fromUid: currentUser.uid,
        fromUsername: currentProfile.username || currentProfile.displayName || 'Utente',
        fromLogoUrl: currentProfile.logoUrl || '',
        type: 'follow',
        read: false,
        createdAt: serverTimestamp()
      });
    }
    renderProfile();
  } catch (error) {
    console.error('Errore nel follow:', error);
    followBtn.disabled = false;
  }
}

function startListeningToUserPosts() {
  const postsQuery = query(
    collection(db, 'posts'),
    where('uid', '==', viewedUid),
    orderBy('createdAt', 'desc')
  );

  const loader = document.getElementById('userPostsLoader');
  const grid = document.getElementById('userPostsGrid');
  loader.classList.remove('hidden');

  onSnapshot(postsQuery, (snapshot) => {
    loader.classList.add('hidden');
    document.getElementById('userStatPosts').textContent = snapshot.size;

    if (snapshot.empty) {
      grid.innerHTML = '<p style="color:#94a3b8;">Nessun post pubblicato.</p>';
      return;
    }

    grid.innerHTML = snapshot.docs.map(docSnap => {
      const post = docSnap.data();
      const id = docSnap.id;
      const likes = post.likes || [];
      const isLiked = likes.includes(currentUser.uid);
      const commentCount = post.commentCount || 0;

      return `
        <article class="post-card">
          <div class="post-header">
            <span class="post-date">${formatDate(post.createdAt)}</span>
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
    attachPostActionListeners();
  });
}

function attachPostActionListeners() {
  document.querySelectorAll('#userPostsGrid .like-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.id;
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      const postData = postDoc.data();
      const likes = postData?.likes || [];
      const isLiked = likes.includes(currentUser.uid);

      await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
      });

      if (!isLiked) {
        await addDoc(collection(db, 'notifications'), {
          toUid: viewedUid,
          fromUid: currentUser.uid,
          fromUsername: currentProfile.username || currentProfile.displayName || 'Utente',
          fromLogoUrl: currentProfile.logoUrl || '',
          type: 'like',
          postId,
          read: false,
          createdAt: serverTimestamp()
        });
      }
    });
  });

  document.querySelectorAll('#userPostsGrid .comment-btn').forEach(btn => {
    btn.addEventListener('click', () => openComments(btn.dataset.id));
  });
}

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
      authorName: currentProfile.username || currentProfile.displayName || currentUser.email?.split('@')[0] || 'Utente',
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