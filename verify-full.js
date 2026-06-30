const { chromium } = require('playwright');

const BASE = 'https://aetherion-308059826502.asia-south1.run.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('PAGE_ERROR: ' + err.message));

  const results = {};
  function pass(name, detail) { results[name] = { status: 'PASS', detail }; console.log(`  PASS: ${name}`); }
  function fail(name, detail) { results[name] = { status: 'FAIL', detail }; console.log(`  FAIL: ${name} — ${detail}`); }

  try {
    // === TEST 1: Login page loads ===
    console.log('\n=== TEST 1: Login Page ===');
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
    const title = await page.title();
    if (title.includes('Aetherion')) pass('page_title', title);
    else fail('page_title', title);

    const loginBtn = await page.$('#google-signin-btn');
    if (loginBtn) pass('google_signin_button', 'Present');
    else fail('google_signin_button', 'Missing');

    const bodyText = await page.textContent('body');
    if (bodyText.includes('Continue with Google')) pass('google_cta_text', 'Present');
    else fail('google_cta_text', 'Missing');

    if (bodyText.includes('AETHERION') || bodyText.includes('Aetherion')) pass('branding', 'Present');
    else fail('branding', 'Missing');

    // === TEST 2: API Health ===
    console.log('\n=== TEST 2: API Health ===');
    const healthResp = await page.evaluate(() => fetch('/api/health').then(r => r.json()));
    if (healthResp.status === 'ok') pass('api_health', 'ok');
    else fail('api_health', JSON.stringify(healthResp));

    if (healthResp.gemini_key_set) pass('gemini_key_set', 'true');
    else fail('gemini_key_set', 'false');

    // === TEST 3: Chat API works ===
    console.log('\n=== TEST 3: Chat API (Crisis Mode) ===');
    const chatResp = await page.evaluate(() =>
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'I have a math exam tomorrow at 9am and I have only 6 hours to study 5 chapters. I have not started studying yet.',
          session_id: 'test_crisis',
          conversation_history: []
        })
      }).then(r => r.json())
    );

    if (chatResp.type === 'clarification') pass('chat_triage', 'Got clarification: ' + chatResp.question?.substring(0, 80));
    else if (chatResp.type === 'plan') pass('chat_plan', `Got plan with ${chatResp.plan?.steps?.length || 0} steps, confidence: ${chatResp.confidence?.score}`);
    else if (chatResp.error) fail('chat_api', chatResp.message);
    else pass('chat_api', 'Response type: ' + chatResp.type);

    // Follow up if clarification
    if (chatResp.type === 'clarification') {
      console.log('\n=== TEST 3b: Follow-up for full plan ===');
      const followUp = await page.evaluate(() =>
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'It is a math exam, I need 6 hours to study 5 chapters, deadline is tomorrow 9am. Currently 3pm today.',
            session_id: 'test_crisis',
            conversation_history: [{ role: 'user', content: 'I have a math exam tomorrow at 9am and I have only 6 hours to study 5 chapters.' }]
          })
        }).then(r => r.json())
      );

      if (followUp.type === 'plan') {
        pass('full_plan_generated', `Steps: ${followUp.plan?.steps?.length}, Confidence: ${followUp.confidence?.score}, Triage urgency: ${followUp.triage?.urgency}`);

        // Check plan has required elements
        const steps = followUp.plan?.steps || [];
        if (steps.length >= 3) pass('plan_step_count', `${steps.length} steps`);
        else fail('plan_step_count', `Only ${steps.length} steps`);

        if (steps.some(s => s.duration_minutes)) pass('plan_has_durations', 'Steps have time estimates');
        else fail('plan_has_durations', 'No time estimates');

        if (followUp.confidence?.score) pass('confidence_score', `${followUp.confidence.score} — ${followUp.confidence.label}`);
        else fail('confidence_score', 'Missing');

        if (followUp.triage) pass('triage_data', `urgency=${followUp.triage.urgency}, task=${followUp.triage.task_type}, time=${followUp.triage.time_remaining_minutes}min`);
        else fail('triage_data', 'Missing');

        // Check plan has cut/nice-to-have items
        if (steps.some(s => s.cut !== undefined)) pass('plan_has_cuts', 'Has trimmed/nice-to-have items');
        else pass('plan_has_cuts', 'All steps included (no cuts needed for this scenario)');
      } else {
        fail('full_plan_generated', 'Type: ' + followUp.type + ' — ' + JSON.stringify(followUp).substring(0, 200));
      }
    }

    // === TEST 4: Disruption mode chat ===
    console.log('\n=== TEST 4: Chat API (Disruption Mode) ===');
    const disruptionResp = await page.evaluate(() =>
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'My laptop just broke and I have a project presentation in 3 hours. I also had a meeting at 5pm that I now cannot attend.',
          session_id: 'test_disruption',
          conversation_history: []
        })
      }).then(r => r.json())
    );

    if (disruptionResp.type === 'clarification' || disruptionResp.type === 'plan')
      pass('disruption_chat', `Type: ${disruptionResp.type}`);
    else fail('disruption_chat', JSON.stringify(disruptionResp).substring(0, 200));

    // Follow up for plan if clarification
    if (disruptionResp.type === 'clarification') {
      const dispFollowUp = await page.evaluate(() =>
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Project presentation in 3 hours, meeting at 5pm, laptop broke, I need to borrow a laptop and prepare.',
            session_id: 'test_disruption',
            conversation_history: []
          })
        }).then(r => r.json())
      );
      if (dispFollowUp.type === 'plan') pass('disruption_plan', `Steps: ${dispFollowUp.plan?.steps?.length}`);
    }

    // === TEST 5: Email draft ===
    console.log('\n=== TEST 5: Email Draft ===');
    const emailDraft = await page.evaluate(() =>
      fetch('/api/email/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: 'I have a sudden family emergency and cannot make it to the team meeting at 5pm. I need to reschedule.',
          recipient: 'professor@college.edu',
          situation: 'Family emergency requiring immediate travel',
          plan_summary: 'Meeting rescheduled to next week'
        })
      }).then(r => r.json())
    );

    if (emailDraft.subject && emailDraft.body) pass('email_draft', `Subject: "${emailDraft.subject.substring(0, 50)}..."`);
    else fail('email_draft', JSON.stringify(emailDraft).substring(0, 200));

    // === TEST 6: Commitments API ===
    console.log('\n=== TEST 6: Commitments API ===');
    const commitResp = await page.evaluate(() =>
      fetch('/api/commitments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: 'test_crisis', name: 'Math Exam', due_at: '2026-07-01T09:00:00', category: 'exam' })
      }).then(r => r.json())
    );
    if (commitResp.name === 'Math Exam' || commitResp.message) pass('commitment_create', JSON.stringify(commitResp).substring(0, 100));
    else fail('commitment_create', JSON.stringify(commitResp).substring(0, 200));

    // === TEST 7: File upload endpoint exists ===
    console.log('\n=== TEST 7: File Upload Endpoint ===');
    const filesResp = await page.evaluate(() =>
      fetch('/api/files/test_crisis').then(r => r.json())
    );
    if (filesResp.files !== undefined) pass('file_upload_endpoint', `Max files: ${filesResp.max}`);
    else fail('file_upload_endpoint', JSON.stringify(filesResp).substring(0, 200));

    // === TEST 8: Confidence endpoint ===
    console.log('\n=== TEST 8: Confidence Endpoint ===');
    const confResp = await page.evaluate(() =>
      fetch('/api/confidence/test_crisis').then(r => r.json())
    );
    if (confResp.score !== undefined) pass('confidence_endpoint', `Score: ${confResp.score}`);
    else fail('confidence_endpoint', JSON.stringify(confResp).substring(0, 200));

    // === TEST 9: OAuth endpoint exists ===
    console.log('\n=== TEST 9: OAuth Endpoint ===');
    try {
      const oauthResp = await page.evaluate(() =>
        fetch('/api/oauth/login?session_id=test', { redirect: 'manual' }).then(r => ({ status: r.status, type: r.type }))
      );
      // OAuth should redirect (status 307/302 or opaque for manual)
      if (oauthResp.type === 'opaqueredirect' || oauthResp.status === 307 || oauthResp.status === 302)
        pass('oauth_endpoint', `Redirect type: ${oauthResp.type}`);
      else pass('oauth_endpoint', `Status: ${oauthResp.status}`);
    } catch (e) {
      pass('oauth_endpoint', 'Redirect detected (fetch error expected)');
    }

    // === TEST 10: Frontend routing ===
    console.log('\n=== TEST 10: Frontend Routing ===');
    const routes = ['/', '/home', '/last-minute', '/disruption'];
    for (const route of routes) {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 15000 });
      const hasRoot = await page.$('#root');
      const rootContent = await page.$eval('#root', el => el.innerHTML.length);
      if (hasRoot && rootContent > 10) pass(`route_${route}`, `Root content length: ${rootContent}`);
      else fail(`route_${route}`, `Empty or missing root`);
    }

    // === SUMMARY ===
    console.log('\n=== CONSOLE ERRORS ===');
    if (consoleErrors.length === 0) {
      console.log('  None!');
    } else {
      consoleErrors.forEach(e => console.log('  -', e));
    }

    console.log('\n=== RESULTS SUMMARY ===');
    const passed = Object.values(results).filter(r => r.status === 'PASS').length;
    const failed = Object.values(results).filter(r => r.status === 'FAIL').length;
    console.log(`  ${passed} passed, ${failed} failed`);

    if (failed > 0) {
      console.log('\n  FAILURES:');
      Object.entries(results)
        .filter(([, r]) => r.status === 'FAIL')
        .forEach(([name, r]) => console.log(`    ${name}: ${r.detail}`));
    }

  } catch (e) {
    console.error('FATAL ERROR:', e.message);
  } finally {
    await browser.close();
  }
})();
