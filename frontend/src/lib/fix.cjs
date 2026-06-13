const fs = require('fs');
let code = fs.readFileSync('generateTicketPDF.ts', 'utf8');

// Fix the banner y math:
code = code.replace(/    \} else \{\r?\n      console\.log\("\[PDF\] No image available, omitting banner"\);\r?\n    \}\r?\n\r?\n    const badgeY = y \+ 40;/g, '    } else {\n      console.log(\"[PDF] No image available, omitting banner\");\n    }\n\n    y += 42; // Move past banner\n\n    const badgeY = y;');

// Fix the QR layout math:
code = code.replace(/    y \+= 6;\r?\n\r?\n    \/\/ QR Code container with background\r?\n    setFillColorFromHex\(doc, COLORS\.accent\);\r?\n    const qrContainerHeight = 55;\r?\n    doc\.roundedRect\(contentX - 2, y - 2, contentW \+ 4, qrContainerHeight \+ 4, 2,\s+2, "F"\);/g, '    y += 6;\n\n    const qrStartY = y;\n    // QR Code container with background\n    setFillColorFromHex(doc, COLORS.accent);\n    const qrContainerHeight = 56;\n    doc.roundedRect(contentX, qrStartY - 2, contentW, qrContainerHeight, 4, 4, \"F\");');

code = code.replace(/doc\.addImage\(qrCode, "PNG", qrX, y, qrSize, qrSize\);/g, 'doc.addImage(qrCode, \"PNG\", qrX, qrStartY, qrSize, qrSize);');

code = code.replace(/    y \+= qrSize \+ 3;\r?\n\r?\n    \/\/ QR info text \- improved styling/g, '    const qrTextY = qrStartY + qrSize + 6;\n\n    // QR info text - improved styling');

// Fix the corrupted bullet logic and update y below container
code = code.replace(/doc\.text\("Scan for entry [^"]+ Refreshes every 30 seconds", cardX \+ cardW \/ 2,\s+y, \{/g, 'doc.text(\"Scan for entry \\u2022 Refreshes every 30 seconds\", cardX + cardW / 2, qrTextY, {');

// Fix the Section 3 part so y gets updated
code = code.replace(/      maxWidth: contentW\r?\n    \}\);\r?\n    \/\/ SECTION 3:/g, '      maxWidth: contentW\n    });\n\n    // Move y safely below the QR container\n    y = qrStartY + qrContainerHeight + 8;\n\n    // SECTION 3:');

fs.writeFileSync('generateTicketPDF.ts', code);
console.log("FIXED!");