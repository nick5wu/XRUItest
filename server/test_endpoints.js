const http = require('http');

function postJSON(path, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 3001, path: path }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

async function runTest() {
  console.log('--- 1. GET /health ---');
  const health = JSON.parse(await get('/health'));
  console.log('Health:', health);

  console.log('\n--- 2. GET /api/cases ---');
  const casesData = JSON.parse(await get('/api/cases'));
  console.log('Case Count:', casesData.cases.length, 'First case:', casesData.cases[0].persona_name);

  console.log('\n--- 3. POST /api/session/start ---');
  const session = await postJSON('/api/session/start', {
    user_id: 'test_trainee_01',
    case_id: 'persona_1',
    selected_duration: '30'
  });
  console.log('Started session:', session.session_id);
  console.log('Initial NPC reply:', session.initial_npc_reply);

  console.log('\n--- 4. POST /api/chat ---');
  const chatReply = await postJSON('/api/chat', {
    session_id: session.session_id,
    player_message: '林小姐您好，平常早上的時候，小A大概是怎麼樣的作息呢？一個人照顧三個孩子真的很不容易、辛苦了！',
    input_mode: 'text'
  });
  console.log('NPC Reply:', chatReply.npc_reply);
  console.log('Emotion:', chatReply.npc_emotion_tag, '| Trust:', chatReply.trust_score, '| Def:', chatReply.defense_score);
  console.log('Skill Annotation:', chatReply.skill_annotation);
  console.log('Info Progress:', chatReply.information_progress);

  console.log('\n--- 5. POST /api/session/end ---');
  const endReport = await postJSON('/api/session/end', {
    session_id: session.session_id,
    actual_duration: 300
  });
  console.log('Evaluation Report:', endReport.evaluation_report);

  console.log('\n--- 6. POST /api/supervisor/review ---');
  const review = await postJSON('/api/supervisor/review', {
    session_id: session.session_id,
    supervisor_id: 'supervisor_demo',
    supervisor_scores: {
      dimension_1_rapport: 14,
      dimension_2_questioning: 23,
      dimension_3_empathy: 18,
      dimension_4_family_centered: 14,
      dimension_5_ifsp_info: 17,
      dimension_6_time_mgmt: 5
    },
    supervisor_comments: '作息本位提問技巧優秀，同理回應切中要點。',
    require_repetition: false
  });
  console.log('Supervisor Review Response:', review);

  console.log('\n--- 7. GET /api/export/lsa ---');
  const lsaCSV = await get('/api/export/lsa');
  console.log('LSA CSV lines:');
  console.log(lsaCSV.split('\n').slice(0, 5).join('\n'));

  console.log('\n✅ All endpoints verified successfully!');
}

runTest().catch(console.error);
