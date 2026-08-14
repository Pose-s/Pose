import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy,
  onSnapshot, addDoc, serverTimestamp, increment, arrayUnion, arrayRemove,
  deleteDoc, getDocs
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { escapeHtml, formatDate } from './utils.js';

const logoutBtn = document.getElementById('logoutBtn');
const profilePageContent = document.getElementById('profilePageContent');
const commentsModal = document.getElementById('commentsModal');
const closeCommentsBtn = document.getElementById('closeCommentsBtn');
const commentsList = document.getElementById('commentsList');
const commentForm = document.getElementById('commentForm');
const commentInput = document.getElementById('commentInput');
const commentsPostMedia = document.getElementById('commentsPostMedia');
const commentsPostCaption = document.getElementById('commentsPostCaption');

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

const shareModal = document.getElementById('shareModal');
const closeShareBtn = document.getElementById('closeShareBtn');
const shareSearchInput = document.getElementById('shareSearchInput');
const shareEmptyMsg = document.getElementById('shareEmptyMsg');
const shareFriendsList = document.getElementById('shareFriendsList');

lucide.createIcons();

let currentUser = null;
let currentProfile = { displayName: '', logoUrl: '', username: '' };
let viewedUid = null;
let viewedUsername = null;
let activeCommentsPostId = null;
let unsubscribeComments = null;
let currentlyBlocked = false;
let postsCacheUser = new Map();
let sharingPostId = null;
let allShareFriends = [];
let savedPostIds = new Set();

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

  await loadSavedPosts();

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

function getPostMedia(post) {
  if (post.media && post.media.length > 0) return post.media;
  if (post.photoUrl) return [{ type: 'photo', url: post.photoUrl, path: post.photoPath || '' }];
  return [];
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

// ===== Repost + Tag =====
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
      closeAllPostMenus();
      const postId = btn.dataset.id;
      const post = cache.get(postId);
      const tags = post?.taggedUsernames || [];
      if (tags.length === 0) {
        alert('Nessuna persona taggata in questo post.');
      } else {
        alert('Persone taggate: ' + tags.map(u => '@' + u).join(', '));
      }
    });
  });
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
    startListeningToUserPosts(data);
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

function startListeningToUserPosts(ownerData) {
  const postsQuery = query(
    collection(db, 'posts'),
    where('uid', '==', viewedUid),
    orderBy('createdAt', 'desc')
  );

  const loader = document.getElementById('userPostsLoader');
  const grid = document.getElementById('userPostsGrid');
  loader.classList.remove('hidden');

  onSnapshot(postsQuery, async (snapshot) => {
    loader.classList.add('hidden');
    document.getElementById('userStatPosts').textContent = snapshot.size;
    postsCacheUser.clear();

    if (snapshot.empty) {
      grid.innerHTML = '<p style="color:#94a3b8;">Nessun post pubblicato.</p>';
      return;
    }

    snapshot.docs.forEach(docSnap => {
      postsCacheUser.set(docSnap.id, docSnap.data());
    });

    grid.innerHTML = snapshot.docs.map(docSnap => {
      const post = docSnap.data();
      const id = docSnap.id;

      const likes = post.likes || [];
      const isLiked = likes.includes(currentUser.uid);
      const commentCount = post.commentCount || 0;
      const isSaved = savedPostIds.has(id);

      return `
        <article class="post-card">
          <div class="post-header">
            ${ownerData && ownerData.logoUrl
              ? `<img src="${ownerData.logoUrl}" class="post-logo" alt="Logo" loading="lazy" />`
              : `<div class="post-logo-placeholder"><i data-lucide="user"></i></div>`
            }
            <div class="post-header-info">
              <a href="user.html?u=${encodeURIComponent(viewedUsername)}" class="post-author" onclick="event.stopPropagation()">${escapeHtml(viewedUsername)}</a>
              <span class="post-date">${formatDate(post.createdAt)}</span>
            </div>
            <div class="post-menu">
              <button class="post-menu-btn" data-id="${id}">
                <i data-lucide="more-vertical"></i>
              </button>
              <div class="post-menu-dropdown hidden" data-menu-for="${id}">
                <button class="menu-item repost-story-btn" data-id="${id}">
                  <i data-lucide="clapperboard"></i> Pubblica nelle storie
                </button>
                <button class="menu-item tag-view-btn" data-id="${id}">
                  <i data-lucide="tag"></i> Tag
                </button>
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
    attachPostActionListeners();
    attachCarouselListeners();
    attachSaveListeners('#userPostsGrid');
    await attachRepostAndTagListeners('#userPostsGrid', postsCacheUser);
  });
}

function attachPostActionListeners() {
  document.querySelectorAll('#userPostsGrid .post-media-clickable').forEach(el => {
    el.addEventListener('click', () => openComments(el.dataset.id));
  });

  document.querySelectorAll('#userPostsGrid .post-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const dropdown = document.querySelector(`.post-menu-dropdown[data-menu-for="${id}"]`);
      closeAllPostMenus();
      dropdown.classList.toggle('hidden');
    });
  });

  document.querySelectorAll('.repost-story-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    closeAllMenus();

    const postId = btn.dataset.id;
    const post = postsCacheUser.get(postId);
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

  document.querySelectorAll('#userPostsGrid .like-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
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
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openComments(btn.dataset.id);
    });
  });

  document.querySelectorAll('#userPostsGrid .share-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openShareModal(btn.dataset.id);
    });
  });
}

function closeAllPostMenus() {
  document.querySelectorAll('#userPostsGrid .post-menu-dropdown').forEach(d => d.classList.add('hidden'));
}

document.addEventListener('click', closeAllPostMenus);

// ===== Dettaglio post + Commenti =====
function openComments(postId) {
  activeCommentsPostId = postId;
  commentsModal.classList.remove('hidden');

  const post = postsCacheUser.get(postId);
  if (post) {
    commentsPostMedia.innerHTML = renderMediaCarousel(getPostMedia(post), 'detail-' + postId);
    if (post.caption) {
      commentsPostCaption.textContent = post.caption;
      commentsPostCaption.classList.remove('hidden');
    } else {
      commentsPostCaption.classList.add('hidden');
    }
    lucide.createIcons();
    attachCarouselListeners();
  }

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

// ===== Segnalazione =====
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

// ===== Invia post nei messaggi =====
async function openShareModal(postId) {
  sharingPostId = postId;
  shareModal.classList.remove('hidden');
  shareSearchInput.value = '';
  shareFriendsList.innerHTML = '<p class="search-empty">Caricamento...</p>';

  const freshDoc = await getDoc(doc(db, 'users', currentUser.uid));
  const freshData = freshDoc.exists() ? freshDoc.data() : {};
  const following = freshData.following || [];
  const followers = freshData.followers || [];
  const mutualIds = following.filter(id => followers.includes(id));

  if (mutualIds.length === 0) {
    shareFriendsList.innerHTML = '';
    shareEmptyMsg.classList.remove('hidden');
    allShareFriends = [];
    return;
  }
  shareEmptyMsg.classList.add('hidden');

  allShareFriends = await Promise.all(mutualIds.map(async (uid) => {
    const d = await getDoc(doc(db, 'users', uid));
    return { uid, data: d.exists() ? d.data() : {} };
  }));

  renderShareFriends(allShareFriends);
}

function renderShareFriends(users) {
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
      shareModal.classList.add('hidden');
    });
  });
}

shareSearchInput.addEventListener('input', () => {
  const term = shareSearchInput.value.trim().toLowerCase();
  if (!term) { renderShareFriends(allShareFriends); return; }
  renderShareFriends(allShareFriends.filter(u => (u.data.username || '').toLowerCase().includes(term)));
});

closeShareBtn.addEventListener('click', () => shareModal.classList.add('hidden'));
shareModal.addEventListener('click', (e) => { if (e.target === shareModal) shareModal.classList.add('hidden'); });

async function sendPostToChat(otherUid, postId) {
  const postData = postsCacheUser.get(postId);
  if (!postData) return;
  const media = getPostMedia(postData);

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
    postCaption: postData.caption || '',
    postAuthor: viewedUsername || '',
    createdAt: serverTimestamp()
  });

  await updateDoc(convRef, {
    lastMessage: '📤 Post condiviso',
    lastMessageAt: serverTimestamp(),
    [`unread.${otherUid}`]: increment(1)
  });
}
const tagChoiceModal = document.getElementById('tagChoiceModal');
const closeTagChoiceBtn = document.getElementById('closeTagChoiceBtn');
const viewTagsChoiceBtn = document.getElementById('viewTagsChoiceBtn');
const addTagsChoiceBtn = document.getElementById('addTagsChoiceBtn');
let activeTagPostId = null;
let activeTagCache = null;

function openTagChoiceModal(postId, cache) {
  activeTagPostId = postId;
  activeTagCache = cache;
  tagChoiceModal.classList.remove('hidden');
}

closeTagChoiceBtn.addEventListener('click', () => tagChoiceModal.classList.add('hidden'));
tagChoiceModal.addEventListener('click', (e) => { if (e.target === tagChoiceModal) tagChoiceModal.classList.add('hidden'); });

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

addTagsChoiceBtn.addEventListener('click', () => {
  tagChoiceModal.classList.add('hidden');
  const post = activeTagCache.get(activeTagPostId);
  pendingTaggedUsers = (post?.taggedUids || []).map((uid, i) => ({ uid, username: (post?.taggedUsernames || [])[i] || '' }));

  tagModal.classList.remove('hidden');
  tagSearchInput.value = '';
  tagResultsList.innerHTML = '';
  renderTaggedSelected();
});