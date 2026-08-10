/* ═══════════════════════════════════════════════════════════════
   api/deliverables/confirm.js
   Guarda los metadatos de la entrega en la tabla `entregas`
   DESPUÉS de que el cliente subió el archivo directamente a Storage.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY   = process.env.SUPABASE_ANON_KEY;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

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

  const body = await readBody(req);
  const { projectId, nivel, studentName, title, comments, filename, filePath, sizeBytes } = body;

  if (!projectId || !studentName || !title || !filename || !filePath) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }

  // Insertar en tabla entregas usando service key (bypass RLS para INSERT)
  const dbRes = await fetch(
    `${SUPABASE_URL}/rest/v1/entregas`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey':         SUPABASE_SERVICE_KEY,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation'
      },
      body: JSON.stringify({
        proyecto_id:  projectId,
        nivel:        nivel || '',
        estudiante:   studentName,
        titulo:       title,
        comentarios:  comments || '',
        filename:     filename,
        storage_path: filePath,
        size_bytes:   sizeBytes || 0,
        estado:       'entregado'
      })
    }
  );

  if (!dbRes.ok) {
    const errText = await dbRes.text();
    console.error('Supabase DB insert error:', errText);
    return res.status(500).json({ error: 'Error al guardar la entrega: ' + errText });
  }

  const [record] = await dbRes.json();

  return res.status(201).json({ success: true, id: record?.id });
};
