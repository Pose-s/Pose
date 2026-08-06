// Sostituisci con i tuoi dati reali presi da Supabase
const SUPABASE_URL = 'https://tuo-id-progetto.supabase.co';
const SUPABASE_KEY = 'la-tua-chiave-anon-public';

// Inizializza il client
const supabase = supabase.createClient("https://bbytjhnxrhidoadgoubt.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJieXRqaG54cmhpZG9hZGdvdWJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NTYwODYsImV4cCI6MjEwMTUzMjA4Nn0.aWedNEWQU2zAb0ftYtqpqj_QGX0lpIJ7KYjGjMmpC6E");


async function fetchForYouFeed() {
  const newsContainer = document.getElementById('news-container');

  // 1. Loader di caricamento
  newsContainer.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: #64748b;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; color: #7c3aed; margin-bottom: 12px;"></i>
      <p style="font-weight: 500;">Caricamento feed Per Te...</p>
    </div>
  `;

  // 2. Chiamata al Database Supabase
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false }); // Ordine dal più recente

  if (error) {
    console.error('Errore nel recupero dei post:', error);
    newsContainer.innerHTML = `<p>Si è verificato un errore nel caricamento.</p>`;
    return;
  }

  // 3. Se non ci sono post
  if (!posts || posts.length === 0) {
    newsContainer.innerHTML = `<p style="text-align:center;">Nessun post disponibile.</p>`;
    return;
  }

  // 4. Stampa dei post a schermo
  renderPosts(posts);
}

function renderPosts(posts) {// Funzione per pubblicare un nuovo post su Supabase
async function createPost() {
  const username = document.getElementById('post-username').value;
  const caption = document.getElementById('post-caption').value;
  const mediaUrl = document.getElementById('post-imageurl').value;

  if (!caption || !mediaUrl) {
    alert('Compila almeno la descrizione e il link dell\'immagine!');
    return;
  }

  // Invia i dati a Supabase
  const { data, error } = await supabase
    .from('posts')
    .insert([
      { 
        user_name: username || 'Utente Anonimo', 
        caption: caption, 
        media_url: mediaUrl 
      }
    ]);

  if (error) {
    console.error('Errore durante la pubblicazione:', error);
    alert('Si è verificato un errore nella pubblicazione.');
  } else {
    alert('Post pubblicato con successo!');
    // Pulisci i campi di testo
    document.getElementById('post-caption').value = '';
    document.getElementById('post-imageurl').value = '';
    // Ricarica il feed per mostrare subito il nuovo post
    fetchForYouFeed();
  }
}

// Collega il click del bottone Pubblica alla funzione
document.getElementById('btn-publish').addEventListener('click', createPost);
  const newsContainer = document.getElementById('news-container');
  newsContainer.innerHTML = ''; // Pulisci il container

  posts.forEach(post => {
    const postElement = document.createElement('div');
    postElement.className = 'post-card'; // Puoi stilizzarlo in style.css
    postElement.innerHTML = `
      <div class="post-header">
        <strong>${post.user_name || 'Utente Anonimo'}</strong>
      </div>
      <img src="${post.media_url}" alt="Post image" style="width: 100%; border-radius: 8px; margin: 10px 0;" />
      <p class="post-caption"><strong>${post.user_name}:</strong> ${post.caption}</p>
      <div class="post-actions">
        <button onclick="likePost(${post.id})">❤️ ${post.likes || 0}</button>
      </div>
    `;
    newsContainer.appendChild(postElement);
  });
}
const btnHome = document.getElementById('btn-home');
const btnNews = document.getElementById('btn-news');
const createPostCard = document.getElementById('create-post-card');

// Clic su HOME
btnHome.addEventListener('click', () => {
  btnHome.classList.add('active');
  btnNews.classList.remove('active');
  createPostCard.style.display = 'block'; // Mostra il box per pubblicare
  fetchForYouFeed(); // Carica i post del social
});

// Clic su NEWS
btnNews.addEventListener('click', () => {
  btnNews.classList.add('active');
  btnHome.classList.remove('active');
  createPostCard.style.display = 'none'; // Nascondi il box per pubblicare
  fetchNews(); // Carica le notizie BBC (la tua vecchia funzione)
});