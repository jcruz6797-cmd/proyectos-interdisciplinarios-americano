const Busboy = require('busboy');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

const DELIVERABLES_FILE = '/tmp/deliverables.json';
const UPLOADS_DIR       = '/tmp/uploads';

function ensureDir() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(DELIVERABLES_FILE)) fs.writeFileSync(DELIVERABLES_FILE, '[]');
}

function readDeliverables() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(DELIVERABLES_FILE, 'utf8'));
  } catch { return []; }
}

function saveDeliverables(data) {
  ensureDir();
  fs.writeFileSync(DELIVERABLES_FILE, JSON.stringify(data, null, 2));
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  ensureDir();

  const fields = {};
  let fileData = null;
  let fileName = '';
  let fileSize = 0;

  const busboy = Busboy({
    headers: req.headers,
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
  });

  busboy.on('field', (name, val) => {
    fields[name] = val;
  });

  busboy.on('file', (name, stream, info) => {
    const { filename, mimeType } = info;
    fileName = filename;
    const chunks = [];

    stream.on('data', (chunk) => {
      chunks.push(chunk);
      fileSize += chunk.length;
    });

    stream.on('end', () => {
      fileData = Buffer.concat(chunks);
    });
  });

  busboy.on('finish', () => {
    if (!fields.projectId || !fields.studentName || !fields.title) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (projectId, studentName, title).' });
    }

    if (!fileData || !fileName) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }

    // Generar nombre único
    const id = crypto.randomUUID();
    const ext = path.extname(fileName);
    const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(UPLOADS_DIR, safeName);

    // Guardar archivo en /tmp
    fs.writeFileSync(filePath, fileData);

    // Crear registro de entrega
    const deliverable = {
      id,
      projectId: fields.projectId,
      studentName: fields.studentName,
      title: fields.title,
      comments: fields.comments || '',
      filename: fileName,
      filePath: `/api/deliverables/file?name=${encodeURIComponent(safeName)}`,
      fileSize,
      uploadedAt: new Date().toISOString()
    };

    // Guardar metadata
    const all = readDeliverables();
    all.push(deliverable);
    saveDeliverables(all);

    res.status(201).json(deliverable);
  });

  busboy.on('error', (err) => {
    res.status(500).json({ error: 'Error al procesar el archivo: ' + err.message });
  });

  req.pipe(busboy);
};

// Vercel: desactivar el body parser nativo para permitir streaming de multipart
module.exports.config = {
  api: {
    bodyParser: false
  }
};
