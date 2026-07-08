/* Простое хранилище карт поверх localStorage.
   Данные никогда не покидают устройство пользователя. */

const DB_KEY = 'wallet_pwa_cards_v1';

function uid() {
  return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

function loadCards() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Не удалось прочитать хранилище карт', e);
    return [];
  }
}

function saveCards(cards) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(cards));
    return true;
  } catch (e) {
    console.error('Не удалось сохранить карты', e);
    return false;
  }
}
