import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { escapeHtml, formatDate } from './utils.js';

const logoutBtn = document.getElementById('logoutBtn');
const savedGrid = document.getElementById('savedGrid');
const savedLoader = document.getElementById('savedLoader');

lucide.createIcons();

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'login.html';
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  savedLoader.classList.remove('hidden');

  const myDoc = await getDoc(doc(db, 'users', user.uid));
  const data = myDoc.exists() ? myDoc.data() : {};
  const savedIds = data.savedPosts || [];

  if (savedIds.length === 0) {
    savedLoader.classList.add('hidden');
    savedGrid.innerHTML = '<p style="color:#94a3b8;">Nessun post salvato.</p>';
    return;
  }

  const posts = await Promise.all(savedIds.map(async (id) => {
    const d = await getDoc(doc(db, 'posts', id));
    return d.exists() ? { id, ...d.data() } : null;
  }));

  savedLoader.classList.add('hidden');

  const validPosts = posts.filter(p => p);

  if (validPosts.length === 0) {
    savedGrid.innerHTML = '<p style="color:#94a3b8;">Nessun post salvato.</p>';
    return;
  }

  savedGrid.innerHTML = validPosts.map(post => {
    const media = (post.media && post.media.length > 0) ? post.media : (post.photoUrl ? [{ url: post.photoUrl, type: 'photo' }] : []);
    const first = media[0];
    return `
      <a href="user.html?u=${encodeURIComponent(post.authorName || '')}" class="post-card" style="text-decoration:none; display:block;">
        ${first
          ? (first.type === 'video'
              ? `<video src="${first.url}" class="post-photo" muted></video>`
              : `<img src="${first.url}" class="post-photo" alt="Post" loading="lazy" />`)
          : ''
        }
        <p class="post-caption">@${escapeHtml(post.authorName || 'utente')}</p>
      </a>
    `;
  }).join('');
});