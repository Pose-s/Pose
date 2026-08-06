const FEEDS = {
  top: 'https://feeds.bbci.co.uk/news/rss.xml',
  tech: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
  science: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
  business: 'https://feeds.bbci.co.uk/news/business/rss.xml',
  world: 'https://feeds.bbci.co.uk/news/world/rss.xml'
};

const newsGrid = document.getElementById('newsGrid');
const loader = document.getElementById('loader');
const categoryButtons = document.querySelectorAll('.category-btn');

// Inizializza icone Lucide
lucide.createIcons();

// Listener per i bottoni delle categorie
categoryButtons.forEach(button => {
  button.addEventListener('click', () => {
    categoryButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    const category = button.dataset.category;
    fetchBBCNews(category);
  });
});

// Funzione per caricare le notizie tramite API rss2json
async function fetchBBCNews(categoryKey) {
  newsGrid.innerHTML = '';
  loader.classList.remove('hidden');

  const feedUrl = FEEDS[categoryKey] || FEEDS.top;
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status === 'ok' && data.items) {
      renderArticles(data.items);
    } else {
      newsGrid.innerHTML = '<p style="color: #64748b;">Nessuna notizia trovata.</p>';
    }
  } catch (error) {
    console.error('Errore durante il recupero dei dati:', error);
    newsGrid.innerHTML = '<p style="color: #ef4444;">Errore nel caricamento delle notizie.</p>';
  } finally {
    loader.classList.add('hidden');
  }
}

// Render delle schede notizie
function renderArticles(items) {
  newsGrid.innerHTML = items.map(item => {
    // Estrazione eventuale immagine o placeholder
    const imageUrl = item.thumbnail || (item.enclosure && item.enclosure.link) || '';
    const cleanDescription = item.description ? item.description.replace(/<[^>]*>?/gm, '') : '';
    
    // Calcolo del tempo trascorso approssimativo
    const timeAgo = formatTimeAgo(new Date(item.pubDate));

    return `
      <article class="news-card">
        ${imageUrl ? `<img src="${imageUrl}" alt="${item.title}" class="news-image" />` : ''}
        <div class="news-body">
          <div class="news-meta">
            <span class="badge-bbc">BBC NEWS</span>
            <span class="news-time">
              <i data-lucide="clock"></i> ${timeAgo}
            </span>
          </div>
          <h2 class="news-title">
            <a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a>
          </h2>
          <p class="news-desc">${cleanDescription}</p>
        </div>
      </article>
    `;
  }).join('');

  // Re-inizializza le icone Lucide create dinamicamente
  lucide.createIcons();
}

// Formattatore orario "X ore fa"
function formatTimeAgo(date) {
  const diffInMinutes = Math.floor((new Date() - date) / (1000 * 60));
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${Math.floor(diffInHours / 24)}d ago`;
}

// Caricamento iniziale
fetchBBCNews('top');