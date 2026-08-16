export const translations = {
  it: {
    nav_news: "News",
    nav_home: "Home",
    nav_profile: "Profilo",
    btn_logout: "Esci",
    settings_title: "Impostazioni",
    appearance: "Aspetto",
    dark_theme: "Tema scuro",
    language_label: "Lingua dell'app",
    account_mgmt: "Gestione account",
    current_email: "Email attuale:",
    new_email: "Nuova email",
    curr_pwd_confirm: "Password attuale (per conferma)",
    btn_change_email: "Cambia email",
    curr_pwd: "Password attuale",
    new_pwd: "Nuova password",
    btn_change_pwd: "Cambia password",
    edit_profile_link: "Modifica bio, foto e username →",
    blocked_users: "Utenti bloccati",
    stories: "Storie",
    story_duration: "Durata di visualizzazione",
    btn_save: "Salva",
    saved_title: "Salvati",
    saved_desc: "Post e storie che hai salvato.",
    open_saved: "Apri i salvati →",
    legal_privacy: "Legali e Privacy",
    cookie_mgmt: "Gestione Cookie",
    session_title: "Sessione",
    logout_account: "Esci dall'account"
  },
  en: {
    nav_news: "News",
    nav_home: "Home",
    nav_profile: "Profile",
    btn_logout: "Log out",
    settings_title: "Settings",
    appearance: "Appearance",
    dark_theme: "Dark theme",
    language_label: "App language",
    account_mgmt: "Account management",
    current_email: "Current email:",
    new_email: "New email",
    curr_pwd_confirm: "Current password (to confirm)",
    btn_change_email: "Change email",
    curr_pwd: "Current password",
    new_pwd: "New password",
    btn_change_pwd: "Change password",
    edit_profile_link: "Edit bio, photo and username →",
    blocked_users: "Blocked users",
    stories: "Stories",
    story_duration: "Display duration",
    btn_save: "Save",
    saved_title: "Saved",
    saved_desc: "Posts and stories you saved.",
    open_saved: "Open saved →",
    legal_privacy: "Legal & Privacy",
    cookie_mgmt: "Cookie Management",
    session_title: "Session",
    logout_account: "Log out of account"
  },
  pt: {
    nav_news: "Notícias",
    nav_home: "Início",
    nav_profile: "Perfil",
    btn_logout: "Sair",
    settings_title: "Configurações",
    appearance: "Aparência",
    dark_theme: "Tema escuro",
    language_label: "Idioma do aplicativo",
    account_mgmt: "Gerenciamento de conta",
    current_email: "E-mail atual:",
    new_email: "Novo e-mail",
    curr_pwd_confirm: "Senha atual (para confirmação)",
    btn_change_email: "Alterar e-mail",
    curr_pwd: "Senha atual",
    new_pwd: "Nova senha",
    btn_change_pwd: "Alterar senha",
    edit_profile_link: "Editar biografia, foto e nome de usuário →",
    blocked_users: "Usuários bloqueados",
    stories: "Histórias",
    story_duration: "Duração de exibição",
    btn_save: "Salvar",
    saved_title: "Salvos",
    saved_desc: "Publicações e histórias salvas.",
    open_saved: "Abrir salvos →",
    legal_privacy: "Legal e Privacidade",
    cookie_mgmt: "Gerenciar Cookies",
    session_title: "Sessão",
    logout_account: "Sair da conta"
  },
  es: {
    nav_news: "Noticias",
    nav_home: "Inicio",
    nav_profile: "Perfil",
    btn_logout: "Cerrar sesión",
    settings_title: "Ajustes",
    appearance: "Apariencia",
    dark_theme: "Tema oscuro",
    language_label: "Idioma de la aplicación",
    account_mgmt: "Gestión de cuenta",
    current_email: "Correo actual:",
    new_email: "Nuevo correo",
    curr_pwd_confirm: "Contraseña actual (para confirmar)",
    btn_change_email: "Cambiar correo",
    curr_pwd: "Contraseña actual",
    new_pwd: "Nueva contraseña",
    btn_change_pwd: "Cambiar contraseña",
    edit_profile_link: "Editar biografía, foto y usuario →",
    blocked_users: "Usuarios bloqueados",
    stories: "Historias",
    story_duration: "Duración de visualización",
    btn_save: "Guardar",
    saved_title: "Guardados",
    saved_desc: "Publicaciones e historias guardadas.",
    open_saved: "Abrir guardados →",
    legal_privacy: "Legales y Privacidad",
    cookie_mgmt: "Gestión de Cookies",
    session_title: "Sesión",
    logout_account: "Cerrar sesión de la cuenta"
  }
};

export function applyLanguage(lang = null) {
  const currentLang = lang || localStorage.getItem('app_lang') || 'it';
  const dict = translations[currentLang] || translations.it;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = dict[key];
      } else {
        el.textContent = dict[key];
      }
    }
  });

  document.documentElement.lang = currentLang;
}