const fs = require('fs');
let code = fs.readFileSync('generateTicketPDF.ts', 'utf8');

code = code.replace(/colo\r?\nr:\s*str\r?\ning/, 'color: string');
fs.writeFileSync('generateTicketPDF.ts', code);
console.log('Fixed wrap');