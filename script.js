const RSS_API = 'https://api.rss2json.com/v1/api.json?rss_url=https://feeds.bbci.co.uk/news/';
const newsContainer = document.getElementById('news-container');
const categoryButtons = document.querySelectorAll('.cat-btn');

// Elementi di Navigazione
const navButtons = document.querySelectorAll('.nav-item');
const pageHome = document.getElementById('page-home');
const pageNews = document.getElementById('page-news');

// Elementi Modale Post
const addPostBtn = document.getElementById('add-post-btn');
const postModal = document.getElementById('post-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const createPostForm = document.getElementById('create-post-form');
const postsContainer = document.getElementById('posts-container');

// Array locale per memorizzare i post creati
let posts = [];

// CAMBIO PAGINA (HOME / NEWS)
navButtons.forEach(button => {
  button.addEventListener('click', () => {
    navButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    const targetPage = button.getAttribute('data-page');

    if (targetPage === 'home') {
      pageHome.classList.remove('hidden');
      pageNews.classList.add('hidden');
    } else if (targetPage === 'news') {
      pageHome.classList.add('hidden');
      pageNews.classList.remove('hidden');
      if (newsContainer.children.length === 0) {
        fetchNews('top');
      }
    }
  });
});

// GESTIONE POPUP MODALE
addPostBtn.addEventListener('click', () => {
  postModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
  postModal.classList.add('hidden');
});

// Chiusura cliccando fuori dal riquadro
postModal.addEventListener('click', (e) => {
  if (e.target === postModal) {
    postModal.classList.add('hidden');
  }
});

// CREAZIONE NUOVO POST
createPostForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const title = document.getElementById('post-title').value;
  const content = document.getElementById('post-content').value;
  const imageUrl = document.getElementById('post-image').value;

  const newPost = {
    id: Date.now(),
    title: title,
    content: content,
    image: imageUrl,
    date: new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  };

  posts.unshift(newPost);
  renderPosts();

  // Reset e chiusura form
  createPostForm.reset();
  postModal.classList.add('hidden');
});

// MOSTRA POST IN HOME
function renderPosts() {
  postsContainer.innerHTML = '';

  if (posts.length === 0) {
    postsContainer.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: #94a3b8;">
        <i class="fa-regular fa-folder-open" style="font-size: 40px; margin-bottom: 12px;"></i>
        <p style="font-size: 16px;">Nessun post presente in Home.<br>Clicca sul tasto <strong>(+)</strong> in basso per crearne uno!</p>
      </div>
    `;
    return;
  }

  posts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'user-post-card';

    let imageHtml = post.image ? `<img src="${post.image}" alt="Immagine post">` : '';

    card.innerHTML = `
      <h2 class="user-post-title">${post.title}</h2>
      <div class="user-post-date"><i class="fa-regular fa-clock"></i> ${post.date}</div>
      <p class="user-post-content">${post.content}</p>
      ${imageHtml}
    `;

    postsContainer.appendChild(card);
  });
}

// INIZIALIZZAZIONE SEZIONE NEWS (Intatta)
const bbcFeeds = {
  top: 'rss.xml',
  technology: 'technology/rss.xml',
  science_and_environment: 'science_and_environment/rss.xml',
  business: 'business/rss.xml',
  world: 'world/rss.xml'
};

async function fetchNews(categoryKey = 'top') {
  newsContainer.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: #64748b;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; color: #7c3aed; margin-bottom: 12px;"></i>
      <p style="font-weight: 500;">Caricamento ultime notizie BBC...</p>
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

// Render dei post iniziali vuoti
renderPosts();