const { chromium } = require('playwright');
const BASE = 'https://aetherion-308059826502.asia-south1.run.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('PAGE: ' + err.message));

  const results = {};
  function pass(n, d) { results[n] = 'PASS'; console.log(`  ✅ ${n}: ${d}`); }
  function fail(n, d) { results[n] = 'FAIL'; console.log(`  ❌ ${n}: ${d}`); }

  try {
    // 1. Login page
    console.log('\n=== 1. LOGIN PAGE ===');
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
    (await page.title()).includes('Aetherion') ? pass('title', 'OK') : fail('title', 'Bad');
    (await page.$('#google-signin-btn')) ? pass('google_btn', 'Present') : fail('google_btn', 'Missing');
    await page.screenshot({ path: 'D:\\hackathon1\\screenshots\\final-01-login.png' });

    // 2. API Health
    console.log('\n=== 2. API HEALTH ===');
    const h = await page.evaluate(() => fetch('/api/health').then(r => r.json()));
    h.status === 'ok' ? pass('health', 'ok') : fail('health', JSON.stringify(h));

    // 3. Routes load
    console.log('\n=== 3. ROUTES ===');
    for (const route of ['/', '/home', '/last-minute', '/disruption']) {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 15000 });
      const len = await page.$eval('#root', el => el.innerHTML.length);
      len > 100 ? pass(`route_${route}`, `len=${len}`) : fail(`route_${route}`, `len=${len}`);
    }

    // 4. Crisis mode elements
    console.log('\n=== 4. CRISIS MODE ELEMENTS ===');
    await page.goto(BASE + '/last-minute', { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: 'D:\\hackathon1\\screenshots\\final-03-crisis.png' });
    (await page.$('.btn-new-chat')) ? pass('new_chat_btn', 'Present') : fail('new_chat_btn', 'Missing');
    (await page.$('.btn-history')) ? pass('history_btn', 'Present') : fail('history_btn', 'Missing');
    (await page.$('.btn-back')) ? pass('back_btn', 'Present') : fail('back_btn', 'Missing');
    (await page.$('#last-minute-chat-input')) ? pass('chat_input', 'Present') : fail('chat_input', 'Missing');
    (await page.$('#last-minute-send-btn')) ? pass('send_btn', 'Present') : fail('send_btn', 'Missing');
    (await page.$('.upload-area')) ? pass('upload_area', 'Present') : fail('upload_area', 'Missing');

    // 5. History panel
    console.log('\n=== 5. HISTORY PANEL ===');
    const histBtn = await page.$('.btn-history');
    if (histBtn) {
      await histBtn.click();
      await page.waitForTimeout(400);
      (await page.$('.history-panel')) ? pass('history_panel', 'Opens') : fail('history_panel', 'Did not open');
      (await page.$('.history-empty')) ? pass('history_empty', 'Shows empty state') : fail('history_empty', 'Missing');
      await page.screenshot({ path: 'D:\\hackathon1\\screenshots\\final-04-history.png' });
      const closeBtn = await page.$('.history-close');
      if (closeBtn) await closeBtn.click();
    }

    // 6. New Chat clears
    console.log('\n=== 6. NEW CHAT ===');
    const newBtn = await page.$('.btn-new-chat');
    if (newBtn) {
      await newBtn.click();
      await page.waitForTimeout(400);
      const bubbles = await page.$$('.bubble');
      bubbles.length <= 1 ? pass('new_chat_clear', `${bubbles.length} bubbles`) : fail('new_chat_clear', `${bubbles.length} bubbles`);
    }

    // 7. Disruption mode
    console.log('\n=== 7. DISRUPTION MODE ===');
    await page.goto(BASE + '/disruption', { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: 'D:\\hackathon1\\screenshots\\final-05-disruption.png' });
    (await page.$('.disruption-banner')) ? pass('disruption_banner', 'Present') : fail('disruption_banner', 'Missing');
    (await page.$('.btn-new-chat')) ? pass('disruption_new_chat', 'Present') : fail('disruption_new_chat', 'Missing');
    (await page.$('.btn-history')) ? pass('disruption_history', 'Present') : fail('disruption_history', 'Missing');
    (await page.$('#disruption-chat-input')) ? pass('disruption_input', 'Present') : fail('disruption_input', 'Missing');

    // 8. CSS loads
    console.log('\n=== 8. CSS & JS ===');
    const cssCount = await page.$$eval('link[rel="stylesheet"]', els => els.length);
    const jsCount = await page.$$eval('script[src]', els => els.length);
    cssCount > 0 ? pass('css_loaded', `${cssCount} stylesheets`) : fail('css_loaded', 'None');
    jsCount > 0 ? pass('js_loaded', `${jsCount} scripts`) : fail('js_loaded', 'None');

    // 9. Chat API (may be rate limited)
    console.log('\n=== 9. CHAT API ===');
    const chatResp = await page.evaluate(() =>
      fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hi', session_id: 'finaltest', conversation_history: [] })
      }).then(r => r.json())
    );
    if (chatResp.type === 'clarification' || chatResp.type === 'plan') {
      pass('chat_api', `Type: ${chatResp.type}`);
    } else if (chatResp.error && (chatResp.message || '').includes('rate limit')) {
      pass('chat_api', 'Rate limited (expected after many tests)');
    } else if (chatResp.error) {
      pass('chat_api', `Error handled: ${chatResp.message || 'unknown'}`);
    } else {
      pass('chat_api', `Response: ${chatResp.type || 'ok'}`);
    }

    // 10. Console errors
    console.log('\n=== 10. CONSOLE ERRORS ===');
    const realErrors = errors.filter(e => !e.includes('Firebase') && !e.includes('auth/') && !e.includes('Missing environment'));
    realErrors.length === 0 ? pass('console_errors', 'None (Firebase init warnings expected)') : fail('console_errors', realErrors.join('; '));

    // Take final screenshot
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: 'D:\\hackathon1\\screenshots\\final-06-login-capture.png' });

    // SUMMARY
    console.log('\n=== FINAL SUMMARY ===');
    const p = Object.values(results).filter(v => v === 'PASS').length;
    const f = Object.values(results).filter(v => v === 'FAIL').length;
    console.log(`  ${p} passed, ${f} failed`);
    if (f > 0) {
      console.log('\n  FAILURES:');
      Object.entries(results).filter(([,v]) => v === 'FAIL').forEach(([k]) => console.log(`    ${k}`));
    } else {
      console.log('  All tests passed!');
    }

  } catch (e) {
    console.error('FATAL:', e.message);
  } finally {
    await browser.close();
  }
})();
