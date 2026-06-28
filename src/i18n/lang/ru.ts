import type { UIStrings } from "../types";

export default {
  nav: {
    home: "Главная",
    posts: "Посты",
    tags: "Теги",
    about: "О проекте",
    archives: "Архив",
    search: "Поиск",
  },
  post: {
    publishedAt: "Опубликовано",
    updatedAt: "Обновлено",
    sharePostIntro: "Поделиться постом:",
    sharePostOn: "Поделиться постом в {{platform}}",
    sharePostViaEmail: "Поделиться постом по email",
    tagLabel: "Теги",
    backToTop: "Наверх",
    goBack: "Назад",
    editPage: "Редактировать страницу",
    previousPost: "Предыдущий пост",
    nextPost: "Следующий пост",
  },
  pagination: {
    prev: "Назад",
    next: "Вперед",
    page: "Страница",
  },
  home: {
    socialLinks: "Социальные ссылки",
    featured: "Избранное",
    recentPosts: "Новые посты",
    allPosts: "Все посты",
  },
  footer: {
    copyright: "Авторские права",
    allRightsReserved: "Все права защищены.",
  },
  pages: {
    tagTitle: "Тег",
    tagDesc: "Все статьи с тегом",

    tagsTitle: "Теги",
    tagsDesc: "Все теги, используемые в постах.",

    postsTitle: "Посты",
    postsDesc: "Все опубликованные статьи.",

    archivesTitle: "Архив",
    archivesDesc: "Все архивные статьи.",

    searchTitle: "Поиск",
    searchDesc: "Поиск по статьям ...",
  },
  a11y: {
    skipToContent: "Перейти к содержимому",
    openMenu: "Открыть меню",
    closeMenu: "Закрыть меню",
    toggleTheme: "Переключить тему",
    searchPlaceholder: "Искать посты...",
    noResults: "Ничего не найдено",
    goToPreviousPage: "Перейти на предыдущую страницу",
    goToNextPage: "Перейти на следующую страницу",
  },
  notFound: {
    title: "404 Не найдено",
    message: "Страница не найдена",
    goHome: "Вернуться на главную",
  },
} satisfies UIStrings;
