// Emilius Meetings — Telegram-бот агентства для встреч (код бота: «DevOps Emilius/meeting_automation», не в этом репозитории).
// Страницы /meetings/ нужны для экрана согласия Google OAuth: название здесь и в Google Auth Platform → Branding → App name
// должно совпадать буква в букву.
export const MEETINGS = {
  name: 'Emilius Meetings',
  // Право, которое бот запрашивает у Google сейчас (google_onboarding.py, ACCOUNT_SCOPE). Поменяется — обновить политику.
  scope: 'https://www.googleapis.com/auth/drive',
  // Дата редакции страниц приложения
  date: '23.10.2026',
};

export const GOOGLE_LINKS = {
  userDataPolicy: 'https://developers.google.com/terms/api-services-user-data-policy',
  permissions: 'https://myaccount.google.com/connections',
};
