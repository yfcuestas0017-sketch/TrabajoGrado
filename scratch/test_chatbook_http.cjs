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

async function testApi() {
  console.log('Testing Chatbook Endpoint...');
  const testCases = [
    { userId: 'est001', message: '¿Cuáles opciones de grado existen?' },
    { userId: 'est001', message: '¿Cuántos proyectos se fueron por proyecto de grado?' },
    { userId: 'est001', message: '¿Cuántos estudiantes escogieron coterminalidad?' },
    { userId: 'est001', message: '¿Cuál es la opción de grado más utilizada?' },
    { userId: 'doc001', message: '¿Cómo se distribuyen las opciones de grado?' },
    { userId: 'admin001', message: '¿Cuál es la diferencia entre proyecto de grado y coterminalidad?' },
  ];

  for (const tc of testCases) {
    console.log(`\n========================================`);
    console.log(`[User ${tc.userId}] Q: "${tc.message}"`);
    try {
      const res = await postJson('http://localhost:5000/api/chatbook/query', tc);
      console.log(`Status: ${res.status}`);
      console.log('Response Message:');
      console.log(res.data?.message || res.data);
      if (res.data?.stats) {
        console.log('Stats count:', res.data.stats.length);
      }
    } catch (e) {
      console.error('Request failed:', e.message);
    }
  }
}

testApi();
