async function testEndpoints() {
  const base = 'http://localhost:5000/api';

  try {
    console.log('1. Testing /health...');
    const health = await fetch(`${base}/health`).then(r => r.json());
    console.log('Health OK:', health);

    console.log('2. Testing /catalogs...');
    const catalogs = await fetch(`${base}/catalogs`).then(r => r.json());
    console.log(`Catalogs OK: ${catalogs.statuses.length} statuses, ${catalogs.modalities.length} modalities, ${catalogs.lines.length} lines, ${catalogs.sublines.length} sublines, ${catalogs.semesters.length} semesters`);

    console.log('3. Testing /projects...');
    const projects = await fetch(`${base}/projects`).then(r => r.json());
    console.log(`Projects OK: ${projects.length} projects retrieved`);

    if (projects.length > 0) {
      const sampleProj = projects[0];
      console.log(`Project sample: ID=${sampleProj.project_id}, title="${sampleProj.title}"`);

      console.log(`4. Testing /projects/${sampleProj.project_id}/research-progress...`);
      const prog = await fetch(`${base}/projects/${sampleProj.project_id}/research-progress?userId=test`).then(r => r.json());
      console.log(`Research progress OK:`, prog);

      console.log(`5. Testing /projects/${sampleProj.project_id}/research-documents...`);
      const docs = await fetch(`${base}/projects/${sampleProj.project_id}/research-documents?userId=test`).then(r => r.json());
      console.log(`Research documents OK:`, docs);
    }

    console.log('🎉 Todos los endpoints responden correctamente!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error testing endpoints:', err);
    process.exit(1);
  }
}

testEndpoints();
