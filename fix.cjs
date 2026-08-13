const fs = require('fs');
let c = fs.readFileSync('src/app/api/exportar/pdf/route.ts', 'utf8');
c = c.replace(/SIGC CONT.BIL PRO/g, 'FISCAL TECH');
c = c.replace(/Sistema de Escritura..o Cont.bil-Fiscal Automatizada/g, 'Cledison Azevedo | Analista Fiscal Tributario Senior');
c = c.replace(/SIGC Cont.bil Pro/g, 'Fiscal Tech | Cledison Azevedo');
c = c.replace(/SIGC \u00b7/g, 'Fiscal Tech \u00b7');
fs.writeFileSync('src/app/api/exportar/pdf/route.ts', c, 'utf8');
console.log('OK');