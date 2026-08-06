// Gestione del cambio Tab Tra Home e News
function switchTab(tab) {
  const homeSection = document.getElementById('section-home');
  const newsSection = document.getElementById('section-news');
  const navHome = document.getElementById('nav-home');
  const navNews = document.getElementById('nav-news');

  if (tab === 'home') {
    homeSection.classList.remove('hidden');
    newsSection.classList.add('hidden');
    navHome.classList.add('active');
    navNews.classList.remove('active');
  } else if (tab === 'news') {
    homeSection.classList.add('hidden');
    newsSection.classList.remove('hidden');
    navHome.classList.remove('active');
    navNews.classList.add('active');
    
    // Carica le notizie solo la prima volta o le aggiorna
    fetchBbcNews();
  }
}

// Gestione dei Post nella Home
const postForm = document.getElementById('post-form');
const postsList = document.getElementById('posts-list');

postForm.addEventListener('submit', function (e) {
  e.preventDefault();

  const author = document.getElementById('post-author').value.trim();
  const content = document.getElementById('post-content').value.trim();
  const imageUrl = document.getElementById('post-image').value.trim();

  if (!content) return;

  const postCard = document.createElement('div');
  postCard.className = 'post-card';

  let imageHtml = imageUrl ? `<img src="${imageUrl}" alt="Post image" onerror="this.style.display='none'">` : '';

  postCard.innerHTML = `
    <h4>${author || 'Anonimo'}</h4>
    <p>${content}</p>
    ${imageHtml}
  `;

  postsList.prepend(postCard);

  // Reset Form
  postForm.reset();
});

// Fetch notizie BBC tramite Feed RSS
async function fetchBbcNews() {
  const newsContainer = document.getElementById('news-container');
  const loader = document.getElementById('news-loader');

  loader.style.display = 'block';
  newsContainer.innerHTML = '';

  try {
    // Usiamo l'API allorigins per convertire l'xml RSS di BBC in JSON evitando il blocco CORS
    const response = await fetch(
      'https://api.allorigins.win/get?url=' + encodeURIComponent('http://feeds.bbci.co.uk/news/rss.xml')
    );

    if (!response.ok) throw new Error('Errore di rete');

    const data = await response.json();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data.contents, "text/xml");
    const items = xmlDoc.querySelectorAll("item");

    loader.style.display = 'none';

    items.forEach(item => {
      const title = item.querySelector("title")?.textContent || 'Senza titolo';
      const description = item.querySelector("description")?.textContent || '';
      const link = item.querySelector("link")?.textContent || '#';
      const pubDate = item.querySelector("pubDate")?.textContent || '';

      const newsCard = document.createElement('div');
      newsCard.className = 'news-card';

      newsCard.innerHTML = `
        <h3>${title}</h3>
        <p>${description}</p>
        <div class="news-meta">
          <span class="news-date">${pubDate}</span>
          <a href="${link}" target="_blank" class="news-link">Leggi di più ↗</a>
        </div>
      `;

      newsContainer.appendChild(newsCard);
    });

  } catch (error) {
    loader.style.display = 'none';
    newsContainer.innerHTML = '<p style="color:red;">Impossibile caricare le notizie di BBC al momento.</p>';
    console.error("Errore fetch notizie:", error);
  }
}