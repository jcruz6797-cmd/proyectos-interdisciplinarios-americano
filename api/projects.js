const path = require('path');
const fs   = require('fs');

module.exports = (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Vercel ejecuta desde la raíz del proyecto (/var/task)
  // Intentar múltiples rutas por compatibilidad
  const candidates = [
    path.join(process.cwd(), 'data', 'projects.json'),
    path.join(__dirname, '..', 'data', 'projects.json'),
    path.join('/var/task', 'data', 'projects.json'),
  ];

  let data = null;
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        data = fs.readFileSync(filePath, 'utf8');
        break;
      }
    } catch (_) { /* continuar */ }
  }

  if (data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(data);
  } else {
    res.status(500).json({
      error: 'No se encontró projects.json',
      cwd: process.cwd(),
      dirname: __dirname,
      candidates
    });
  }
};
