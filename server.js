import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs/promises';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = 3000;

const JWT_SECRET = 'tu_secreto_super_seguro'; // Cambia esto en producción!

// Rutas a archivos JSON para usuarios y favoritos
const usersPath = path.join(process.cwd(), 'data', 'users.json');
const favoritosPath = path.join(process.cwd(), 'data', 'favoritos.json');

// Middleware
app.use(cors());
app.use(express.json());

// Servir carpeta pública
app.use(express.static(path.join(process.cwd(), 'public')));

// Funciones para leer y escribir JSON de forma segura
async function leerJSON(ruta) {
  try {
    const data = await fs.readFile(ruta, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function escribirJSON(ruta, datos) {
  await fs.writeFile(ruta, JSON.stringify(datos, null, 2), 'utf-8');
}

// Servir index.html raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// URL RAW del JSON en GitHub con películas
const urlPeliculas = 'https://raw.githubusercontent.com/Blissxfun/LuxStream/main/peliculas.json';

// Endpoint para obtener todas las películas
app.get('/api/peliculas', async (req, res) => {
  try {
    const response = await fetch(urlPeliculas);
    if (!response.ok) throw new Error('Error al obtener JSON');
    const peliculas = await response.json();
    res.json(peliculas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener una película por ID
app.get('/api/peliculas/:id', async (req, res) => {
  try {
    const response = await fetch(urlPeliculas);
    if (!response.ok) throw new Error('Error al obtener JSON');
    const peliculas = await response.json();
    const pelicula = peliculas.find(p => p.id == req.params.id);
    if (!pelicula) return res.status(404).json({ error: 'Película no encontrada' });
    res.json(pelicula);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta streaming que redirige al URL remoto del video
app.get('/stream/:id', async (req, res) => {
  try {
    const response = await fetch(urlPeliculas);
    if (!response.ok) throw new Error('Error al obtener JSON');
    const peliculas = await response.json();
    const pelicula = peliculas.find(p => p.id == req.params.id);
    if (!pelicula) return res.status(404).send('Película no encontrada');

    // Redirige a la URL remota donde está el video
    return res.redirect(pelicula.url);

  } catch (error) {
    res.status(500).send('Error interno: ' + error.message);
  }
});

// --- Autenticación y manejo de usuarios ---

// Registrar usuario
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Faltan datos' });

  const users = await leerJSON(usersPath);

  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Usuario ya existe' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = { id: Date.now().toString(), email, passwordHash };
  users.push(newUser);
  await escribirJSON(usersPath, users);

  res.json({ message: 'Usuario registrado con éxito' });
});

// Login usuario
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Faltan datos' });

  const users = await leerJSON(usersPath);
  const user = users.find(u => u.email === email);
  if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

  const validPass = await bcrypt.compare(password, user.passwordHash);
  if (!validPass) return res.status(400).json({ error: 'Contraseña incorrecta' });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// Middleware para proteger rutas con token
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No autorizado' });

  const token = authHeader.split(' ')[1];
  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// Obtener favoritos del usuario autenticado
app.get('/api/favoritos', authMiddleware, async (req, res) => {
  const favoritos = await leerJSON(favoritosPath);
  const userFavoritos = favoritos.find(f => f.userId === req.user.id);
  res.json(userFavoritos?.favoritos || []);
});

// Agregar o quitar favorito
app.post('/api/favoritos', authMiddleware, async (req, res) => {
  const { peliculaId } = req.body;
  if (!peliculaId) return res.status(400).json({ error: 'Falta id de película' });

  const favoritos = await leerJSON(favoritosPath);
  let userFavoritos = favoritos.find(f => f.userId === req.user.id);

  if (!userFavoritos) {
    userFavoritos = { userId: req.user.id, favoritos: [] };
    favoritos.push(userFavoritos);
  }

  if (userFavoritos.favoritos.includes(peliculaId)) {
    userFavoritos.favoritos = userFavoritos.favoritos.filter(id => id !== peliculaId);
  } else {
    userFavoritos.favoritos.push(peliculaId);
  }

  await escribirJSON(favoritosPath, favoritos);
  res.json({ favoritos: userFavoritos.favoritos });
});

// Puedes crear rutas similares para "ver más tarde" usando otra estructura JSON similar a favoritos

// --- FIN autenticación y favoritos ---

// Funciones para leer y guardar progresos de usuario en un JSON (archivo `data/progresos.json`)
async function leerProgresos() {
  try {
    const data = await fs.readFile(path.join(process.cwd(), 'data', 'progresos.json'), 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function guardarProgresos(progresos) {
  await fs.writeFile(path.join(process.cwd(), 'data', 'progresos.json'), JSON.stringify(progresos, null, 2));
}

// Endpoint para guardar el progreso del video
app.post('/progreso', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    const userId = validarTokenYObtenerUserId(token); // Aquí debes tener tu función para extraer userId del token
    if (!userId) return res.status(401).json({ error: 'Token inválido' });

    const { idPelicula, tiempo } = req.body;
    if (!idPelicula || typeof tiempo !== 'number') return res.status(400).json({ error: 'Datos incompletos' });

    const progresos = await leerProgresos();
    let userProgreso = progresos.find(p => p.userId === userId);

    if (!userProgreso) {
      userProgreso = { userId, progresos: {} };
      progresos.push(userProgreso);
    }

    userProgreso.progresos[idPelicula] = tiempo;
    await guardarProgresos(progresos);

    res.json({ message: 'Progreso guardado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener el progreso guardado de un video
app.get('/progreso/:idPelicula', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    const userId = validarTokenYObtenerUserId(token);
    if (!userId) return res.status(401).json({ error: 'Token inválido' });

    const idPelicula = req.params.idPelicula;
    const progresos = await leerProgresos();
    const userProgreso = progresos.find(p => p.userId === userId);

    const tiempo = userProgreso?.progresos[idPelicula] || 0;
    res.json({ tiempo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
