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

const userOptionsBtn = document.getElementById('userOptionsBtn');
const userOptionsDropdown = document.getElementById('userOptionsDropdown');
const blockToggleBtn = document.getElementById('blockToggleBtn');
const reportBtn = document.getElementById('reportBtn');
const reportModal = document.getElementById('reportModal');
const closeReportBtn = document.getElementById('closeReportBtn');
const reportForm = document.getElementById('reportForm');
const reportReasonSelect = document.getElementById('reportReasonSelect');
const reportDetailsInput = document.getElementById('reportDetailsInput');
const reportMsg = document.getElementById('reportMsg');
const reportSubmitBtn = document.getElementById('reportSubmitBtn');

lucide.createIcons();

let currentUser = null;
let currentProfile = { displayName: '', logoUrl: '', username: '' };
let viewedUid = null;
let viewedUsername = null;
let activeCommentsPostId = null;
let unsubscribeComments = null;
let currentlyBlocked = false;

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'login.html';
});

userOptionsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  userOptionsDropdown.classList.toggle('hidden');
});

document.addEventListener('click', () => {
  userOptionsDropdown.classList.add('hidden');
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

  if (viewedUid === currentUser.uid) {
    window.location.href = 'profile.html';
    return;
  }

  renderProfile();
});

function conversationIdFor(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

async function renderProfile() {
  const userDoc = await getDoc(doc(db, 'users', viewedUid));
  const data = userDoc.exists() ? userDoc.data() : {};

  const followers = data.followers || [];
  const following = data.following || [];
  const isFollowing = followers.includes(currentUser.uid);
  const isFollowedByThem = following.includes(currentUser.uid);
  const isMutual = isFollowing && isFollowedByThem;

  const myFreshDoc = await getDoc(doc(db, 'users', currentUser.uid));
  const myData = myFreshDoc.exists() ? myFreshDoc.data() : {};
  const myBlocked = myData.blockedUsers || [];
  currentlyBlocked = myBlocked.includes(viewedUid);

  blockToggleBtn.textContent = currentlyBlocked ? 'Sblocca' : 'Blocca';

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

    <div class="profile-action-row">
      <button type="button" class="btn-compact ${isFollowing ? 'following-btn' : ''}" id="followBtn">
        ${isFollowing ? 'Segui già' : 'Segui'}
      </button>
      <button type="button" class="btn-compact" id="messageBtn">
        Messaggio
      </button>
    </div>

    <div class="profile-posts-section">
      <div id="userPostsLoader" class="loader hidden">
        <div class="spinner"></div>
      </div>
      <div class="posts-grid" id="userPostsGrid"></div>
    </div>
  `;

  lucide.createIcons();

  document.getElementById('followBtn').addEventListener('click', toggleFollow);

  document.getElementById('messageBtn').addEventListener('click', async () => {
    if (!isMutual) {
      alert('Potete scrivervi solo se vi seguite a vicenda.');
      return;
    }

    const convId = conversationIdFor(currentUser.uid, viewedUid);
    const convRef = doc(db, 'conversations', convId);
    const convDoc = await getDoc(convRef);

    if (!convDoc.exists()) {
      await setDoc(convRef, {
        participants: [currentUser.uid, viewedUid],
        lastMessage: '',
        lastMessageAt: serverTimestamp(),
        unread: { [currentUser.uid]: 0, [viewedUid]: 0 }
      });
    }

    window.location.href = `messages.html?u=${encodeURIComponent(viewedUsername)}`;
  });

  blockToggleBtn.onclick = async () => {
    blockToggleBtn.disabled = true;

    try {
      if (currentlyBlocked) {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          blockedUsers: arrayRemove(viewedUid)
        });
      } else {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          blockedUsers: arrayUnion(viewedUid)
        });
        await updateDoc(doc(db, 'users', viewedUid), {
          followers: arrayRemove(currentUser.uid)
        }).catch(() => {});
        await updateDoc(doc(db, 'users', currentUser.uid), {
          following: arrayRemove(viewedUid)
        }).catch(() => {});
      }
      userOptionsDropdown.classList.add('hidden');
      renderProfile();
    } catch (error) {
      console.error('Errore blocco utente:', error);
      blockToggleBtn.disabled = false;
    }
  };

  if (!currentlyBlocked) {
    startListeningToUserPosts();
  } else {
    document.getElementById('userPostsGrid').innerHTML = '<p style="color:#94a3b8;">Hai bloccato questo utente.</p>';
  }
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
reportBtn.addEventListener('click', () => {
  userOptionsDropdown.classList.add('hidden');
  reportModal.classList.remove('hidden');
  reportForm.reset();
  reportMsg.classList.add('hidden');
});

closeReportBtn.addEventListener('click', () => reportModal.classList.add('hidden'));
reportModal.addEventListener('click', (e) => { if (e.target === reportModal) reportModal.classList.add('hidden'); });

reportForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  reportMsg.classList.add('hidden');
  reportSubmitBtn.disabled = true;
  reportSubmitBtn.textContent = 'Invio in corso...';

  try {
    await addDoc(collection(db, 'reports'), {
      reportedUid: viewedUid,
      reportedUsername: viewedUsername,
      reporterUid: currentUser.uid,
      reason: reportReasonSelect.value,
      details: reportDetailsInput.value.trim(),
      status: 'pending',
      createdAt: serverTimestamp()
    });

    reportMsg.textContent = 'Segnalazione inviata. Grazie per averci avvisato.';
    reportMsg.classList.remove('hidden', 'auth-error');
    reportMsg.classList.add('auth-success');

    setTimeout(() => reportModal.classList.add('hidden'), 1500);
  } catch (error) {
    console.error('Errore invio segnalazione:', error);
    reportMsg.textContent = 'Errore durante l\'invio. Riprova.';
    reportMsg.classList.remove('hidden');
  } finally {
    reportSubmitBtn.disabled = false;
    reportSubmitBtn.textContent = 'Invia segnalazione';
  }
});