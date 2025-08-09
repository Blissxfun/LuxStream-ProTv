(async () => {
  const token = sessionStorage.getItem('token');
  const params = new URLSearchParams(window.location.search);
  const idPelicula = params.get('id');

  const tituloEl = document.getElementById('titulo');
  const imagenEl = document.getElementById('imagen');
  const descEl = document.getElementById('descripcion');

  const anoEl = document.getElementById('ano');
  const duracionEl = document.getElementById('duracion');
  const clasificacionEl = document.getElementById('clasificacion');
  const idiomaEl = document.getElementById('idioma');
  const categoriaEl = document.getElementById('categoria');
  const directorEl = document.getElementById('director');
  const actorEl = document.getElementById('actor');

  const videoEl = document.getElementById('videoPlayer');

  try {
    const res = await fetch(`/api/peliculas/${idPelicula}`);
    if (!res.ok) throw new Error('Película no encontrada');

    const p = await res.json();

    if (p.error) {
      tituloEl.textContent = 'Película no encontrada';
      return;
    }

    tituloEl.textContent = p.titulo;
    imagenEl.src = p.imagen || 'fallback.jpg';
    imagenEl.alt = `Poster de ${p.titulo}`;
    descEl.textContent = p.descripcion || 'Sin descripción disponible';

    anoEl.textContent = p.año || '-';
    duracionEl.textContent = p.duracion || '-';
    clasificacionEl.textContent = p.clasificacion || '-';
    idiomaEl.textContent = p.idioma || '-';
    categoriaEl.textContent = p.categoria || '-';
    directorEl.textContent = p.director || '-';
    actorEl.textContent = p.actor || '-';

    videoEl.src = `/stream/${p.id}`;
    videoEl.setAttribute('controls', '');
    videoEl.setAttribute('autoplay', '');

    if (token) {
      videoEl.addEventListener('loadedmetadata', () => {
        fetch(`/progreso/${idPelicula}`, {
          headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(res => res.json())
        .then(data => {
          if (data.tiempo && data.tiempo > 0 && data.tiempo < videoEl.duration) {
            videoEl.currentTime = data.tiempo;
          }
        })
        .catch(() => { /* Error silencioso */ });
      });

      setInterval(() => {
        fetch('/progreso', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ idPelicula, tiempo: videoEl.currentTime })
        }).catch(() => { /* Error silencioso */ });
      }, 10000);

      videoEl.addEventListener('ended', () => {
        fetch('/progreso', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ idPelicula, tiempo: 0 })
        });
      });
    }

  } catch (error) {
    console.error(error);
    tituloEl.textContent = 'Error al cargar la película';
  }
})();