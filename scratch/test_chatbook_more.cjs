const http = require('http');

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function testMore() {
  const testCases = [
    { userId: 'est001', message: '¿Cuántos fueron por artículo?' },
    { userId: 'est001', message: '¿Cuántos proyectos de grado hubo en 2024?' },
    { userId: 'est001', message: '¿Hay opción de monografía?' },
    { userId: 'est001', message: '¿Cuántos se fueron por proyecto?' },
    { userId: 'est001', message: '¿Qué porcentaje corresponde a coterminalidad?' },
  ];

  for (const tc of testCases) {
    console.log(`\n========================================`);
    console.log(`Q: "${tc.message}"`);
    const res = await postJson('http://localhost:5000/api/chatbook/query', tc);
    console.log('Response:\n' + (res.data?.message || JSON.stringify(res.data)));
  }
}

testMore();
