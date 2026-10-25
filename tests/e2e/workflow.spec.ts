import { test, expect } from '@playwright/test';

test('evidência → estratégia → rascunho → aprovação → calendário, com persistência', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (dialog) => void dialog.accept());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Olá, vamos crescer juntos/ })).toBeVisible();
  await expect(page.getByText('Aguardando primeira execução').first()).toBeVisible();
  await page.screenshot({ path: 'artifacts/dashboard-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Radar de mercado', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar fonte' }).click();
  await page
    .getByLabel('Título', { exact: true })
    .fill('Evidência sintética de leitura — teste automatizado');
  await page.getByLabel('URL pública HTTPS').fill('https://example.org/fixture-leitura');
  await page
    .getByLabel('Evidência ou trecho observado')
    .fill(
      'Fixture sintética: literatura infantil e livros personalizados. Não representa pesquisa real.',
    );
  await page.getByLabel('Veículo ou perfil profissional').fill('Fixture de teste');
  await page.getByRole('button', { name: 'Salvar evidência' }).click();
  await expect(
    page.getByRole('heading', { name: 'Evidência sintética de leitura — teste automatizado' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Relatórios de crescimento', exact: true }).click();
  await page.getByRole('button', { name: 'Analisar evidências' }).click();
  await expect(
    page.getByRole('heading', { name: 'Testar conteúdo sobre Literatura infantil' }),
  ).toBeVisible();
  await page.getByText('Por que agir e como testar').click();
  await expect(page.getByRole('link', { name: /Evidência sintética de leitura/ })).toHaveAttribute(
    'href',
    'https://example.org/fixture-leitura',
  );
  await page.getByRole('button', { name: 'Estúdio criativo', exact: true }).click();
  await page
    .getByLabel('O que vamos explorar?')
    .fill('Uma estrela de papel encontra um lugar acolhedor para descansar.');
  await page.getByRole('button', { name: 'Criar rascunho' }).click();
  await expect(page.getByRole('heading', { name: 'Um céu para a estrela' })).toBeVisible();
  await page.getByRole('button', { name: 'Revisar', exact: true }).click();
  await page.getByRole('button', { name: 'Aprovar versão salva' }).click();
  await expect(page.getByText('Texto aprovado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Calendário editorial', exact: true }).click();
  const future = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  await page.getByLabel('Data de Um céu para a estrela', { exact: true }).fill(future);
  await page.getByRole('button', { name: 'Planejar', exact: true }).click();
  await expect(page.getByText('Planejado', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Calendário editorial', exact: true }).click();
  await expect(page.getByText('Planejado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'CRM comercial', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar cliente' }).click();
  await page.getByLabel('Nome do responsável').fill('Responsável fictício de teste');
  await page.getByRole('button', { name: 'Salvar cliente' }).click();
  await expect(page.getByRole('heading', { name: 'Responsável fictício de teste' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('navegação em celular não causa rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Olá, vamos crescer juntos/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Radar', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'artifacts/dashboard-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('button', { name: 'Configuração dos agentes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Seu time, suas regras' })).toBeVisible();
});

test('proxy recusa mutações de outra origem', async ({ request }) => {
  const response = await request.post('/api/backend/agents/radar/run', {
    headers: { Origin: 'https://attacker.example' },
  });
  expect(response.status()).toBe(403);
});
