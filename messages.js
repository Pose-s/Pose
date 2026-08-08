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
const mutualSearchInput = document.getElementById('mutualSearchInput');

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
const chatPhotoInput = document.getElementById('chatPhotoInput');

const stickerBtn = document.getElementById('stickerBtn');
const stickerPanel = document.getElementById('stickerPanel');
const stickerSearchInput = document.getElementById('stickerSearchInput');
const stickerTabs = document.getElementById('stickerTabs');
const stickerGrid = document.getElementById('stickerGrid');

const replyPreview = document.getElementById('replyPreview');
const replyPreviewText = document.getElementById('replyPreviewText');
const replyPreviewClose = document.getElementById('replyPreviewClose');

const recordingBar = document.getElementById('recordingBar');
const recordingTime = document.getElementById('recordingTime');
const recordingHint = document.getElementById('recordingHint');

lucide.createIcons();

let currentUser = null;
let currentProfile = {};
let activeConversationId = null;
let activeOtherUid = null;
let otherAvatarUrl = '';
let unsubscribeMessages = null;
let allMutualUsers = [];
let replyingToMessage = null;

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let isLocked = false;
let recordStartY = 0;
let recordTimerInterval = null;
let recordSeconds = 0;

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

newMessageBtn.addEventListener('click', async () => {
  newMessageModal.classList.remove('hidden');
  mutualSearchInput.value = '';
  mutualFriendsList.innerHTML = '<p class="search-empty">Caricamento...</p>';

  const freshDoc = await getDoc(doc(db, 'users', currentUser.uid));
  const freshData = freshDoc.exists() ? freshDoc.data() : {};
  currentProfile = freshData;

  const following = freshData.following || [];
  const followers = freshData.followers || [];
  const mutualIds = following.filter(id => followers.includes(id));

  if (mutualIds.length === 0) {
    mutualFriendsList.innerHTML = '';
    mutualEmptyMsg.classList.remove('hidden');
    allMutualUsers = [];
    return;
  }

  mutualEmptyMsg.classList.add('hidden');

  allMutualUsers = await Promise.all(mutualIds.map(async (uid) => {
    const d = await getDoc(doc(db, 'users', uid));
    return { uid, data: d.exists() ? d.data() : {} };
  }));

  renderMutualList(allMutualUsers);
});

function renderMutualList(users) {
  if (users.length === 0) {
    mutualFriendsList.innerHTML = '<p class="search-empty">Nessun risultato.</p>';
    return;
  }

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
}

mutualSearchInput.addEventListener('input', () => {
  const term = mutualSearchInput.value.trim().toLowerCase();
  if (!term) {
    renderMutualList(allMutualUsers);
    return;
  }
  const filtered = allMutualUsers.filter(u => (u.data.username || '').toLowerCase().includes(term));
  renderMutualList(filtered);
});

closeNewMessageBtn.addEventListener('click', () => newMessageModal.classList.add('hidden'));
newMessageModal.addEventListener('click', (e) => { if (e.target === newMessageModal) newMessageModal.classList.add('hidden'); });

async function openChat(convId, otherUid) {
  activeConversationId = convId;
  activeOtherUid = otherUid;
  replyingToMessage = null;
  replyPreview.classList.add('hidden');

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
      const id = docSnap.id;
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

      const replyHtml = m.replyTo
        ? `<div class="chat-reply-quote">${escapeHtml(m.replyTo)}</div>`
        : '';

      return `
        <div class="chat-row ${isMine ? 'mine' : 'theirs'}" data-msgid="${id}" data-preview="${escapeHtml(previewFor(m))}">
          ${avatarHtml}
          <div class="chat-bubble ${isMine ? 'mine' : 'theirs'} ${m.type ? 'chat-bubble-' + m.type : ''}">
            ${replyHtml}
            ${contentHtml}
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
    chatMessages.scrollTop = chatMessages.scrollHeight;
    attachSwipeToReply();
  });
}

function previewFor(m) {
  if (m.type === 'photo') return '📷 Foto';
  if (m.type === 'audio') return '🎤 Vocale';
  if (m.type === 'sticker') return m.sticker;
  return m.text || '';
}

chatBackBtn.addEventListener('click', () => {
  chatActive.classList.add('hidden');
  chatEmpty.classList.remove('hidden');
  document.getElementById('chatPanel').classList.remove('mobile-active');
  if (unsubscribeMessages) unsubscribeMessages();
});

function attachSwipeToReply() {
  document.querySelectorAll('.chat-row').forEach(row => {
    let startX = 0;
    let currentX = 0;
    let dragging = false;

    const onStart = (x) => { startX = x; dragging = true; };
    const onMove = (x) => {
      if (!dragging) return;
      currentX = x - startX;
      if (currentX > 0 && currentX < 80) {
        row.style.transform = `translateX(${currentX}px)`;
      }
    };
    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      if (currentX > 45) {
        replyingToMessage = row.dataset.preview;
        replyPreviewText.textContent = replyingToMessage;
        replyPreview.classList.remove('hidden');
        chatInput.focus();
      }
      row.style.transform = '';
      currentX = 0;
    };

    row.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX));
    row.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX));
    row.addEventListener('touchend', onEnd);

    row.addEventListener('mousedown', (e) => onStart(e.clientX));
    row.addEventListener('mousemove', (e) => onMove(e.clientX));
    row.addEventListener('mouseup', onEnd);
    row.addEventListener('mouseleave', () => { if (dragging) onEnd(); });
  });
}

replyPreviewClose.addEventListener('click', () => {
  replyingToMessage = null;
  replyPreview.classList.add('hidden');
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeConversationId) return;

  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  await sendMessage({ type: 'text', text }, text);
});

photoLeftBtn.addEventListener('click', () => chatPhotoInput.click());

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
const STICKER_CATEGORIES = [
  { id: 'popolari', label: 'Popolari', icon: 'star', items: ['😀','😂','😍','😎','🥳','😢','😮','👍','❤️','🔥','🙌','💯','😅','🤔','😴','🥰'] },
  { id: 'cuori', label: 'Cuori', icon: 'heart', items: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💕','💞','💓','💗','💖','💘','💝','💔'] },
  { id: 'animali', label: 'Animali', icon: 'paw-print', items: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🦄'] },
  { id: 'cibo', label: 'Cibo', icon: 'pizza', items: ['🍕','🍔','🍟','🌭','🍿','🍩','🍪','🍰','🧁','🍦','🍫','🍭','🍎','🍓','🍉','☕'] },
  { id: 'feste', label: 'Feste', icon: 'party-popper', items: ['🎉','🎊','🎈','🎁','🎂','✨','🥳','🎆','🎇','🪅','🎵','🎶','🍾','🥂','🎇','🌟'] },
  { id: 'reazioni', label: 'Reazioni', icon: 'smile-plus', items: ['👏','🙏','💪','🤝','👌','✌️','🤞','🫶','😱','😳','🙄','😤','😭','🤩','😇','🫠'] }
];

let activeStickerCategory = 'popolari';

function renderStickerTabs() {
  stickerTabs.innerHTML = STICKER_CATEGORIES.map(cat => `
    <button type="button" class="sticker-tab ${cat.id === activeStickerCategory ? 'active' : ''}" data-cat="${cat.id}">
      <i data-lucide="${cat.icon}"></i>
    </button>
  `).join('');
  lucide.createIcons();

  document.querySelectorAll('.sticker-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeStickerCategory = tab.dataset.cat;
      stickerSearchInput.value = '';
      renderStickerTabs();
      renderStickerGrid(getCategoryItems(activeStickerCategory));
    });
  });
}

function getCategoryItems(catId) {
  const cat = STICKER_CATEGORIES.find(c => c.id === catId);
  return cat ? cat.items : [];
}

function renderStickerGrid(items) {
  if (items.length === 0) {
    stickerGrid.innerHTML = '<p class="search-empty">Nessuno sticker trovato.</p>';
    return;
  }
  stickerGrid.innerHTML = items.map(emoji => `
    <button type="button" class="sticker-grid-item">${emoji}</button>
  `).join('');

  document.querySelectorAll('.sticker-grid-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sticker = btn.textContent;
      stickerPanel.classList.add('hidden');
      await sendMessage({ type: 'sticker', sticker }, sticker);
    });
  });
}

stickerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  stickerPanel.classList.toggle('hidden');
  if (!stickerPanel.classList.contains('hidden')) {
    renderStickerTabs();
    renderStickerGrid(getCategoryItems(activeStickerCategory));
  }
});

stickerSearchInput.addEventListener('input', () => {
  const term = stickerSearchInput.value.trim().toLowerCase();
  if (!term) {
    renderStickerGrid(getCategoryItems(activeStickerCategory));
    return;
  }
  const matchingCategories = STICKER_CATEGORIES.filter(cat => cat.label.toLowerCase().includes(term));
  const items = matchingCategories.flatMap(cat => cat.items);
  renderStickerGrid([...new Set(items)]);
});

document.addEventListener('click', (e) => {
  if (!stickerPanel.contains(e.target) && e.target !== stickerBtn && !stickerBtn.contains(e.target)) {
    stickerPanel.classList.add('hidden');
  }
});

// ===== Messaggio vocale =====
function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/aac')) return 'audio/aac';
  return '';
}

async function startRecording() {
  if (isRecording) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getSupportedMimeType();

    mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    audioChunks = [];
    isLocked = false;

    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      clearInterval(recordTimerInterval);
      recordingBar.classList.add('hidden');
      voiceBtn.classList.remove('recording');

      if (audioChunks.length === 0 || recordSeconds < 1) return;

      const finalType = mediaRecorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunks, { type: finalType });
      const ext = finalType.includes('mp4') ? 'm4a' : 'webm';

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const audioPath = `chat_audio/${activeConversationId}/${Date.now()}.${ext}`;
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
    recordSeconds = 0;
    recordingBar.classList.remove('hidden');
    voiceBtn.classList.add('recording');
    recordingHint.textContent = '▲ Scorri per bloccare';

    recordTimerInterval = setInterval(() => {
      recordSeconds++;
      const mm = Math.floor(recordSeconds / 60);
      const ss = String(recordSeconds % 60).padStart(2, '0');
      recordingTime.textContent = `${mm}:${ss}`;
    }, 1000);
  } catch (error) {
    console.error('Microfono non disponibile:', error);
    alert('Non riesco ad accedere al microfono. Controlla i permessi del browser.');
  }
}

function stopRecording() {
  if (!isRecording || !mediaRecorder) return;
  isRecording = false;
  mediaRecorder.stop();
}

voiceBtn.addEventListener('mousedown', (e) => {
  recordStartY = e.clientY;
  startRecording();
});
voiceBtn.addEventListener('touchstart', (e) => {
  recordStartY = e.touches[0].clientY;
  startRecording();
}, { passive: true });

document.addEventListener('mousemove', (e) => checkLockGesture(e.clientY));
document.addEventListener('touchmove', (e) => {
  if (isRecording && e.touches[0]) checkLockGesture(e.touches[0].clientY);
});

function checkLockGesture(currentY) {
  if (!isRecording || isLocked) return;
  const delta = recordStartY - currentY;
  if (delta > 60) {
    isLocked = true;
    recordingHint.textContent = '🔒 Bloccato — tocca per fermare';
  }
}

voiceBtn.addEventListener('mouseup', () => { if (!isLocked) stopRecording(); });
voiceBtn.addEventListener('mouseleave', () => { if (!isLocked && isRecording) stopRecording(); });
voiceBtn.addEventListener('touchend', () => { if (!isLocked) stopRecording(); });

recordingBar.addEventListener('click', () => {
  if (isLocked) stopRecording();
});

// ===== Funzione comune di invio =====
async function sendMessage(messageData, previewText) {
  if (!activeConversationId) return;

  const payload = { ...messageData };
  if (replyingToMessage) {
    payload.replyTo = replyingToMessage;
    replyingToMessage = null;
    replyPreview.classList.add('hidden');
  }

  try {
    await addDoc(collection(db, 'conversations', activeConversationId, 'messages'), {
      from: currentUser.uid,
      ...payload,
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