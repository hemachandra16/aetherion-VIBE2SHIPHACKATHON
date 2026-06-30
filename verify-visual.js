const { chromium } = require('playwright');

const BASE = 'https://aetherion-308059826502.asia-south1.run.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  console.log('=== Visual UI Verification ===\n');

  // Test 1: Login page renders correctly
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
  await page.screenshot({ path: 'D:\\hackathon1\\screenshots\\01-login.png', fullPage: true });
  console.log('1. Login page captured');

  // Test 2: Check the home page structure by simulating auth state
  // We can't sign in with Google, but we can check all route structures load
  await page.goto(BASE + '/home', { waitUntil: 'networkidle', timeout: 15000 });
  await page.screenshot({ path: 'D:\\hackathon1\\screenshots\\02-home-unauth.png', fullPage: true });
  console.log('2. Home route (unauthenticated) captured');

  // Test 3: Crisis mode route
  await page.goto(BASE + '/last-minute', { waitUntil: 'networkidle', timeout: 15000 });
  await page.screenshot({ path: 'D:\\hackathon1\\screenshots\\03-crisis-unauth.png', fullPage: true });
  console.log('3. Crisis mode route captured');

  // Test 4: Disruption mode route
  await page.goto(BASE + '/disruption', { waitUntil: 'networkidle', timeout: 15000 });
  await page.screenshot({ path: 'D:\\hackathon1\\screenshots\\04-disruption-unauth.png', fullPage: true });
  console.log('4. Disruption mode route captured');

  // Test 5: Check the full HTML structure of login page
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  const html = await page.content();
  const checks = [
    ['AETHERION branding', html.includes('AETH') && html.includes('ER') && html.includes('ION')],
    ['Google Sign-In button', html.includes('google-signin-btn')],
    ['Auth screen class', html.includes('auth-screen')],
    ['Tagline', html.includes('AI that doesn\'t remind you')],
    ['Firebase app ID', html.includes('c0bba82eef50391bf99d47') || html.includes('VITE_FIREBASE')],
  ];

  console.log('\n5. HTML structure checks:');
  checks.forEach(([name, result]) => {
    console.log(`   ${result ? 'PASS' : 'FAIL'}: ${name}`);
  });

  // Test 6: Check assets load
  const cssLoaded = await page.evaluate(() => {
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    return links.length;
  });
  console.log(`\n6. CSS stylesheets loaded: ${cssLoaded}`);

  const jsLoaded = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script[src]');
    return scripts.length;
  });
  console.log(`   JS scripts loaded: ${jsLoaded}`);

  // Test 7: Full API integration test with plan generation
  console.log('\n7. Full plan generation test...');
  let response = await page.evaluate(() =>
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'I have a coding hackathon submission due tomorrow at 2pm. I still need to finish the frontend, write the README, and deploy. It is currently 10pm tonight.',
        session_id: 'visual_test',
        conversation_history: []
      })
    }).then(r => r.json())
  );

  // If clarification, send follow-up
  if (response.type === 'clarification') {
    response = await page.evaluate(() =>
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hackathon coding project, due tomorrow 2pm. Need to finish frontend React component, write README.md, deploy to Google Cloud Run. Current time 10pm, deadline 14 hours away. I have about 8 hours of actual work time.',
          session_id: 'visual_test',
          conversation_history: []
        })
      }).then(r => r.json())
    );
  }

  if (response.type === 'plan') {
    console.log(`   Plan type: ${response.type}`);
    console.log(`   Steps: ${response.plan?.steps?.length}`);
    console.log(`   Confidence: ${response.confidence?.score}% — ${response.confidence?.label}`);
    console.log(`   Urgency: ${response.triage?.urgency}`);
    console.log(`   Task type: ${response.triage?.task_type}`);
    console.log(`   Time remaining: ${response.triage?.time_remaining_minutes} minutes`);

    if (response.plan?.steps) {
      console.log('\n   Plan steps:');
      response.plan.steps.forEach((s, i) => {
        const cut = s.cut ? ' [CUT]' : '';
        console.log(`   ${i + 1}. ${s.title} (${s.duration_minutes}m)${cut}`);
      });
    }

    if (response.plan?.nice_to_haves) {
      console.log('\n   Nice-to-haves:');
      response.plan.nice_to_haves.forEach(n => console.log(`   - ${n}`));
    }
  } else {
    console.log(`   Response: ${response.type} — ${JSON.stringify(response).substring(0, 200)}`);
  }

  // Test 8: Check all components render correctly
  console.log('\n8. Component files present:');
  const fs = require('fs');
  const components = ['BurnBar', 'ConfidenceMeter', 'FileUpload', 'PlanView', 'ReasoningTrace'];
  components.forEach(c => {
    const exists = fs.existsSync(`D:\\hackathon1\\frontend\\src\\components\\${c}.jsx`);
    console.log(`   ${exists ? 'PASS' : 'FAIL'}: ${c}.jsx`);
  });

  // Test 9: Check backend agent files
  console.log('\n9. Backend agent files:');
  const agents = ['pipeline', 'gemini_client', 'rag', 'confidence', 'integrations', 'oauth', 'session_store'];
  agents.forEach(a => {
    const exists = fs.existsSync(`D:\\hackathon1\\backend\\agents\\${a}.py`);
    console.log(`   ${exists ? 'PASS' : 'FAIL'}: ${a}.py`);
  });

  console.log('\n=== Done ===');
  await browser.close();
})();
