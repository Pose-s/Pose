import { db, storage, auth } from "./home.js"; // o il tuo file firebase config
import { collection, addDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";

// Sticker predefiniti in stile Meme / Trend
const DEFAULT_STICKERS = [
  { id: 'cat1', category: 'meme', tags: 'cat gatto shock', url: 'https://api.iconify.design/fluent-emoji:cat-with-wry-smile.svg' },
  { id: 'fire', category: 'tendenze', tags: 'fuoco flame lit', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png' },
  { id: 'heart', category: 'tendenze', tags: 'cuore love pink', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Heart%20with%20Ribbon.png' },
  { id: 'crown', category: 'tendenze', tags: 'corona queen king', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Crown.png' },
  { id: 'cry', category: 'meme', tags: 'pianto cry lacrime sad', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Loudly%20Crying%20Face.png' },
  { id: 'laugh', category: 'meme', tags: 'risata lol laugh', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Rolling%20on%20the%20Floor%20Laughing.png' },
  { id: 'cool', category: 'tendenze', tags: 'occhiali cool swag', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Smiling%20Face%20with%20Sunglasses.png' }
];

export async function openStickerPicker(targetButton, onSelectSticker) {
  // Rimuovi picker aperti in precedenza
  document.querySelectorAll(".sticker-popover").forEach(el => el.remove());

  // Recupera gli sticker personalizzati caricati dall'utente
  let userStickers = [];
  if (auth.currentUser) {
    try {
      const q = query(collection(db, "custom_stickers"), where("userId", "==", auth.currentUser.uid));
      const snap = await getDocs(q);
      userStickers = snap.docs.map(doc => ({ id: doc.id, category: 'miei', tags: 'mio custom', url: doc.data().url }));
    } catch (err) {
      console.warn("Errore caricamento sticker custom:", err);
    }
  }

  let allStickers = [...userStickers, ...DEFAULT_STICKERS];
  let currentTab = "tutte";

  const popover = document.createElement("div");
  popover.className = "sticker-popover";
  popover.innerHTML = `
    <div class="sticker-header">
      <div class="sticker-search-wrap">
        <i data-lucide="search" class="search-icon"></i>
        <input type="text" id="stickerSearchInput" placeholder="Ricerca di sticker..." />
      </div>
      <div class="sticker-categories">
        <button class="cat-btn active" data-cat="tutte">Tutti</button>
        <button class="cat-btn" data-cat="tendenze">Tendenze</button>
        <button class="cat-btn" data-cat="meme">Meme</button>
        <button class="cat-btn" data-cat="miei">I miei ✨</button>
        <label class="cat-btn upload-sticker-btn" title="Crea il tuo sticker">
          ➕ Crea
          <input type="file" id="stickerFileInput" accept="image/*" style="display:none;" />
        </label>
      </div>
    </div>
    <div class="sticker-grid" id="stickerGridContainer"></div>
  `;

  document.body.appendChild(popover);

  // Posizionamento del popup sopra o sotto il bottone
  const rect = targetButton.getBoundingClientRect();
  popover.style.left = `${Math.min(window.innerWidth - 320, Math.max(10, rect.left - 120))}px`;
  popover.style.top = `${Math.max(10, rect.top - 360)}px`;

  const gridContainer = popover.querySelector("#stickerGridContainer");
  const searchInput = popover.querySelector("#stickerSearchInput");

  function renderGrid(stickersList) {
    if (stickersList.length === 0) {
      gridContainer.innerHTML = `<div class="sticker-empty">Nessuno sticker trovato</div>`;
      return;
    }
    gridContainer.innerHTML = stickersList.map(s => `
      <div class="sticker-item" data-url="${s.url}">
        <img src="${s.url}" alt="Sticker" loading="lazy" />
      </div>
    `).join("");

    gridContainer.querySelectorAll(".sticker-item").forEach(item => {
      item.addEventListener("click", () => {
        onSelectSticker(item.dataset.url);
        popover.remove();
      });
    });
  }

  function filterStickers() {
    const q = searchInput.value.toLowerCase().trim();
    const filtered = allStickers.filter(s => {
      const matchCat = currentTab === "tutte" || s.category === currentTab;
      const matchQuery = !q || s.tags.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
    renderGrid(filtered);
  }

  // Event listener Tabs
  popover.querySelectorAll(".cat-btn[data-cat]").forEach(btn => {
    btn.addEventListener("click", () => {
      popover.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentTab = btn.dataset.cat;
      filterStickers();
    });
  });

  searchInput.addEventListener("input", filterStickers);

  // Upload nuovo sticker creato dall'utente
  const fileInput = popover.querySelector("#stickerFileInput");
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file || !auth.currentUser) return;

    try {
      const storageRef = ref(storage, `stickers/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
      const uploadSnap = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(uploadSnap.ref);

      // Salva nel database
      await addDoc(collection(db, "custom_stickers"), {
        userId: auth.currentUser.uid,
        url: downloadUrl,
        createdAt: serverTimestamp()
      });

      const newSticker = { id: Date.now(), category: 'miei', tags: 'mio personalizzato', url: downloadUrl };
      allStickers.unshift(newSticker);
      currentTab = "miei";
      filterStickers();
    } catch (error) {
      console.error("Errore caricamento sticker:", error);
    }
  });

  // Chiusura al click esterno
  const closeOutside = (e) => {
    if (!popover.contains(e.target) && !targetButton.contains(e.target)) {
      popover.remove();
      document.removeEventListener("pointerdown", closeOutside);
    }
  };
  setTimeout(() => document.addEventListener("pointerdown", closeOutside), 0);

  filterStickers();
}