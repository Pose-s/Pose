// URL base dell'API che converte l'RSS BBC in JSON
const RSS_CONVERTER = 'https://api.rss2json.com/v1/api.json?rss_url=https://feeds.bbci.co.uk/news/';

const newsContainer = document.getElementById('news-container');
const categoryButtons = document.querySelectorAll('.cat-btn');

// Mappa precisa dei Feed RSS ufficiali della BBC per ciascuna categoria
const bbcFeeds = {
  top: 'rss.xml',
  technology: 'technology/rss.xml',
  science_and_environment: 'science_and_environment/rss.xml',
  business: 'business/rss.xml',
  world: 'world/rss.xml'
};

// Funzione principale per caricare le notizie della categoria selezionata
async function loadCategoryNews(categoryKey) {
  // Mostra lo stato di caricamento stilizzato
  newsContainer.innerHTML = `
    <div class="state-box">
      <i class="fa-solid fa-circle-notch spinner"></i>
      <p>Caricamento notizie BBC in corso...</p>
    </div>
  `;

  const feedEndpoint = bbcFeeds[categoryKey] || bbcFeeds.top;
  const requestUrl = `${RSS_CONVERTER}${feedEndpoint}`;

  try {
    const response = await fetch(requestUrl);
    const data = await response.json();

    if (data.status === 'ok' && data.items.length > 0) {
      renderArticles(data.items);
    } else {
      newsContainer.innerHTML = `
        <div class="state-box">
          <p>Nessuna notizia trovata al momento per questa categoria.</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Errore nel caricamento delle notizie:', err);
    newsContainer.innerHTML = `
      <div class="state-box">
        <p>Si è verificato un errore durante la connessione con la BBC. Riprova tra poco.</p>
      </div>
    `;
  }
}

// Funzione per generare l'HTML delle card
function renderArticles(articles) {
  newsContainer.innerHTML = '';

  articles.forEach(item => {
    // Gestione intelligente dell'immagine (recupera la miniatura BBC o usa un'immagine di backup)
    let imageUrl = '';
    if (item.thumbnail && item.thumbnail.length > 0) {
      imageUrl = item.thumbnail;
    } else if (item.enclosure && item.enclosure.link) {
      imageUrl = item.enclosure.link;
    } else {
      imageUrl = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1000&auto=format&fit=crop';
    }

    // Formattazione della data
    const publishDate = item.pubDate ? new Date(item.pubDate).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) : 'BBC News';

    // Pulisce il testo della descrizione da eventuali tag HTML residui
    const cleanDescription = item.description ? item.description.replace(/<[^>]*>?/gm, '') : '';

    const card = document.createElement('article');
    card.className = 'news-card';

    card.innerHTML = `
      <div class="card-image-wrapper">
        <img src="${imageUrl}" alt="${item.title}" loading="lazy">
      </div>
      <div class="news-content">
        <div class="news-meta">
          <span class="news-source">BBC News</span>
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

// Associa l'evento di Click a ciascun pulsante di Categoria
categoryButtons.forEach(button => {
  button.addEventListener('click', () => {
    // Rimuovi classe active da tutti i tasti
    categoryButtons.forEach(btn => btn.classList.remove('active'));
    // Aggiungi classe active a quello cliccato
    button.classList.add('active');

    // Recupera la categoria ed effettua la chiamata
    const selectedCategory = button.getAttribute('data-category');
    loadCategoryNews(selectedCategory);
  });
});

// Caricamento iniziale: Top News
loadCategoryNews('top');