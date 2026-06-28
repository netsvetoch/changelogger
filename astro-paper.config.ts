import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://changelogger.com/",
    title: "Changelogger",
    description: "Changelogger is a tool for managing your changelog.",
    author: "Artem Netsvetaev",
    profile: "https://github.com/netsvetoch",
    ogImage: "default-og.jpg",
    lang: "ru",
    timezone: "Asia/Yerevan",
    dir: "ltr",
  },
  posts: {
    perPage: 4,
    perIndex: 4,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: true,
      url: "https://github.com/satnaing/astro-paper/edit/main/",
    },
    search: "pagefind",
  },
  socials: [
    { name: "github",   url: "https://github.com/netsvetoch" },
    { name: "x",        url: "https://x.com/netsvetoch" },
    { name: "linkedin", url: "https://www.linkedin.com/in/netsvetoch/" },
    { name: "mail",     url: "mailto:netsvour@gmail.com" },
  ],
  shareLinks: [
    { name: "whatsapp", url: "https://wa.me/?text=" },
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "x",        url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "pinterest", url: "https://pinterest.com/pin/create/button/?url=" },
    { name: "mail",     url: "mailto:?subject=See%20this%20post&body=" },
  ],
});