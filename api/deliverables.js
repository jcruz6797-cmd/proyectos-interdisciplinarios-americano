const path = require('path');
const fs   = require('fs');

const DELIVERABLES_FILE = '/tmp/deliverables.json';

function ensureFile() {
  if (!fs.existsSync(DELIVERABLES_FILE)) {
    fs.writeFileSync(DELIVERABLES_FILE, JSON.stringify([], null, 2));
  }
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    ensureFile();
    const data = fs.readFileSync(DELIVERABLES_FILE, 'utf8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(data);
  } catch (err) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send('[]');
  }
};
