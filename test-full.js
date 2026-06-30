const { chromium } = require('playwright');

const URL = 'https://aetherion-308059826502.asia-south1.run.app';
const results = [];

function log(test, pass, detail = '') {
  const icon = pass ? '✅' : '❌';
  results.push({ test, pass, detail });
  console.log(`${icon} ${test}${detail ? ' — ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));

  // ─── TEST 1: Login page loads ───
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    const title = await page.title();
    log('1. Login page loads', title.includes('Aetherion'), `Title: "${title}"`);
  } catch (e) {
    log('1. Login page loads', false, e.message);
  }

  // ─── TEST 2: AETHERION logo visible ───
  try {
    const logoText = await page.textContent('body');
    const hasLogo = logoText.includes('AETHERION');
    log('2. AETHERION logo text present', hasLogo);
  } catch (e) {
    log('2. AETHERION logo text present', false, e.message);
  }

  // ─── TEST 3: Google Sign-In button ───
  try {
    const googleBtn = await page.$('text=Sign in with Google');
    const devBtn = await page.$('text=Continue in dev mode');
    log('3. Login buttons present', !!(googleBtn || devBtn), `Google: ${!!googleBtn}, Dev: ${!!devBtn}`);
  } catch (e) {
    log('3. Login buttons present', false, e.message);
  }

  // ─── TEST 4: Dev mode bypass ───
  try {
    const devBtn = await page.$('text=Continue in dev mode');
    if (devBtn) {
      await devBtn.click();
      await page.waitForURL('**/home', { timeout: 5000 });
      log('4. Dev mode → Home', page.url().includes('/home'), `URL: ${page.url()}`);
    } else {
      log('4. Dev mode → Home', false, 'No dev mode button');
    }
  } catch (e) {
    log('4. Dev mode → Home', false, e.message);
  }

  // ─── TEST 5: Home screen elements ───
  try {
    const body = await page.textContent('body');
    const hasHero = body.includes('trouble') || body.includes('I\'m in trouble');
    const hasDuties = body.includes('Scheduled Duties') || body.includes('duties');
    const hasDisruption = body.includes('disruption') || body.includes('Disruption');
    log('5. Home screen: panic hero', hasHero);
    log('5. Home screen: scheduled duties', hasDuties);
    log('5. Home screen: disruption CTA', hasDisruption);
  } catch (e) {
    log('5. Home screen elements', false, e.message);
  }

  // ─── TEST 6: Navbar ───
  try {
    const navText = await page.textContent('nav') || '';
    const hasLogoNav = navText.includes('AETHERION');
    const hasModel = navText.includes('3.5 Flash');
    const hasTabs = navText.includes('HOME') && navText.includes('CRISIS MODE');
    log('6. Navbar: AETHERION logo', hasLogoNav, `Nav text: "${navText.substring(0, 100)}"`);
    log('6. Navbar: Gemini 3.5 Flash', hasModel);
    log('6. Navbar: tab buttons', hasTabs);
  } catch (e) {
    log('6. Navbar', false, e.message);
  }

  // ─── TEST 7: Profile dropdown ───
  try {
    const avatar = await page.$('#nav-user-btn, .nav-user-btn, [aria-label="User menu"]');
    if (avatar) {
      await avatar.click();
      await page.waitForTimeout(500);
      const dropdown = await page.$('.user-dropdown, [class*="dropdown"]');
      const signOut = await page.$('text=Sign Out');
      log('7. Profile dropdown opens', !!(dropdown || signOut));
      if (dropdown) await dropdown.click(); // close
    } else {
      log('7. Profile dropdown opens', false, 'No avatar button found');
    }
  } catch (e) {
    log('7. Profile dropdown', false, e.message);
  }

  // ─── TEST 8: Navigate to Crisis Mode ───
  try {
    await page.click('text=CRISIS MODE');
    await page.waitForTimeout(1000);
    const url = page.url();
    log('8. Navigate to Crisis Mode', url.includes('/last-minute'), `URL: ${url}`);
  } catch (e) {
    log('8. Navigate to Crisis Mode', false, e.message);
  }

  // ─── TEST 9: Crisis Mode UI elements ───
  try {
    const body = await page.textContent('body');
    const hasGreeting = body.includes('Tell me what');
    const hasChatInput = await page.$('#last-minute-chat-input, textarea[placeholder*="situation"]');
    const hasHomeBtn = body.includes('Home');
    const hasHistory = body.includes('History');
    const hasNewChat = body.includes('New Chat');
    log('9. Crisis: agent greeting', hasGreeting);
    log('9. Crisis: chat input present', !!hasChatInput);
    log('9. Crisis: Home button', hasHomeBtn);
    log('9. Crisis: History button', hasHistory);
    log('9. Crisis: New Chat button', hasNewChat);
  } catch (e) {
    log('9. Crisis Mode UI', false, e.message);
  }

  // ─── TEST 10: Send a message ───
  let userMessageAppeared = false;
  let agentResponded = false;
  try {
    const chatInput = await page.$('#last-minute-chat-input, textarea[placeholder*="situation"]');
    if (chatInput) {
      await chatInput.fill('I have a biology exam in 2 hours and I haven\'t studied anything');
      await page.waitForTimeout(300);
      
      // Check character count
      const charCount = await page.textContent('.char-count');
      log('10a. Character count shows', charCount && charCount.includes('/2000'), `Char count: "${charCount}"`);
      
      // Press Enter to send
      await chatInput.press('Enter');
      await page.waitForTimeout(2000);
      
      // Check user bubble appeared
      const userBubbles = await page.$$('.bubble-user');
      userMessageAppeared = userBubbles.length > 0;
      log('10b. User message bubble appeared', userMessageAppeared, `Found ${userBubbles.length} user bubbles`);
      
      // Wait for response
      await page.waitForTimeout(15000);
      
      const agentBubbles = await page.$$('.bubble-agent');
      agentResponded = agentBubbles.length > 1; // More than just the greeting
      log('10c. Agent responded with plan/clarification', agentResponded, `Found ${agentBubbles.length} agent bubbles`);
      
      // Check for plan panel or error
      const planPanel = await page.$('.plan-panel, .confidence-meter');
      const errorBanner = await page.$('.error-banner');
      if (planPanel) {
        log('10d. Plan or confidence displayed', true);
      } else if (errorBanner) {
        const errorText = await errorBanner.textContent();
        log('10d. Error displayed (rate limit?)', false, errorText.substring(0, 100));
      } else {
        log('10d. Plan or confidence displayed', false, 'No plan panel or error banner');
      }
    } else {
      log('10. Send message', false, 'No chat input found');
    }
  } catch (e) {
    log('10. Send message', false, e.message);
  }

  // ─── TEST 11: Error dismiss button ───
  try {
    const dismissBtn = await page.$('.error-dismiss, [aria-label="Dismiss error"]');
    if (dismissBtn) {
      await dismissBtn.click();
      await page.waitForTimeout(500);
      const stillVisible = await page.$('.error-banner');
      log('11. Error dismiss button works', !stillVisible, 'Error banner removed');
    } else {
      log('11. Error dismiss button', true, 'No error to dismiss (good)');
    }
  } catch (e) {
    log('11. Error dismiss', false, e.message);
  }

  // ─── TEST 12: New Chat button ───
  try {
    const newChatBtn = await page.$('text=New Chat');
    if (newChatBtn) {
      await newChatBtn.click();
      await page.waitForTimeout(1000);
      const userBubbles = await page.$$('.bubble-user');
      log('12. New Chat clears messages', userBubbles.length === 0, `User bubbles after: ${userBubbles.length}`);
    } else {
      log('12. New Chat button', false, 'Button not found');
    }
  } catch (e) {
    log('12. New Chat', false, e.message);
  }

  // ─── TEST 13: History panel ───
  try {
    const histBtn = await page.$('text=History');
    if (histBtn) {
      await histBtn.click();
      await page.waitForTimeout(500);
      const panel = await page.$('.history-panel');
      log('13. History panel opens', !!panel);
      if (panel) {
        const closeBtn = await page.$('.history-close');
        if (closeBtn) await closeBtn.click();
      }
    } else {
      log('13. History panel', false, 'Button not found');
    }
  } catch (e) {
    log('13. History panel', false, e.message);
  }

  // ─── TEST 14: Navigate to Reshuffle ───
  try {
    await page.click('text=RESHUFFLE');
    await page.waitForTimeout(1000);
    const url = page.url();
    const body = await page.textContent('body');
    const hasChatInput = await page.$('textarea');
    log('14. Navigate to Reshuffle', url.includes('/disruption'), `URL: ${url}`);
    log('14. Reshuffle: chat input', !!hasChatInput);
  } catch (e) {
    log('14. Navigate to Reshuffle', false, e.message);
  }

  // ─── TEST 15: Send disruption message ───
  try {
    const chatInput = await page.$('textarea');
    if (chatInput) {
      await chatInput.fill('My flight got cancelled, I have an important meeting tomorrow morning');
      await page.waitForTimeout(300);
      await chatInput.press('Enter');
      await page.waitForTimeout(15000);
      
      const agentBubbles = await page.$$('.bubble-agent');
      const errorBanner = await page.$('.error-banner');
      if (agentBubbles.length > 1) {
        log('15. Disruption: agent responded', true, `${agentBubbles.length} agent bubbles`);
      } else if (errorBanner) {
        const errorText = await errorBanner.textContent();
        log('15. Disruption: agent responded', false, `Error: ${errorText.substring(0, 100)}`);
      } else {
        log('15. Disruption: agent responded', false, 'No response');
      }
    } else {
      log('15. Disruption message', false, 'No chat input');
    }
  } catch (e) {
    log('15. Disruption message', false, e.message);
  }

  // ─── TEST 16: Logo visual check ───
  try {
    const logo = await page.$('.nav-logo, .auth-logo');
    if (logo) {
      const box = await logo.boundingBox();
      const text = await logo.textContent();
      log('16. Logo: visible and has text', text.includes('AETHERION'), `Text: "${text}", Box: ${JSON.stringify(box)}`);
    } else {
      log('16. Logo visible', false, 'Logo element not found');
    }
  } catch (e) {
    log('16. Logo check', false, e.message);
  }

  // ─── TEST 17: Health API ───
  try {
    const resp = await page.evaluate(async () => {
      const r = await fetch('/api/health');
      return r.json();
    });
    log('17. Health API', resp.status === 'ok', `Response: ${JSON.stringify(resp)}`);
  } catch (e) {
    log('17. Health API', false, e.message);
  }

  // ─── SUMMARY ───
  console.log('\n' + '═'.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('═'.repeat(60));
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`PASSED: ${passed}/${results.length}`);
  console.log(`FAILED: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\nFAILED TESTS:');
    results.filter(r => !r.pass).forEach(r => {
      console.log(`  ❌ ${r.test} — ${r.detail}`);
    });
  }
  
  if (consoleErrors.length > 0) {
    console.log(`\nCONSOLE ERRORS (${consoleErrors.length}):`);
    consoleErrors.slice(0, 5).forEach(e => console.log(`  ${e.substring(0, 150)}`));
  }
  
  console.log('═'.repeat(60));
  await browser.close();
})();
