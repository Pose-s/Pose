// Funzione per cambiare la schermata visibile (News vs Home)
function switchTab(tabName) {
  const newsSection = document.getElementById('news-section');
  const homeSection = document.getElementById('home-section');
  const btnNews = document.getElementById('btn-news');
  const btnHome = document.getElementById('btn-home');

  if (tabName === 'news') {
    newsSection.classList.remove('hidden');
    homeSection.classList.add('hidden');
    btnNews.classList.add('active');
    btnHome.classList.remove('active');
  } else if (tabName === 'home') {
    homeSection.classList.remove('hidden');
    newsSection.classList.add('hidden');
    btnHome.classList.add('active');
    btnNews.classList.remove('active');
  }
}

// Logica al click sul pulsante (+) nella sezione Home
document.addEventListener('DOMContentLoaded', () => {
  const createPostBtn = document.getElementById('create-post-btn');

  if (createPostBtn) {
    createPostBtn.addEventListener('click', () => {
      console.log('Pulsante genera post premuto!');
      // Qui aggiungeremo la logica per generare/aprire la finestra del post
    });
  }
});