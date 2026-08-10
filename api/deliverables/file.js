/* ═══════════════════════════════════════════════════════════════
   api/deliverables/file.js
   Genera una URL firmada de descarga (60 min) para un archivo.
   Requiere token JWT del docente + id de la entrega.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY   = process.env.SUPABASE_ANON_KEY;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function verifyToken(token) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey':         SUPABASE_ANON_KEY
    }
  });
  if (!r.ok) return null;
  return await r.json();
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  // Autenticación docente
  const auth  = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Se requiere autenticación.' });

  const user = await verifyToken(token);
  if (!user?.id) return res.status(401).json({ error: 'Token inválido o expirado.' });

  // ?id=UUID de la entrega
  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: 'Se requiere el id de la entrega.' });

  // Obtener storage_path del registro
  const dbRes = await fetch(
    `${SUPABASE_URL}/rest/v1/entregas?id=eq.${encodeURIComponent(id)}&select=storage_path,filename`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey':         SUPABASE_SERVICE_KEY
      }
    }
  );

  if (!dbRes.ok) return res.status(500).json({ error: 'Error al buscar entrega.' });
  const [record] = await dbRes.json();
  if (!record) return res.status(404).json({ error: 'Entrega no encontrada.' });

  // Generar URL firmada de descarga (3600 segundos = 1 hora)
  const signRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/evidencias/${record.storage_path}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey':         SUPABASE_SERVICE_KEY,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({ expiresIn: 3600 })
    }
  );

  if (!signRes.ok) {
    const errText = await signRes.text();
    return res.status(500).json({ error: 'Error al generar URL de descarga: ' + errText });
  }

  const signData = await signRes.json();
  // signData.signedURL  = ruta relativa al storage
  const downloadUrl = `${SUPABASE_URL}/storage/v1${signData.signedURL}`;

  return res.status(200).json({
    signedUrl: downloadUrl,
    filename:  record.filename
  });
};
