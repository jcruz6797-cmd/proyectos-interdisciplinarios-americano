const path = require('path');
const fs   = require('fs');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // En Vercel, __dirname apunta a /var/task/api/
  // data/projects.json está en /var/task/data/projects.json
  const filePath = path.join(__dirname, '..', 'data', 'projects.json');

  try {
    const data = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(data);
  } catch (err) {
    res.status(500).json({
      error: 'No se encontró projects.json',
      path: filePath,
      cwd: process.cwd(),
      __dirname,
      message: err.message
    });
  }
};
