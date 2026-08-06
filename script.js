const RSS_API = 'https://api.rss2json.com/v1/api.json?rss_url=https://feeds.bbci.co.uk/news/';
const CLOUD_STORAGE_URL = 'https://api.jsonbin.io/v3/b/66b1e2c4e41b4d34e41c4a22';

// Elementi DOM
const newsContainer = document.getElementById('news-container');
const categoryButtons = document.querySelectorAll('.cat-btn');

// Selezione sia per classe .nav-item che .nav-btn per sicurezza
const navButtons = document.querySelectorAll('.nav-item, .nav-btn'); 
const pageHome = document.getElementById('page-home');
const pageNews = document.getElementById('page-news');

const addPostBtn = document.getElementById('add-post-btn') || document.querySelector('.add-btn');
const postModal = document.getElementById('post-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const createPostForm = document.getElementById('create-post-form');
const submitPostBtn = document.getElementById('submit-post-btn');
const postsContainer = document.getElementById('posts-container');

let posts = [];

// NAVIGAZIONE (HOME / NEWS)
navButtons.forEach(button => {
  button.addEventListener('click', (e) => {
    // Evita il ricaricamento della pagina se si usano tag <a>
    e.preventDefault(); 

    navButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    const targetPage = button.getAttribute('data-page');

    if (targetPage === 'home') {
      if (pageHome) pageHome.classList.remove('hidden');
      if (pageNews) pageNews.classList.add('hidden');
      loadCloudPosts();
    } else if (targetPage === 'news') {
      if (pageHome) pageHome.classList.add('hidden');
      if (pageNews) pageNews.classList.remove('hidden');
      if (newsContainer && newsContainer.children.length === 0) {
        fetchNews('top');
      }
    }
  });
});

// MODALE CREAZIONE POST (Pulsante +)
if (addPostBtn && postModal) {
  addPostBtn.addEventListener('click', (e) => {
    e.preventDefault();
    postModal.classList.remove('hidden');
  });
}

if (closeModalBtn && postModal) {
  closeModalBtn.addEventListener('click', () => postModal.classList.add('hidden'));
}

if (postModal) {
  postModal.addEventListener('click', (e) => {
    if (e.target === postModal) postModal.classList.add('hidden');
  });
}

// CARICA I POST DAL CLOUD (VISIBILI A TUTTI)
async function loadCloudPosts() {
  if (!postsContainer) return;

  postsContainer.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: #64748b;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; color: #7c3aed; margin-bottom: 12px;"></i>
      <p>Caricamento post della community...</p>
    </div>
  `;

  try {
    const res = await fetch('https://api.npoint.io/4612344793f64c679a95');
    if (res.ok) {
      const data = await res.json();
      posts = data || [];
      renderPosts();
    } else {
      fallbackLocalPosts();
    }
  } catch (err) {
    fallbackLocalPosts();
  }
}

function fallbackLocalPosts() {
  const local = localStorage.getItem('pose_posts');
  posts = local ? JSON.parse(local) : [];
  renderPosts();
}

// PUBBLICA POST E SALVA ONLINE
if (createPostForm) {
  createPostForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (submitPostBtn) {
      submitPostBtn.innerText = 'Pubblicazione in corso...';
      submitPostBtn.disabled = true;
    }

    const title = document.getElementById('post-title')?.value.trim() || '';
    const content = document.getElementById('post-content')?.value.trim() || '';
    const imageUrl = document.getElementById('post-image')?.value.trim() || '';

    const newPost = {
      id: Date.now(),
      title: title,
      content: content,
      image: imageUrl,
      date: new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    };

    posts.unshift(newPost);
    localStorage.setItem('pose_posts', JSON.stringify(posts));

    // Invia al server
    try {
      await fetch('https://api.npoint.io/4612344793f64c679a95', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(posts)
      });
    } catch (err) {
      console.warn('Salvato in locale');
    }

    renderPosts();
    createPostForm.reset();
    if (submitPostBtn) {
      submitPostBtn.innerText = 'Pubblica Post';
      submitPostBtn.disabled = false;
    }
    if (postModal) postModal.classList.add('hidden');
  });
}

// RENDERING DEI POST SULLO SCHERMO
function renderPosts() {
  if (!postsContainer) return;
  postsContainer.innerHTML = '';

  if (posts.length === 0) {
    postsContainer.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: #94a3b8;">
        <i class="fa-regular fa-folder-open" style="font-size: 40px; margin-bottom: 12px;"></i>
        <p style="font-size: 15px;">Nessun post presente.<br>Premi il tasto <strong>(+)</strong> per crearne uno!</p>
      </div>
    `;
    return;
  }

  posts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'user-post-card';

    let imageHtml = '';
    if (post.image && post.image.length > 5) {
      imageHtml = `
        <div class="post-img-wrapper">
          <img src="${post.image}" alt="Foto Post" onerror="this.parentElement.style.display='none'">
        </div>
      `;
    }

    card.innerHTML = `
      <h2 class="user-post-title">${post.title}</h2>
      <div class="user-post-date"><i class="fa-regular fa-clock"></i> ${post.date}</div>
      <p class="user-post-content">${post.content}</p>
      ${imageHtml}
    `;

    postsContainer.appendChild(card);
  });
}

// SEZIONE NEWS BBC
const bbcFeeds = {
  top: 'rss.xml',
  technology: 'technology/rss.xml',
  science_and_environment: 'science_and_environment/rss.xml',
  business: 'business/rss.xml',
  world: 'world/rss.xml'
};

async function fetchNews(categoryKey = 'top') {
  if (!newsContainer) return;

  newsContainer.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: #64748b;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; color: #7c3aed; margin-bottom: 12px;"></i>
      <p>Caricamento notizie BBC...</p>
    </div>
  `;

  const feedEndpoint = bbcFeeds[categoryKey] || bbcFeeds.top;
  const requestUrl = `${RSS_API}${feedEndpoint}`;

  try {
    const response = await fetch(requestUrl);
    const data = await response.json();

    if (data.status === 'ok' && data.items && data.items.length > 0) {
      renderArticles(data.items);
    }
  } catch (error) {
    console.error('Errore notizie:', error);
  }
}

function renderArticles(articles) {
  if (!newsContainer) return;
  newsContainer.innerHTML = '';

  articles.forEach(item => {
    let imageUrl = item.thumbnail || (item.enclosure && item.enclosure.link) || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1000';
    const cleanDescription = item.description ? item.description.replace(/<[^>]*>?/gm, '') : '';
    const publishDate = item.pubDate ? new Date(item.pubDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : 'BBC News';

    const card = document.createElement('article');
    card.className = 'news-card';

    card.innerHTML = `
      <div class="card-image-wrapper">
        <img src="${imageUrl}" alt="${item.title}" loading="lazy">
      </div>
      <div class="news-content">
        <div class="news-meta">
          <span class="news-source">BBC NEWS</span>
          <span class="news-date"><i class="fa-regular fa-clock"></i> ${publishDate}</span>
        </div>
        <h2 class="news-title">
          <a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a>
        </h2>
        <p class="news-description">${cleanDescription}</p>
      </div>
    `;

    newsContainer.appendChild(card);
  });
}

categoryButtons.forEach(button => {
  button.addEventListener('click', () => {
    categoryButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    fetchNews(button.getAttribute('data-category'));
  });
});

// Avvio
loadCloudPosts();