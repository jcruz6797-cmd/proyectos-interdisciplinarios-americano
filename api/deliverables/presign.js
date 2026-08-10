/* ═══════════════════════════════════════════════════════════════
   api/deliverables/presign.js
   Genera una URL firmada para que el cliente suba DIRECTAMENTE
   a Supabase Storage (evita el límite de 4.5 MB de Vercel).
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Helper: CORS headers
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Helper: leer body como JSON
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end',  () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase no configurado. Revisa las variables de entorno en Vercel.' });
  }

  const body = await readBody(req);
  const { filename, projectId } = body;

  if (!filename || !projectId) {
    return res.status(400).json({ error: 'Faltan campos: filename, projectId' });
  }

  // Validar extensión
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const allowed = ['pdf','doc','docx','xls','xlsx','ppt','pptx','zip','rar','png','jpg','jpeg'];
  if (!allowed.includes(ext)) {
    return res.status(400).json({ error: `Extensión .${ext} no permitida.` });
  }

  // Ruta única en el bucket: proyectoId/timestamp_random.ext
  const filePath = `${projectId}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;

  // Crear URL firmada de subida en Supabase Storage
  const storageRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/upload/sign/evidencias/${filePath}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey':         SUPABASE_SERVICE_KEY,
        'Content-Type':  'application/json'
      }
    }
  );

  if (!storageRes.ok) {
    const errText = await storageRes.text();
    console.error('Supabase Storage presign error:', errText);
    return res.status(500).json({ error: 'Error al crear URL de subida: ' + errText });
  }

  const storageData = await storageRes.json();
  // storageData.url = ruta relativa  |  storageData.token = token
  const signedUrl = `${SUPABASE_URL}${storageData.url}?token=${storageData.token}`;

  return res.status(200).json({ signedUrl, filePath });
};
