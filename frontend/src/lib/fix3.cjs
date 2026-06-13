const fs = require('fs');
let code = fs.readFileSync('generateTicketPDF.ts', 'utf8');

// replace bad break 1
code = code.replace(/DOM Canvas rend\s*\n\s*er\.\.\./g, 'DOM Canvas render...');
code = code.replace(/url \?\s*`\$\{url\}&t=\$\{Date\.now\(\)\}` :\s*\n\s*`\$\{url\}\?t=\$\{Date\.now\(\)\}`/g, 'url.includes(\"?\") ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`');

// replace any dangling string literals
code = code.replace(/"\[PDF\] Fetch base64 fallback failed\. Attempting DOM Canva[^"]*er\.\.\.",/g, '"[PDF] Fetch base64 fallback failed. Attempting DOM Canvas render...",');

fs.writeFileSync('generateTicketPDF.ts', code);