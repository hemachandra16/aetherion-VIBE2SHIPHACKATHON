const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  console.log('Navigating to https://aetherion-308059826502.asia-south1.run.app ...');
  await page.goto('https://aetherion-308059826502.asia-south1.run.app', { waitUntil: 'networkidle', timeout: 30000 });

  const title = await page.title();
  console.log('Page title:', title);

  const bodyText = await page.textContent('body');
  console.log('Body text length:', bodyText.length);
  console.log('Body text preview:', bodyText.substring(0, 300));

  const hasRoot = await page.$('#root');
  console.log('Has #root:', !!hasRoot);

  const rootChildren = await page.$$eval('#root > *', els => els.length);
  console.log('#root children:', rootChildren);

  if (errors.length > 0) {
    console.log('\nConsole errors:');
    errors.forEach(e => console.log('  -', e));
  } else {
    console.log('\nNo console errors!');
  }

  await browser.close();
})();
