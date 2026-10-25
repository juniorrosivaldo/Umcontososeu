import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
if (!executablePath) throw new Error('PLAYWRIGHT_CHROMIUM_EXECUTABLE é obrigatório.');

await mkdir('artifacts/real-preview', { recursive: true });
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(error.message));

await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: /Olá, vamos crescer juntos/ }).waitFor();
await page.screenshot({ path: 'artifacts/real-preview/01-command.png', fullPage: true });

await page.getByRole('button', { name: /Radar de mercado/ }).click();
await page.getByRole('heading', { name: 'Seu radar de oportunidades' }).waitFor();
await page.screenshot({ path: 'artifacts/real-preview/02-radar.png', fullPage: true });

await page.getByRole('button', { name: 'Relatórios de crescimento', exact: true }).click();
await page.getByRole('heading', { name: 'O que os sinais nos contam' }).waitFor();
await page.screenshot({ path: 'artifacts/real-preview/03-report.png', fullPage: true });

await page.getByRole('button', { name: 'Calendário editorial', exact: true }).click();
await page.getByRole('heading', { name: 'Calendário editorial' }).waitFor();
await page.screenshot({ path: 'artifacts/real-preview/04-calendar.png', fullPage: true });

await browser.close();
if (browserErrors.length) throw new Error(`Erros no navegador: ${browserErrors.join('; ')}`);
console.log('Capturas criadas sem erros de página.');
