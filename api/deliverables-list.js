const fs = require('fs');

const DELIVERABLES_FILE = '/tmp/deliverables.json';

function ensureFile() {
  if (!fs.existsSync(DELIVERABLES_FILE)) {
    fs.writeFileSync(DELIVERABLES_FILE, JSON.stringify([], null, 2));
  }
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    ensureFile();
    const data = fs.readFileSync(DELIVERABLES_FILE, 'utf8');
    res.status(200).send(data);
  } catch (err) {
    res.status(200).send('[]');
  }
};
