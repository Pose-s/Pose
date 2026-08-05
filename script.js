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
      newsContainer.innerHTML = `
        <div style="text-align: center; padding: 30px; background: white; border-radius: 12px; color: #64748b;">
          Nessuna notizia disponibile al momento per questa categoria.
        </div>
      `;
    }
  } catch (error) {
    console.error('Errore durante il recupero notizie:', error);
    newsContainer.innerHTML = `
      <div style="text-align: center; padding: 30px; background: white; border-radius: 12px; color: #ef4444;">
        Si è verificato un errore nel caricamento delle notizie. Controlla la connessione.
      </div>
    `;
  }
}

function renderArticles(articles) {
  newsContainer.innerHTML = '';

  articles.forEach(item => {
    let imageUrl = '';
    if (item.thumbnail && item.thumbnail.length > 0) {
      imageUrl = item.thumbnail;
    } else if (item.enclosure && item.enclosure.link) {
      imageUrl = item.enclosure.link;
    } else {
      imageUrl = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1000&auto=format&fit=crop';
    }

    const cleanDescription = item.description ? item.description.replace(/<[^>]*>?/gm, '') : '';
    const publishDate = item.pubDate ? new Date(item.pubDate).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short'
    }) : 'BBC News';

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

    const selectedCategory = button.getAttribute('data-category');
    fetchNews(selectedCategory);
  });
});

fetchNews('top');