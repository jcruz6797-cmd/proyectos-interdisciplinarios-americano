const path = require('path');
const fs   = require('fs');

const DELIVERABLES_FILE = '/tmp/deliverables.json';
const UPLOADS_DIR       = '/tmp/uploads';

function readDeliverables() {
  try { return JSON.parse(fs.readFileSync(DELIVERABLES_FILE, 'utf8')); }
  catch { return []; }
}

function saveDeliverables(data) {
  fs.writeFileSync(DELIVERABLES_FILE, JSON.stringify(data, null, 2));
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Método no permitido' });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'ID requerido.' });

  const all = readDeliverables();
  const target = all.find(d => d.id === id);
  if (!target) return res.status(404).json({ error: 'Entrega no encontrada.' });

  // Borrar archivo físico
  if (target.filePath) {
    try {
      const nameParam = new URL(target.filePath, 'http://localhost').searchParams.get('name');
      if (nameParam) {
        const fp = path.join(UPLOADS_DIR, path.basename(nameParam));
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
    } catch (_) {}
  }

  const filtered = all.filter(d => d.id !== id);
  saveDeliverables(filtered);

  res.status(200).json({ success: true, id });
};
