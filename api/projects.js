const path = require('path');
const fs   = require('fs');

module.exports = (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // En Vercel el proceso corre desde la raíz del repositorio
    const filePath = path.join(process.cwd(), 'data', 'projects.json');
    const data = fs.readFileSync(filePath, 'utf8');
    res.status(200).send(data);
  } catch (err) {
    res.status(500).json({ error: 'Error al leer proyectos', detail: err.message });
  }
};
