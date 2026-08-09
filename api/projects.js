const path = require('path');
const fs   = require('fs');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Buscar projects.json: primero en data/, luego en raíz
  const candidates = [
    path.join(__dirname, '..', 'data', 'projects.json'),
    path.join(process.cwd(), 'data', 'projects.json'),
    path.join(__dirname, '..', 'projects.json'),
    path.join(process.cwd(), 'projects.json'),
  ];

  let data = null;
  let usedPath = '';
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        data = fs.readFileSync(filePath, 'utf8');
        usedPath = filePath;
        break;
      }
    } catch (_) { /* siguiente */ }
  }

  if (data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(data);
  } else {
    res.status(500).json({
      error: 'No se encontró projects.json',
      candidates
    });
  }
};
