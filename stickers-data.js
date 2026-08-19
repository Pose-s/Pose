export const STICKER_COLLECTION = [
  // Meme & Trend Stickers
  { id: 'cat_smug', cat: 'meme', url: 'https://cdn-icons-png.flaticon.com/512/3983/3983877.png' },
  { id: 'cat_heart', cat: 'meme', url: 'https://cdn-icons-png.flaticon.com/512/3983/3983884.png' },
  { id: 'fire_flame', cat: 'trend', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png' },
  { id: 'crown_gold', cat: 'trend', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Crown.png' },
  { id: 'heart_sparkle', cat: 'trend', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Heart%20with%20Ribbon.png' },
  { id: 'crying_sad', cat: 'meme', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Loudly%20Crying%20Face.png' },
  { id: 'laugh_rofl', cat: 'meme', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Rolling%20on%20the%20Floor%20Laughing.png' },
  { id: 'cool_sunglasses', cat: 'trend', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Smiling%20Face%20with%20Sunglasses.png' },
  { id: 'party_popper', cat: 'trend', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Partying%20Face.png' },
  { id: 'kiss_heart', cat: 'trend', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Face%20Blowing%20a%20Kiss.png' }
];

export function openStickerModal(anchorElement, onSelect) {
  document.querySelectorAll('.sticker-popover-box').forEach(el => el.remove());

  const box = document.createElement('div');
  box.className = 'sticker-popover-box';
  box.innerHTML = `
    <div class="sticker-box-header">
      <span style="font-weight:600; font-size:13px; color:#fff;">Stickers</span>
      <button type="button" class="sticker-box-close">&times;</button>
    </div>
    <div class="sticker-box-grid">
      ${STICKER_COLLECTION.map(s => `
        <button type="button" class="sticker-box-item" data-url="${s.url}">
          <img src="${s.url}" alt="sticker" loading="lazy" />
        </button>
      `).join('')}
    </div>
  `;

  document.body.appendChild(box);

  const rect = anchorElement.getBoundingClientRect();
  box.style.position = 'fixed';
  box.style.left = `${Math.min(window.innerWidth - 280, Math.max(10, rect.left - 100))}px`;
  box.style.top = `${Math.max(10, rect.top - 240)}px`;

  box.querySelector('.sticker-box-close').addEventListener('click', () => box.remove());

  box.querySelectorAll('.sticker-box-item').forEach(btn => {
    btn.addEventListener('click', () => {
      onSelect(btn.dataset.url);
      box.remove();
    });
  });

  const closeOutside = (e) => {
    if (!box.contains(e.target) && e.target !== anchorElement && !anchorElement.contains(e.target)) {
      box.remove();
      document.removeEventListener('pointerdown', closeOutside);
    }
  };
  setTimeout(() => document.addEventListener('pointerdown', closeOutside), 0);
}