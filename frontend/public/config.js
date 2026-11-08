// In Docker, nginx's entrypoint overwrites /usr/share/nginx/html/config.js from $API_BASE_URL at container start.
// In local dev (`npm run dev`), this file leaves API_BASE_URL empty so VITE_API_URL or the default URL is used.
window.__CONFIG__ = window.__CONFIG__ || {};

