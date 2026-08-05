// Usiamo api.allorigins.win per bypassare blocchi di rete/CORS del browser
const PROXY_URL = 'https://api.allorigins.win/get?url=';
const newsContainer = document.getElementById('news-container');
const categoryButtons = document.querySelectorAll('.cat-btn');

// Mappa dei feed RSS ufficiali BBC
const bbcFeeds = {
  top: 'https://feeds.bbci.co.uk/news/rss.xml',
  technology: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
  science_and_environment: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
  business: 'https://feeds.bbci.co.uk/news/business/rss.xml',
  world: 'https://feeds.bbci.co.uk/news/world/rss.xml'
};

// Funzione principale per scaricare e leggere l'XML
async function fetchBBCNews(categoryKey = 'top') {
  if (!newsContainer) return;

  newsContainer.innerHTML = `
    <div style="padding: 20px; text-align: center; color: #6b7280;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: #7c3aed;"></i>
      <p style="margin-top: 10px;">Caricamento ultime notizie BBC...</p>
    </div>
  `;

  const targetRssUrl = bbcFeeds[categoryKey] || bbcFeeds.top;

  try {
    // 1. Prova prima via API rss2json diretta
    const directApiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(targetRssUrl)}`;
    const res = await fetch(directApiUrl);
    const data = await res.json();

    if (data.status === 'ok' && data.items && data.items.length > 0) {
      renderArticles(data.items);
    } else {
      // 2. Se l'API standard fallisce, usa il Parser XML di backup via Proxy
      fetchFallbackXML(targetRssUrl);
    }
  } catch (err) {
    console.warn('Fallback sul proxy XML per blocco rete...', err);
    fetchFallbackXML(targetRssUrl);
  }
}

// Sistema di Backup XML nativo
async function fetchFallbackXML(rssUrl) {
  try {
    const res = await fetch(`${PROXY_URL}${encodeURIComponent(rssUrl)}`);
    const data = await res.json();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data.contents, "text/xml");
    const items = Array.from(xmlDoc.querySelectorAll("item"));

    if (items.length === 0) {
      newsContainer.innerHTML = `<div style="padding: 20px; color: #ef4444;">Impossibile recuperare le notizie. Riprova più tardi.</div>`;
      return;
    }

    const formattedArticles = items.slice(0, 10).map(item => {
      const title = item.querySelector("title")?.textContent || "Senza Titolo";
      const link = item.querySelector("link")?.textContent || "#";
      const description = item.querySelector("description")?.textContent || "";
      const pubDate = item.querySelector("pubDate")?.textContent || "";
      
      // Estrazione miniatura Media RSS
      const mediaThumbnail = item.getElementsByTagName("media:thumbnail")[0];
      const imageUrl = mediaThumbnail ? mediaThumbnail.getAttribute("url") : 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1000';

      return { title, link, description, pubDate, thumbnail: imageUrl };
    });

    renderArticles(formattedArticles);
  } catch (error) {
    console.error('Errore irreversibile:', error);
    newsContainer.innerHTML = `<div style="padding: 20px; color: #ef4444;">Errore di caricamento notizie.</div>`;
  }
}

// Generazione visiva delle schede notizia
function renderArticles(articles) {
  newsContainer.innerHTML = '';

  articles.forEach(item => {
    const imageUrl = item.thumbnail || (item.enclosure && item.enclosure.link) || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1000';
    const cleanDesc = item.description ? item.description.replace(/<[^>]*>?/gm, '') : '';
    const dateFormatted = item.pubDate ? new Date(item.pubDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : 'BBC';

    const card = document.createElement('article');
    card.className = 'news-card';

    card.innerHTML = `
      <div class="card-image-wrapper">
        <img src="${imageUrl}" alt="${item.title}">
      </div>
      <div class="news-content">
        <div class="news-meta">
          <span class="news-source">BBC NEWS</span>
          <span class="news-date"><i class="fa-regular fa-clock"></i> ${dateFormatted}</span>
        </div>
        <h2 class="news-title">
          <a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a>
        </h2>
        <p class="news-description">${cleanDesc}</p>
      </div>
    `;

    newsContainer.appendChild(card);
  });
}

// Collegamento degli eventi ai tasti
categoryButtons.forEach(button => {
  button.addEventListener('click', () => {
    categoryButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    const selectedCategory = button.getAttribute('data-category');
    fetchBBCNews(selectedCategory);
  });
});

// Avvio immediato al caricamento pagina
document.addEventListener('DOMContentLoaded', () => {
  fetchBBCNews('top');
});
// Esecuzione immediata di sicurezza
fetchBBCNews('top');