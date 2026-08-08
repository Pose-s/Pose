(function() {
  if (localStorage.getItem('pose_cookie_consent')) return;

  const banner = document.createElement('div');
  banner.className = 'cookie-banner';
  banner.innerHTML = `
    <p>Questo sito utilizza cookie tecnici necessari al funzionamento (login, sessione). Continuando la navigazione accetti il loro utilizzo. <a href="privacy.html">Privacy Policy</a></p>
    <button id="cookieAcceptBtn">Ho capito</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('cookieAcceptBtn').addEventListener('click', () => {
    localStorage.setItem('pose_cookie_consent', 'true');
    banner.remove();
  });
})();