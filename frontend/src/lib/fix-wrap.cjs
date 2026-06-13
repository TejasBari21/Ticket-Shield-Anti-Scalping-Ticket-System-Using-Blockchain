const fs = require('fs');
let code = fs.readFileSync('generateTicketPDF.ts', 'utf8');

code = code.replace(/DOM Canva\r?\ns rend\r?\ner/gi, 'DOM Canvas render');
code = code.replace(/url\.includes\("\?"\)\ \? `\$\{url\}&t=\$\{Date\.now\(\)\}` :\n`\$\{url\}\?t=\$\{Date\.now\(\)\}`/gi, 'url.includes(\"?\") ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`');
code = code.replace(/\[parseInt\(result\[1\], 16\), parseInt\(result\[2\], 16\), parseInt\(result\[3\],\s*\r?\n16\)\]/gi, '[parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]');
code = code.replace(/console\.warn\("\[PDF\] Fetch base64 fallback failed\. Attempting DOM Canva\s*\r?\ns rend\s*\r?\ner...", fetchErr\)/gi, 'console.warn("[PDF] Fetch base64 fallback failed. Attempting DOM Canvas render...", fetchErr)');
code = code.replace(/DOM Canva\s*\n\s*s rend\s*\n\s*er\.\.\./gi, 'DOM Canvas render...');

code = code.replace(/\n\s*\n/g, '\n\n');

fs.writeFileSync('generateTicketPDF.ts', code);
console.log('Fixed wrapper lines!');