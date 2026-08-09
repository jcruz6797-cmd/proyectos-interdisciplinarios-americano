const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde la raíz
app.use(express.static(__dirname));

// Ruta del archivo de proyectos
const PROJECTS_FILE = fs.existsSync(path.join(__dirname, 'projects.json'))
  ? path.join(__dirname, 'projects.json')
  : path.join(__dirname, 'data', 'projects.json');

// Ruta temporal para entregas
const DELIVERABLES_FILE = path.join('/tmp', 'deliverables.json');
if (!fs.existsSync(DELIVERABLES_FILE)) {
  fs.writeFileSync(DELIVERABLES_FILE, JSON.stringify([], null, 2));
}

// API de proyectos
app.get('/api/projects', (req, res) => {
  try {
    const data = fs.readFileSync(PROJECTS_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Error al leer proyectos' });
  }
});

// API de entregas
app.get('/api/deliverables', (req, res) => {
  try {
    const data = fs.readFileSync(DELIVERABLES_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.json([]);
  }
});

// Ruta por defecto para index.html
app.get('*', (req, res) => {
  const indexPath = fs.existsSync(path.join(__dirname, 'index.html'))
    ? path.join(__dirname, 'index.html')
    : path.join(__dirname, 'public', 'index.html');
  res.sendFile(indexPath);
});

// Exportar servidor para Vercel Serverless
module.exports = app;
