import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy,
  onSnapshot, addDoc, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { escapeHtml } from './utils.js';

const logoutBtn = document.getElementById('logoutBtn');
const conversationsList = document.getElementById('conversationsList');
const newMessageBtn = document.getElementById('newMessageBtn');
const newMessageModal = document.getElementById('newMessageModal');
const closeNewMessageBtn = document.getElementById('closeNewMessageBtn');
const mutualFriendsList = document.getElementById('mutualFriendsList');
const mutualEmptyMsg = document.getElementById('mutualEmptyMsg');

const chatEmpty = document.getElementById('chatEmpty');
const chatActive = document.getElementById('chatActive');
const chatBackBtn = document.getElementById('chatBackBtn');
const chatHeaderAvatar = document.getElementById('chatHeaderAvatar');
const chatHeaderPlaceholder = document.getElementById('chatHeaderPlaceholder');
const chatHeaderUsername = document.getElementById('chatHeaderUsername');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

lucide.createIcons();

let currentUser = null;
let currentProfile = {};
let activeConversationId = null;
let activeOtherUid = null;
let unsubscribeMessages = null;

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
  currentProfile = myDoc.exists() ? myDoc.data() : {};

  startListeningToConversations();
});

function conversationIdFor(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

// ===== Lista conversazioni =====
function startListeningToConversations() {
  const convQuery = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', currentUser.uid),
    orderBy('lastMessageAt', 'desc')
  );

  onSnapshot(convQuery, async (snapshot) => {
    if (snapshot.empty) {
      conversationsList.innerHTML = '<p class="search-empty">Nessuna conversazione ancora.</p>';
      return;
    }

    const rows = await Promise.all(snapshot.docs.map(async (docSnap) => {
      const conv = docSnap.data();
      const otherUid = conv.participants.find(id => id !== currentUser.uid);
      const otherDoc = await getDoc(doc(db, 'users', otherUid));
      const otherData = otherDoc.exists() ? otherDoc.data() : {};
      const unread = (conv.unread && conv.unread[currentUser.uid]) || 0;

      return { id: docSnap.id, otherUid, otherData, lastMessage: conv.lastMessage || '', unread };
    }));

    conversationsList.innerHTML = rows.map(row => `
      <div class="conversation-item ${row.unread > 0 ? 'unread' : ''}" data-id="${row.id}" data-uid="${row.otherUid}">
        ${row.otherData.logoUrl
          ? `<img src="${row.otherData.logoUrl}" class="conversation-avatar" alt="" />`
          : `<div class="conversation-avatar-placeholder"><i data-lucide="user"></i></div>`
        }
        <div class="conversation-info">
          <span class="conversation-username">@${escapeHtml(row.otherData.username || 'utente')}</span>
          <span class="conversation-preview">${escapeHtml(row.lastMessage)}</span>
        </div>
        ${row.unread > 0 ? `<span class="conversation-badge">${row.unread}</span>` : ''}
      </div>
    `).join('');

    lucide.createIcons();

    document.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => openChat(item.dataset.id, item.dataset.uid));
    });
  });
}

// ===== Nuovo messaggio: lista follow reciproci =====
newMessageBtn.addEventListener('click', async () => {
  newMessageModal.classList.remove('hidden');
  mutualFriendsList.innerHTML = '<p class="search-empty">Caricamento...</p>';

  const following = currentProfile.following || [];
  const followers = currentProfile.followers || [];
  const mutualIds = following.filter(id => followers.includes(id));

  if (mutualIds.length === 0) {
    mutualFriendsList.innerHTML = '';
    mutualEmptyMsg.classList.remove('hidden');
    return;
  }

  mutualEmptyMsg.classList.add('hidden');

  const users = await Promise.all(mutualIds.map(async (uid) => {
    const d = await getDoc(doc(db, 'users', uid));
    return { uid, data: d.exists() ? d.data() : {} };
  }));

  mutualFriendsList.innerHTML = users.map(u => `
    <div class="conversation-item" data-uid="${u.uid}">
      ${u.data.logoUrl
        ? `<img src="${u.data.logoUrl}" class="conversation-avatar" alt="" />`
        : `<div class="conversation-avatar-placeholder"><i data-lucide="user"></i></div>`
      }
      <div class="conversation-info">
        <span class="conversation-username">@${escapeHtml(u.data.username || 'utente')}</span>
      </div>
    </div>
  `).join('');

  lucide.createIcons();

  document.querySelectorAll('#mutualFriendsList .conversation-item').forEach(item => {
    item.addEventListener('click', async () => {
      const otherUid = item.dataset.uid;
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

      newMessageModal.classList.add('hidden');
      openChat(convId, otherUid);
    });
  });
});

closeNewMessageBtn.addEventListener('click', () => newMessageModal.classList.add('hidden'));
newMessageModal.addEventListener('click', (e) => { if (e.target === newMessageModal) newMessageModal.classList.add('hidden'); });

// ===== Apertura chat =====
async function openChat(convId, otherUid) {
  activeConversationId = convId;
  activeOtherUid = otherUid;

  chatEmpty.classList.add('hidden');
  chatActive.classList.remove('hidden');
  document.getElementById('chatPanel').classList.add('mobile-active');

  const otherDoc = await getDoc(doc(db, 'users', otherUid));
  const otherData = otherDoc.exists() ? otherDoc.data() : {};

  chatHeaderUsername.textContent = `@${otherData.username || 'utente'}`;
  if (otherData.logoUrl) {
    chatHeaderAvatar.src = otherData.logoUrl;
    chatHeaderAvatar.classList.remove('hidden');
    chatHeaderPlaceholder.classList.add('hidden');
  } else {
    chatHeaderAvatar.classList.add('hidden');
    chatHeaderPlaceholder.classList.remove('hidden');
  }

  // Azzera non letti per me
  updateDoc(doc(db, 'conversations', convId), {
    [`unread.${currentUser.uid}`]: 0
  }).catch(() => {});

  if (unsubscribeMessages) unsubscribeMessages();

  const messagesQuery = query(
    collection(db, 'conversations', convId, 'messages'),
    orderBy('createdAt', 'asc')
  );

  unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
    chatMessages.innerHTML = snapshot.docs.map(docSnap => {
      const m = docSnap.data();
      const isMine = m.from === currentUser.uid;
      return `<div class="chat-bubble ${isMine ? 'mine' : 'theirs'}">${escapeHtml(m.text)}</div>`;
    }).join('');

    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

chatBackBtn.addEventListener('click', () => {
    document.getElementById('chatPanel').classList.remove('mobile-active');
  chatActive.classList.add('hidden');
  chatEmpty.classList.remove('hidden');
  if (unsubscribeMessages) unsubscribeMessages();
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeConversationId) return;

  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';

  try {
    await addDoc(collection(db, 'conversations', activeConversationId, 'messages'), {
      from: currentUser.uid,
      text,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, 'conversations', activeConversationId), {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      [`unread.${activeOtherUid}`]: increment(1)
    });
  } catch (error) {
    console.error('Errore invio messaggio:', error);
  }
});