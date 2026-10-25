import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const local = (process.env.NEXT_PUBLIC_AUTH_MODE || 'local') === 'local';
  if (local !== ((process.env.APP_MODE || 'local') === 'local')) {
    return Response.json(
      {
        detail:
          'APP_MODE e NEXT_PUBLIC_AUTH_MODE devem corresponder. Confira a configuração e refaça o build.',
      },
      { status: 503 },
    );
  }
  const requestHost = request.headers.get('host') || '';
  let hostname: string;
  try {
    hostname = new URL(`http://${requestHost}`).hostname;
  } catch {
    return Response.json({ detail: 'Host inválido.' }, { status: 400 });
  }
  if (local && !['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    return Response.json(
      { detail: 'Modo local restrito a localhost. Configure Supabase para publicar.' },
      { status: 403 },
    );
  }
  const origin = request.headers.get('origin');
  const expectedOrigin = local ? `http://${requestHost}` : process.env.APP_ORIGIN;
  if (
    !local &&
    (!expectedOrigin?.startsWith('https://') ||
      !request.headers.get('authorization')?.startsWith('Bearer '))
  ) {
    return Response.json(
      { detail: 'Configure APP_ORIGIN HTTPS e entre na plataforma.' },
      { status: 401 },
    );
  }
  if (!['GET', 'HEAD'].includes(request.method) && origin && origin !== expectedOrigin) {
    return Response.json({ detail: 'Origem não autorizada.' }, { status: 403 });
  }
  const { path } = await context.params;
  if (path.some((p) => !/^[a-zA-Z0-9_.-]+$/.test(p) || p === '..' || p === '.')) {
    return Response.json({ detail: 'Caminho inválido.' }, { status: 400 });
  }
  const root = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
  const headers = new Headers({ 'Content-Type': 'application/json' });
  for (const key of ['authorization', 'x-workspace-id']) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
  if (body && body.length > 25000)
    return Response.json({ detail: 'Requisição muito grande.' }, { status: 413 });
  try {
    const upstream = await fetch(`${root}/${path.join('/')}${request.nextUrl.search}`, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(180000),
      redirect: 'error',
    });
    const responseHeaders = new Headers({
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store',
    });
    const disposition = upstream.headers.get('content-disposition');
    if (disposition) responseHeaders.set('Content-Disposition', disposition);
    return new Response(upstream.status === 204 ? null : await upstream.text(), {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { detail: 'API indisponível. Inicie o backend Python e verifique BACKEND_URL.' },
      { status: 503 },
    );
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
