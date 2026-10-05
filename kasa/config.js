/* Налаштування підключення до бази Firebase (проєкт plov-kasa).
   Це не пароль: ці дані видно в будь-якому сайті на Firebase. Доступ захищають правила бази. */
window.PLOV_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBM0dLdk5uiiaGUhoHd5x_1DEfRhtr_UfA",
  authDomain: "plov-kasa.firebaseapp.com",
  projectId: "plov-kasa",
  storageBucket: "plov-kasa.firebasestorage.app",
  messagingSenderId: "773169964838",
  appId: "1:773169964838:web:36d551539d5974e22703e7"
};

/* Стартове меню: записується в базу один раз, якщо меню там ще немає. Далі ціни міняються в «Налаштуваннях». */
window.PLOV_DEFAULT_MENU = {
  cats: ["Перші страви", "Другі страви", "Субота · Неділя", "Салати", "Випічка та нон", "Напої"],
  items: [
    { id: "shurpa", name: "Шурпа", cat: "Перші страви", price: 180 },
    { id: "lagman", name: "Лагман", cat: "Перші страви", price: 180 },
    { id: "plov", name: "Плов", cat: "Другі страви", price: 180 },
    { id: "kazan", name: "Казан кебаб", cat: "Другі страви", price: 230 },
    { id: "manti", name: "Манти", cat: "Другі страви", price: 230 },
    { id: "lula", name: "Люля-кебаб", cat: "Другі страви", price: 250 },
    { id: "plov-bar", name: "Плов з бараниною", cat: "Субота · Неділя", price: 250 },
    { id: "shashlik", name: "Шашлик з ягняти", cat: "Субота · Неділя", price: 250, per100: true },
    { id: "salat", name: "Салат", cat: "Салати", price: 100 },
    { id: "samsa", name: "Самса", cat: "Випічка та нон", price: 100 },
    { id: "non", name: "Нон", cat: "Випічка та нон", price: 80, kitchen: false },
    { id: "non-half", name: "Нон, половина", cat: "Випічка та нон", price: 50, kitchen: false },
    { id: "cola", name: "Coca-Cola", cat: "Напої", price: 50, kitchen: false },
    { id: "fanta", name: "Fanta", cat: "Напої", price: 50, kitchen: false },
    { id: "pepsi", name: "Pepsi", cat: "Напої", price: 50, kitchen: false },
    { id: "uzvar", name: "Узвар", cat: "Напої", price: 50, kitchen: false },
    { id: "ayran-s", name: "Айран малий", cat: "Напої", price: 50, kitchen: false },
    { id: "ayran-l", name: "Айран великий", cat: "Напої", price: 80, kitchen: false },
    { id: "dushes", name: "Дюшес", cat: "Напої", price: 80, kitchen: false }
  ]
};
