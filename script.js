// ==========================================
// CONFIGURAZIONE SUPABASE
// ==========================================
const SUPABASE_URL = 'https://bbytjhnxrhidoadgoubt.supabase.co';
const SUPABASE_KEY = 'INCOLLA_QUI_LA_TUA_CHIAVE_ANON_PUBLIC';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// CONFIGURAZIONE NEWS BBC
// ==========================================
const RSS_API = 'https://api.rss2json.com/v1/api.json?rss_url=https://feeds.bbci.co.uk/news/';
const newsContainer = document.getElementById('news-container');
const categoryButtons = document.querySelectorAll('.cat-btn');

const bbcFeeds = {
  top: 'rss.xml',
  technology: 'technology/rss.xml',
  science_and_environment: 'science_and_environment/rss.xml',
  business: 'business/rss.xml',
  world: 'world/rss.xml'
};

// ==========================================
// FUNZIONI SEZIONE NEWS (BBC)
// ==========================================
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
    } else {
      newsContainer.innerHTML = `<div style="text-align: center; padding: 30px; background: white; border-radius: 12px; color: #64748b;">Nessuna notizia disponibile al momento per questa categoria.</div>`;
    }
  } catch (error) {
    console.error('Errore nel caricamento notizie:', error);
    newsContainer.innerHTML = `<div style="text-align: center; padding: 30px; color: #ef4444;">Si è verificato un errore nel caricamento delle notizie.</div>`;
  }
}

function renderArticles(items) {
  newsContainer.innerHTML = '';

  items.forEach(item => {
    const article = document.createElement('article');
    article.className = 'news-card';
    
    // Gestione Immagine
    let imageUrl = item.thumbnail || (item.enclosure && item.enclosure.link) || '';
    const imgHtml = imageUrl ? `<img src="${imageUrl}" alt="${item.title}" style="width:100%; border-radius: 8px; margin-bottom: 12px;">` : '';

    article.innerHTML = `
      ${imgHtml}
      <div class="news-content">
        <span style="background: #f1f5f9; color: #7c3aed; font-size: 12px; font-weight: bold; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px;">BBC NEWS</span>
        <h2 style="font-size: 18px; margin: 0 0 8px 0;"><a href="${item.link}" target="_blank" style="text-decoration: none; color: #0f172a;">${item.title}</a></h2>
        <p style="color: #64748b; font-size: 14px; margin: 0;">${item.description}</p>
      </div>
    `;
    newsContainer.appendChild(article);
  });
}

// Event listener per i bottoni delle categorie notizie
categoryButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    categoryButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const category = btn.getAttribute('data-category');
    fetchNews(category);
  });
});

// ==========================================
// FUNZIONI SEZIONE HOME / SOCIAL (Supabase)
// ==========================================
async function fetchForYouFeed() {
  newsContainer.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: #64748b;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; color: #7c3aed; margin-bottom: 12px;"></i>
      <p style="font-weight: 500;">Caricamento feed Per Te...</p>
    </div>
  `;

  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Errore nel recupero dei post:', error);
    newsContainer.innerHTML = `<p style="text-align:center; color: #ef4444;">Errore nel caricamento del feed.</p>`;
    return;
  }

  if (!posts || posts.length === 0) {
    newsContainer.innerHTML = `<p style="text-align:center; padding: 20px;">Nessun post disponibile. Sii il primo a pubblicarne uno!</p>`;
    return;
  }

  renderPosts(posts);
}

function renderPosts(posts) {
  newsContainer.innerHTML = '';

  posts.forEach(post => {
    const postElement = document.createElement('div');
    postElement.className = 'post-card';
    postElement.style.cssText = 'background: white; padding: 16px; border-radius: 12px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);';
    postElement.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: bold; color: #1e293b;">
        <i class="fa-solid fa-user-circle"></i> ${post.user_name || 'Utente Anonimo'}
      </div>
      <img src="${post.media_url}" alt="Post image" style="width: 100%; border-radius: 8px; margin-bottom: 10px;" />
      <p style="margin: 0; color: #334155;"><strong>${post.user_name || 'Utente'}:</strong> ${post.caption}</p>
    `;
    newsContainer.appendChild(postElement);
  });
}

// Pubblicazione Post
async function createPost() {
  const username = document.getElementById('post-username').value;
  const caption = document.getElementById('post-caption').value;
  const mediaUrl = document.getElementById('post-imageurl').value;

  if (!caption || !mediaUrl) {
    alert('Compila almeno la descrizione e il link dell\'immagine!');
    return;
  }

  const { data, error } = await supabase
    .from('posts')
    .insert([{ user_name: username || 'Utente Anonimo', caption: caption, media_url: mediaUrl }]);

  if (error) {
    console.error('Errore durante la pubblicazione:', error);
    alert('Si è verificato un errore nella pubblicazione.');
  } else {
    alert('Post pubblicato con successo!');
    document.getElementById('post-caption').value = '';
    document.getElementById('post-imageurl').value = '';
    fetchForYouFeed();
  }
}

document.getElementById('btn-publish').addEventListener('click', createPost);

// ==========================================
// GESTIONE NAVIGAZIONE SIDEBAR (Home vs News)
// ==========================================
const btnHome = document.getElementById('btn-home');
const btnNews = document.getElementById('btn-news');
const createPostCard = document.getElementById('create-post-card');
const categoriesWrapper = document.getElementById('categories-wrapper');
const feedTitle = document.getElementById('feed-title');
const feedSubtitle = document.getElementById('feed-subtitle');

btnHome.addEventListener('click', (e) => {
  e.preventDefault();
  btnHome.classList.add('active');
  btnNews.classList.remove('active');
  
  feedTitle.innerText = "Home Feed";
  feedSubtitle.innerText = "Cosa sta succedendo nella community";
  
  createPostCard.style.display = 'block';
  categoriesWrapper.style.display = 'none';
  
  fetchForYouFeed();
});

btnNews.addEventListener('click', (e) => {
  e.preventDefault();
  btnNews.classList.add('active');
  btnHome.classList.remove('active');
  
  feedTitle.innerText = "News Feed";
  feedSubtitle.innerText = "Le ultime notizie aggiornate in tempo reale da BBC News";
  
  createPostCard.style.display = 'none';
  categoriesWrapper.style.display = 'flex';
  
  fetchNews('top');
});

// Caricamento iniziale: mostra le notizie BBC di default
fetchNews('top');