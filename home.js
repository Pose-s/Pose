const addPostBtn = document.getElementById('addPostBtn');
const postModal = document.getElementById('postModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const postForm = document.getElementById('postForm');

const logoInput = document.getElementById('logoInput');
const logoPreview = document.getElementById('logoPreview');
const photoInput = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
const captionInput = document.getElementById('captionInput');

const postsGrid = document.getElementById('postsGrid');

const STORAGE_KEY = 'pose_posts';

// Inizializza icone Lucide
lucide.createIcons();

// Apri / chiudi modale
addPostBtn.addEventListener('click', () => {
  postModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', closeModal);
postModal.addEventListener('click', (e) => {
  if (e.target === postModal) closeModal();
});

function closeModal() {
  postModal.classList.add('hidden');
  postForm.reset();
  logoPreview.classList.add('hidden');
  photoPreview.classList.add('hidden');
}

// Anteprima immagini caricate
logoInput.addEventListener('change', () => {
  previewImage(logoInput, logoPreview);
});

photoInput.addEventListener('change', () => {
  previewImage(photoInput, photoPreview);
});

function previewImage(input, previewEl) {
  const file = input.files[0];
  if (!file) {
    previewEl.classList.add('hidden');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    previewEl.src = e.target.result;
    previewEl.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

// Converte un file in base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Invio form
postForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const logoFile = logoInput.files[0];
  const photoFile = photoInput.files[0];

  if (!photoFile) return;

  const logoBase64 = await fileToBase64(logoFile);
  const photoBase64 = await fileToBase64(photoFile);

  const newPost = {
    id: Date.now(),
    logo: logoBase64,
    photo: photoBase64,
    caption: captionInput.value.trim(),
    date: new Date().toISOString()
  };

  savePost(newPost);
  renderPosts();
  closeModal();
});

// Salvataggio in localStorage
function getPosts() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function savePost(post) {
  const posts = getPosts();
  posts.unshift(post); // aggiunge in cima
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

// Render dei post
function renderPosts() {
  const posts = getPosts();

  if (posts.length === 0) {
    postsGrid.innerHTML = '<p style="color:#94a3b8;">Nessun post ancora. Clicca su "+" per crearne uno!</p>';
    return;
  }

  postsGrid.innerHTML = posts.map(post => `
    <article class="post-card">
      <div class="post-header">
        ${post.logo 
          ? `<img src="${post.logo}" class="post-logo" alt="Logo" />` 
          : `<div class="post-logo-placeholder"><i data-lucide="user"></i></div>`
        }
        <span class="post-date">${formatDate(post.date)}</span>
      </div>
      <img src="${post.photo}" class="post-photo" alt="Post" />
      ${post.caption ? `<p class="post-caption">${escapeHtml(post.caption)}</p>` : ''}
    </article>
  `).join('');

  lucide.createIcons();
}

function formatDate(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Caricamento iniziale
renderPosts();