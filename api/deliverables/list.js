/* ═══════════════════════════════════════════════════════════════
   api/deliverables/list.js
   Devuelve TODAS las entregas — requiere token JWT del docente.
   Sin token válido → 401.
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

// Verifica que el token corresponde a un usuario autenticado en Supabase Auth
async function verifyToken(token) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey':         SUPABASE_ANON_KEY
    }
  });
  if (!r.ok) return null;
  return await r.json(); // { id, email, ... }
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'Se requiere autenticación de docente.' });
  }

  const user = await verifyToken(token);
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }

  // Consultar todas las entregas con service key
  const dbRes = await fetch(
    `${SUPABASE_URL}/rest/v1/entregas?select=*&order=created_at.desc`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey':         SUPABASE_SERVICE_KEY
      }
    }
  );

  if (!dbRes.ok) {
    const errText = await dbRes.text();
    return res.status(500).json({ error: 'Error al leer entregas: ' + errText });
  }

  const data = await dbRes.json();
  return res.status(200).json(data);
};
