const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// ── Crear carpetas necesarias ────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const DELIVERABLES_FILE = path.join(DATA_DIR, 'deliverables.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DELIVERABLES_FILE)) fs.writeFileSync(DELIVERABLES_FILE, '[]', 'utf8');

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Multer: configuración de subida ─────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safe = file.originalname.replace(/\s+/g, '_');
    cb(null, `${timestamp}_${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function readDeliverables() {
  try {
    const raw = fs.readFileSync(DELIVERABLES_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeDeliverables(data) {
  fs.writeFileSync(DELIVERABLES_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function generateId() {
  return `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Rutas API ────────────────────────────────────────────────────────────────

// GET /api/projects
app.get('/api/projects', (req, res) => {
  try {
    const raw = fs.readFileSync(PROJECTS_FILE, 'utf8');
    res.json(JSON.parse(raw));
  } catch (err) {
    res.status(500).json({ error: 'No se pudo leer projects.json', detail: err.message });
  }
});

// GET /api/deliverables
app.get('/api/deliverables', (req, res) => {
  res.json(readDeliverables());
});

// POST /api/deliverables/upload
app.post('/api/deliverables/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }

    const { projectId, studentName, title, comments } = req.body;

    if (!projectId || !studentName || !title) {
      return res.status(400).json({ error: 'Faltan campos requeridos: projectId, studentName, title.' });
    }

    const deliverable = {
      id: generateId(),
      projectId,
      studentName: studentName.trim(),
      title: title.trim(),
      comments: (comments || '').trim(),
      filename: req.file.originalname,
      filePath: `/uploads/${req.file.filename}`,
      sizeBytes: req.file.size,
      uploadDate: new Date().toISOString()
    };

    const deliverables = readDeliverables();
    deliverables.push(deliverable);
    writeDeliverables(deliverables);

    res.status(201).json(deliverable);
  } catch (err) {
    res.status(500).json({ error: 'Error al procesar la entrega.', detail: err.message });
  }
});

// DELETE /api/deliverables/:id
app.delete('/api/deliverables/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deliverables = readDeliverables();
    const index = deliverables.findIndex(d => d.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Entrega no encontrada.' });
    }

    const [removed] = deliverables.splice(index, 1);
    writeDeliverables(deliverables);

    // Eliminar archivo físico
    const physicalPath = path.join(__dirname, 'uploads', path.basename(removed.filePath));
    if (fs.existsSync(physicalPath)) {
      fs.unlinkSync(physicalPath);
    }

    res.json({ message: 'Entrega eliminada correctamente.', id });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar la entrega.', detail: err.message });
  }
});

// ── Iniciar servidor ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅  Servidor iniciado en http://localhost:${PORT}`);
  console.log(`📁  Archivos subidos en: ${UPLOADS_DIR}`);
  console.log(`📄  Datos en: ${DATA_DIR}\n`);
});
