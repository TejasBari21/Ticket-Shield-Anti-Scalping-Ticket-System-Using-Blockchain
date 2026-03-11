const fs = require('fs');
const path = require('path');

const artifactPath = path.join(__dirname, 'artifacts/contracts/EventTicket.sol/EventTicket.json');
const abiPath = path.join(__dirname, '../frontend/src/integrations/contracts/EventTicket.abi.json');

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
console.log('✅ ABI updated from artifact and saved to frontend.');