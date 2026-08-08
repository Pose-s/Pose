import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy,
  onSnapshot, addDoc, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";
import { escapeHtml, compressImage } from './utils.js';

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

const voiceBtn = document.getElementById('voiceBtn');
const photoLeftBtn = document.getElementById('photoLeftBtn');
const photoRightBtn = document.getElementById('photoRightBtn');
const chatPhotoInput = document.getElementById('chatPhotoInput');
const stickerBtn = document.getElementById('stickerBtn');
const stickerPicker = document.getElementById('stickerPicker');

lucide.createIcons();

let currentUser = null;
let currentProfile = {};
let activeConversationId = null;
let activeOtherUid = null;
let otherAvatarUrl = '';
let unsubscribeMessages = null;

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

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
  otherAvatarUrl = otherData.logoUrl || '';

  chatHeaderUsername.textContent = `@${otherData.username || 'utente'}`;
  if (otherAvatarUrl) {
    chatHeaderAvatar.src = otherAvatarUrl;
    chatHeaderAvatar.classList.remove('hidden');
    chatHeaderPlaceholder.classList.add('hidden');
  } else {
    chatHeaderAvatar.classList.add('hidden');
    chatHeaderPlaceholder.classList.remove('hidden');
  }

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

      const avatarHtml = !isMine
        ? (otherAvatarUrl
            ? `<img src="${otherAvatarUrl}" class="chat-avatar" alt="" />`
            : `<div class="chat-avatar-placeholder"><i data-lucide="user"></i></div>`)
        : '';

      let contentHtml;
      if (m.type === 'photo') {
        contentHtml = `<img src="${m.photoUrl}" class="chat-photo-msg" alt="Foto" />`;
      } else if (m.type === 'audio') {
        contentHtml = `<audio controls src="${m.audioUrl}" class="chat-audio-msg"></audio>`;
      } else if (m.type === 'sticker') {
        contentHtml = `<span class="chat-sticker-msg">${m.sticker}</span>`;
      } else {
        contentHtml = escapeHtml(m.text || '');
      }

      return `
        <div class="chat-row ${isMine ? 'mine' : 'theirs'}">
          ${avatarHtml}
          <div class="chat-bubble ${isMine ? 'mine' : 'theirs'} ${m.type ? 'chat-bubble-' + m.type : ''}">${contentHtml}</div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

chatBackBtn.addEventListener('click', () => {
  chatActive.classList.add('hidden');
  chatEmpty.classList.remove('hidden');
  document.getElementById('chatPanel').classList.remove('mobile-active');
  if (unsubscribeMessages) unsubscribeMessages();
});

// ===== Invio testo =====
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeConversationId) return;

  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  await sendMessage({ type: 'text', text }, text);
});

// ===== Invio foto (sinistra e destra mobile) =====
photoLeftBtn.addEventListener('click', () => chatPhotoInput.click());
photoRightBtn.addEventListener('click', () => chatPhotoInput.click());

chatPhotoInput.addEventListener('change', async () => {
  const file = chatPhotoInput.files[0];
  if (!file || !activeConversationId) return;

  try {
    const compressed = await compressImage(file, 800, 0.75);
    const photoPath = `chat_photos/${activeConversationId}/${Date.now()}.jpg`;
    const photoRef = ref(storage, photoPath);
    await uploadString(photoRef, compressed, 'data_url');
    const photoUrl = await getDownloadURL(photoRef);

    await sendMessage({ type: 'photo', photoUrl }, '📷 Foto');
  } catch (error) {
    console.error('Errore invio foto:', error);
  } finally {
    chatPhotoInput.value = '';
  }
});

// ===== Sticker =====
stickerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  stickerPicker.classList.toggle('hidden');
});

document.querySelectorAll('.sticker-option').forEach(btn => {
  btn.addEventListener('click', async () => {
    const sticker = btn.textContent;
    stickerPicker.classList.add('hidden');
    await sendMessage({ type: 'sticker', sticker }, sticker);
  });
});

document.addEventListener('click', (e) => {
  if (!stickerPicker.contains(e.target) && e.target !== stickerBtn) {
    stickerPicker.classList.add('hidden');
  }
});

// ===== Messaggio vocale =====
voiceBtn.addEventListener('click', async () => {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const audioPath = `chat_audio/${activeConversationId}/${Date.now()}.webm`;
            const audioRef = ref(storage, audioPath);
            await uploadString(audioRef, reader.result, 'data_url');
            const audioUrl = await getDownloadURL(audioRef);
            await sendMessage({ type: 'audio', audioUrl }, '🎤 Messaggio vocale');
          } catch (error) {
            console.error('Errore invio vocale:', error);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      isRecording = true;
      voiceBtn.classList.add('recording');
    } catch (error) {
      console.error('Microfono non disponibile:', error);
      alert('Non riesco ad accedere al microfono. Controlla i permessi del browser.');
    }
  } else {
    mediaRecorder.stop();
    isRecording = false;
    voiceBtn.classList.remove('recording');
  }
});

// ===== Funzione comune di invio =====
async function sendMessage(messageData, previewText) {
  if (!activeConversationId) return;

  try {
    await addDoc(collection(db, 'conversations', activeConversationId, 'messages'), {
      from: currentUser.uid,
      ...messageData,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, 'conversations', activeConversationId), {
      lastMessage: previewText,
      lastMessageAt: serverTimestamp(),
      [`unread.${activeOtherUid}`]: increment(1)
    });
  } catch (error) {
    console.error('Errore invio messaggio:', error);
  }
}