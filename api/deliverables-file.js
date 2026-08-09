const path = require('path');
const fs   = require('fs');

const UPLOADS_DIR = '/tmp/uploads';

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const fileName = req.query.name;
  if (!fileName) return res.status(400).json({ error: 'Parámetro name requerido.' });

  const safe = path.basename(fileName);
  const filePath = path.join(UPLOADS_DIR, safe);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Archivo no encontrado.' });
  }

  const ext = path.extname(safe).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.zip': 'application/zip',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp',
  };

  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${safe}"`);
  res.status(200).send(fs.readFileSync(filePath));
};
