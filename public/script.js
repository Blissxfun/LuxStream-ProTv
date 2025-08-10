const API_URL = window.location.hostname.includes("localhost") 
  ? "http://localhost:3000" 
  : "https://luxstream-protv.onrender.com";

let peliculas = [];

// Función para cargar favoritos del usuario logueado (si hay token)
async function cargarFavoritos() {
  const token = sessionStorage.getItem('token');
  if (!token) return [];

  try {
    const res = await fetch(`${API_URL}/favoritos`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.favoritos || [];
  } catch {
    return [];
  }
}

// Función para mostrar estado del usuario en header
function mostrarEstadoUsuario() {
  const userDiv = document.getElementById('user-info');
  const token = sessionStorage.getItem('token');

  if (token) {
    userDiv.innerHTML = `
      <span>Usuario activo</span> |
      <a href="#" id="logout" style="color:#ff3c78;">Cerrar sesión</a>
    `;

    document.getElementById('logout').addEventListener('click', e => {
      e.preventDefault();
      sessionStorage.removeItem('token');
      location.reload();
    });
  } else {
    userDiv.innerHTML = `
      <a href="login.html" style="color:#ff3c78;">Entrar</a> |
      <a href="register.html" style="color:#ff3c78;">Registrar</a>
    `;
  }
}

// Función para mostrar películas en pantalla con botón favorito solo si está logueado
async function mostrarPeliculas(lista) {
  const contenedor = document.getElementById('lista-peliculas');
  contenedor.innerHTML = '';

  const token = sessionStorage.getItem('token');
  const favoritos = token ? await cargarFavoritos() : [];

  lista.forEach(p => {
    const esFavorito = favoritos.includes(p.id);
    contenedor.innerHTML += `
      <div class="pelicula" tabindex="0" aria-label="${p.titulo}">
        <img src="${p.imagen}" alt="Portada de ${p.titulo}" loading="lazy" />
        <div class="pelicula-info">
          <h3>${p.titulo}</h3>
          <div class="botones">
            <a href="ver.html?id=${p.id}" aria-label="Ver más sobre ${p.titulo}">Ver más</a>
            ${token ? `
              <button class="btn-fav" data-id="${p.id}" aria-pressed="${esFavorito}" aria-label="${esFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
                ${esFavorito ? '❤️ Quitar favorito' : '🤍 Agregar favorito'}
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  });

  // Evento para toggle favoritos
  if (token) {
    document.querySelectorAll('.btn-fav').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idPelicula = btn.getAttribute('data-id');

        try {
          const res = await fetch(`${API_URL}/favoritos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ idPelicula })
          });

          if (res.ok) {
            const esAhoraFavorito = btn.textContent.includes('Agregar');
            btn.textContent = esAhoraFavorito ? '❤️ Quitar favorito' : '🤍 Agregar favorito';
            btn.setAttribute('aria-pressed', esAhoraFavorito ? 'true' : 'false');
            btn.setAttribute('aria-label', esAhoraFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos');
          } else {
            alert('Error al actualizar favoritos');
          }
        } catch {
          alert('Error de conexión');
        }
      });
    });
  }
}

// Cargar películas desde la API y mostrar
fetch(`${API_URL}/api/peliculas`)
  .then(res => res.json())
  .then(data => {
    peliculas = data;
    mostrarPeliculas(peliculas);
    mostrarEstadoUsuario();
  })
  .catch(err => console.error(err));

// Búsqueda en tiempo real
document.getElementById('buscador').addEventListener('input', e => {
  const texto = e.target.value.toLowerCase();
  const filtradas = peliculas.filter(p => p.titulo.toLowerCase().includes(texto));
  mostrarPeliculas(filtradas);
});
