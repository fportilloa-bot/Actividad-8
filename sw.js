const CACHE = "pokedex-v1";
const BASE = ["./", "index.html", "styles.css", "pokemon.js", "manifest.json", "icon-192.png", "icon-512.png"];

// Al instalar: guarda los archivos básicos de la app
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)));
  self.skipWaiting();
});

// Al activarse: borra cachés viejos
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(claves =>
      Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Primero intenta internet y guarda una copia; si no hay conexión, usa la copia guardada
self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if(r.ok){
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});