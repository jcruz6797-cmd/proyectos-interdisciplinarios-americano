/* ═══════════════════════════════════════════════════════════════
   api/deliverables/confirmations.js
   Devuelve los metadatos públicos de entregas registradas.
   NO devuelve los archivos (filePath) ni comentarios privados.
   Permite al estudiante verificar que su entrega fue exitosa.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(200).json([]); // Fallback vacío si no hay backend
  }

  // Hacer consulta pública limitada utilizando la anon key pública
  const dbRes = await fetch(
    `${SUPABASE_URL}/rest/v1/entregas?select=proyecto_id,estudiante,titulo,created_at&order=created_at.desc`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey':         SUPABASE_ANON_KEY
      }
    }
  );

  if (!dbRes.ok) {
    // Si falla la consulta o no existe la tabla, retornamos vacío preventivamente
    return res.status(200).json([]);
  }

  const data = await dbRes.json();

  // Mapeamos al formato que espera el frontend (app.js)
  const mapped = data.map(d => ({
    projectId:   d.proyecto_id,
    studentName: d.estudiante,
    title:       d.titulo,
    uploadDate:  d.created_at
  }));

  return res.status(200).json(mapped);
};
