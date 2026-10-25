'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  ExternalLink,
  Eye,
  FileText,
  Fingerprint,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  WandSparkles,
  X,
} from 'lucide-react';
import type {
  Agent,
  Content,
  Customer,
  Evidence,
  Integrations,
  Metrics,
  Order,
  Overview,
  Recommendation,
  Run,
} from '@/lib/types';

type Section =
  | 'command'
  | 'radar'
  | 'audience'
  | 'studio'
  | 'calendar'
  | 'reports'
  | 'crm'
  | 'agents';
const navigation = [
  { id: 'command', label: 'Central de comando', icon: LayoutDashboard },
  { id: 'radar', label: 'Radar de mercado', icon: Radio },
  { id: 'audience', label: 'Inteligência de audiência', icon: Users },
  { id: 'studio', label: 'Estúdio criativo', icon: WandSparkles },
  { id: 'calendar', label: 'Calendário editorial', icon: CalendarDays },
  { id: 'reports', label: 'Relatórios de crescimento', icon: TrendingUp },
  { id: 'crm', label: 'CRM comercial', icon: Fingerprint },
  { id: 'agents', label: 'Configuração dos agentes', icon: Settings2 },
] as const;
const names: Record<string, string> = {
  radar: 'Radar',
  strategist: 'Estrategista',
  creative: 'Criativo',
};
const modes: Record<string, string> = {
  public_rss: 'Fontes públicas',
  heuristic: 'Regras explicáveis',
  editorial_template: 'Modelo editorial local',
  openai: 'OpenAI',
};
const status: Record<string, string> = {
  completed: 'Concluído',
  failed: 'Falhou',
  partial: 'Parcial',
  running: 'Em execução',
  draft: 'Rascunho',
  approved: 'Texto aprovado',
  planned: 'Planejado',
};
const formats: Record<string, string> = {
  story: 'Conto infantil',
  reel: 'Roteiro de Reel',
  carousel: 'Carrossel',
  caption: 'Legenda',
  stories: 'Stories',
  campaign: 'Campanha',
};
const categories: Record<string, string> = {
  article: 'Artigo',
  competitor: 'Concorrente',
  creator: 'Criador',
  community: 'Comunidade',
  professional: 'Profissional',
};
const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Fortaleza',
      }).format(new Date(value))
    : 'Ainda não executado';
const money = (value: number) =>
  (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const authMode = process.env.NEXT_PUBLIC_AUTH_MODE || 'local';
let supabase: SupabaseClient | null = null;
if (
  authMode === 'supabase' &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) {
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

function Empty({
  icon: Icon = Compass,
  title,
  children,
}: {
  icon?: typeof Compass;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={25} strokeWidth={1.5} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Badge({ value }: { value: string }) {
  return <span className={`badge ${value}`}>{status[value] || value}</span>;
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [close]);
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={close} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function Dashboard() {
  const [section, setSection] = useState<Section>('command');
  const [sidebar, setSidebar] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [contents, setContents] = useState<Content[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ history: [], delta: {}, unavailable: [] });
  const [integrations, setIntegrations] = useState<Integrations | null>(null);
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<'evidence' | 'customer' | 'order' | null>(null);
  const [editing, setEditing] = useState<Content | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [topic, setTopic] = useState('');
  const [token, setToken] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [authReady, setAuthReady] = useState(authMode === 'local');
  const [showHistory, setShowHistory] = useState(false);
  const sessionEpoch = useRef(0);

  useEffect(() => {
    sessionEpoch.current += 1;
    setOverview(null);
    setEvidence([]);
    setRuns([]);
    setRecommendations([]);
    setAgents([]);
    setContents([]);
    setCustomers([]);
    setOrders([]);
    setMetrics({ history: [], delta: {}, unavailable: [] });
    setIntegrations(null);
    setEditing(null);
    setModal(null);
    setBusy('');
    setNotice('');
    setLoading(true);
  }, [token, workspace]);

  useEffect(() => {
    if (!supabase) return;
    setWorkspace(localStorage.getItem('umconto-workspace') || '');
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || '');
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setToken(session?.access_token || ''),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  const api = useCallback(
    async <T,>(path: string, method = 'GET', payload?: unknown): Promise<T> => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (workspace) headers['X-Workspace-Id'] = workspace;
      const response = await fetch(`/api/backend/${path}`, {
        method,
        headers,
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : `Dados inválidos ou operação recusada (${response.status}).`,
        );
      }
      return response.status === 204 ? (undefined as T) : response.json();
    },
    [token, workspace],
  );

  const refresh = useCallback(async () => {
    const epoch = sessionEpoch.current;
    try {
      const [o, e, r, rec, a, c, cust, ord, m, i] = await Promise.all([
        api<Overview>('overview'),
        api<Evidence[]>('evidence'),
        api<Run[]>('runs'),
        api<Recommendation[]>('recommendations'),
        api<Agent[]>('agents'),
        api<Content[]>('contents'),
        api<Customer[]>('customers'),
        api<Order[]>('orders'),
        api<Metrics>('metrics'),
        api<Integrations>('integrations'),
      ]);
      if (epoch !== sessionEpoch.current) return;
      setOverview(o);
      setEvidence(e);
      setRuns(r);
      setRecommendations(rec);
      setAgents(a);
      setContents(c);
      setCustomers(cust);
      setOrders(ord);
      setMetrics(m);
      setIntegrations(i);
    } catch (e) {
      if (epoch === sessionEpoch.current) setError((e as Error).message);
    } finally {
      if (epoch === sessionEpoch.current) setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    if (authReady && (authMode === 'local' || (token && workspace))) void refresh();
  }, [refresh, authReady, token, workspace]);

  async function action(key: string, task: () => Promise<unknown>, success = 'Alteração salva.') {
    if (busy) return;
    const epoch = sessionEpoch.current;
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await task();
      if (epoch !== sessionEpoch.current) return;
      await refresh();
      if (epoch === sessionEpoch.current) setNotice(success);
    } catch (e) {
      if (epoch === sessionEpoch.current) setError((e as Error).message);
    } finally {
      if (epoch === sessionEpoch.current) setBusy('');
    }
  }
  const navigate = (value: Section) => {
    setSection(value);
    setSidebar(false);
    setSearch('');
    setCategory('');
  };
  const runAgent = (name: string) =>
    action(
      name,
      async () => {
        const run = await api<Run>(`agents/${name}/run`, 'POST');
        if (run.status === 'failed') {
          await refresh();
          throw new Error(run.error || 'Falha no agente.');
        }
        if (run.status === 'partial') setError(run.error || 'Execução parcial.');
      },
      'Execução registrada no histórico.',
    );
  const filtered = evidence.filter(
    (e) =>
      (!search || `${e.title} ${e.excerpt}`.toLowerCase().includes(search.toLowerCase())) &&
      (!topic || e.topic === topic) &&
      (!category || e.category === category),
  );
  const actionable = recommendations.slice(0, 4);
  const editingDirty = editing
    ? JSON.stringify(contents.find((c) => c.id === editing.id)?.body) !==
        JSON.stringify(editing.body) ||
      contents.find((c) => c.id === editing.id)?.title !== editing.title
    : false;
  const errors = runs.filter((r) => r.status === 'failed' || r.status === 'partial').length;

  async function downloadReport() {
    await action(
      'download',
      async () => {
        const response = await fetch('/api/backend/opportunities.csv', {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(workspace ? { 'X-Workspace-Id': workspace } : {}),
          },
        });
        if (!response.ok) throw new Error('Não foi possível exportar o relatório.');
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = url;
        link.download = 'oportunidades.csv';
        link.click();
        URL.revokeObjectURL(url);
      },
      'Relatório exportado.',
    );
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    if (!supabase) {
      setError('Configure as variáveis públicas do Supabase para autenticar.');
      return;
    }
    const selected = String(form.get('workspace'));
    localStorage.setItem('umconto-workspace', selected);
    setWorkspace(selected);
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    if (loginError)
      setError('Não foi possível entrar. Confira o acesso da plataforma e a empresa.');
  }

  if (authMode !== 'local' && (!authReady || !token || !workspace))
    return (
      <main className="login">
        <div className="login-card">
          <div className="brand-symbol">
            <Sparkles />
          </div>
          <h1>Seu próximo capítulo.</h1>
          <p>Entre na plataforma Um Conto. Este acesso não usa a senha do Instagram.</p>
          <form onSubmit={login} className="form">
            <label>
              E-mail da plataforma
              <input name="email" type="email" required />
            </label>
            <label>
              Senha da plataforma
              <input name="password" type="password" required />
            </label>
            <label>
              ID da empresa
              <input name="workspace" defaultValue={workspace} required />
            </label>
            <button className="btn primary">
              Entrar <ArrowRight size={16} />
            </button>
          </form>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </div>
      </main>
    );

  const agentCard = (agent: Agent) => {
    const Icon =
      agent.name === 'radar' ? Radio : agent.name === 'creative' ? WandSparkles : Sparkles;
    return (
      <article className={`agent-card ${agent.name}`} key={agent.name}>
        <div className="agent-top">
          <span className="agent-icon">
            <Icon size={21} />
          </span>
          <span className={`status-dot ${agent.enabled ? 'on' : ''}`} />{' '}
          <span>{agent.enabled ? 'Disponível' : 'Pausado'}</span>
          <span className="level">Nível {agent.level}</span>
        </div>
        <h3>{names[agent.name]}</h3>
        <p>
          {agent.name === 'radar'
            ? 'Encontra sinais e oportunidades em fontes públicas.'
            : agent.name === 'strategist'
              ? 'Transforma evidências em próximos passos.'
              : 'Dá forma às ideias com a voz da sua marca.'}
        </p>
        <div className="agent-mode">{modes[agent.mode]}</div>
        <div className="agent-last">
          <Clock3 size={12} />
          {agent.last_run ? date(agent.last_run.created_at) : 'Aguardando primeira execução'}
        </div>
        <button
          className="text-button"
          disabled={!!busy || !agent.enabled}
          onClick={() =>
            agent.name === 'creative' ? navigate('studio') : void runAgent(agent.name)
          }
        >
          {busy === agent.name ? <Loader2 className="spin" size={14} /> : <Play size={13} />}
          {agent.name === 'creative' ? 'Abrir estúdio' : 'Executar agora'}
          <ArrowUpRight size={14} />
        </button>
      </article>
    );
  };

  const recommendationList = (items: Recommendation[]) =>
    items.length ? (
      <div className="recommendation-list">
        {items.map((r, index) => (
          <article className="recommendation" key={r.id}>
            <span className="recommendation-index">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <div className="rec-title">
                <h3>{r.title}</h3>
                <span className="pill">Afinidade {r.priority}</span>
              </div>
              <p>{r.rationale}</p>
              <details>
                <summary>
                  Por que agir e como testar <ChevronDown size={13} />
                </summary>
                <p>{r.action}</p>
                <div className="source-links">
                  {r.evidence_ids.map((id) => {
                    const source = evidence.find((e) => e.id === id);
                    return source ? (
                      <a key={id} href={source.url} target="_blank" rel="noopener noreferrer">
                        {source.title}
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span key={id}>Referência {id} · consulte o histórico completo</span>
                    );
                  })}
                </div>
              </details>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <Empty title="Boas decisões começam com evidências">
        Adicione uma fonte ao Radar e execute o Estrategista para descobrir caminhos para a marca.
      </Empty>
    );

  return (
    <div className="app-shell">
      {sidebar && (
        <button
          className="sidebar-overlay"
          aria-label="Fechar menu"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('command');
          }}
        >
          <span className="brand-symbol">
            <Sparkles size={22} />
          </span>
          <span>
            um conto<span className="brand-sub">INTELIGÊNCIA & CRESCIMENTO</span>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">U</span>
          <div>
            <strong>{overview?.workspace.name || 'Um Conto Só Seu'}</strong>
            <small>{overview?.workspace.handle || '@umcontososeu'}</small>
          </div>
          <span className="workspace-dot" />
        </div>
        <span className="nav-label">SEU UNIVERSO</span>
        <nav>
          {navigation.slice(0, 7).map((n) => (
            <button
              key={n.id}
              className={section === n.id ? 'active' : ''}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={18} strokeWidth={1.7} />
              {n.label}
              {n.id === 'radar' && !!overview?.counts.evidence && (
                <span className="nav-count">{overview.counts.evidence}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="nav-label">ORQUESTRAÇÃO</span>
          <nav>
            <button
              className={section === 'agents' ? 'active' : ''}
              onClick={() => navigate('agents')}
            >
              <Settings2 size={18} />
              Configuração dos agentes
            </button>
          </nav>
          <div className="sidebar-note">
            <span>
              <ShieldCheck size={16} /> Você no comando
            </span>
            <p>
              Inteligência para criar.
              <br />
              Aprovação para publicar.
            </p>
            <button onClick={() => navigate('agents')}>
              Conhecer os níveis <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="profile">
            <span className="profile-avatar">UC</span>
            <div>
              <strong>Espaço da marca</strong>
              <small>
                {overview?.mode === 'production' ? 'Acesso autenticado' : 'Ambiente local'}
              </small>
            </div>
            {authMode === 'supabase' ? (
              <button
                className="icon-btn"
                aria-label="Sair"
                onClick={() => void supabase?.auth.signOut()}
              >
                <LogOut size={16} />
              </button>
            ) : (
              <CircleHelp size={17} />
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setSidebar(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{navigation.find((n) => n.id === section)?.label}</strong>
          </div>
          <div className="top-actions">
            <span className="local-indicator">
              <span />
              {overview?.mode === 'production' ? 'Workspace privado' : 'Modo local'}
            </span>
            <button
              className="icon-btn notification"
              aria-label={`Ver ${errors} erros de integração`}
              onClick={() => {
                navigate('radar');
                setShowHistory(true);
              }}
            >
              <Bell size={19} />
              {!!errors && <i />}
            </button>
            <span className="top-avatar">U</span>
          </div>
        </header>
        <main className="main-content">
          {error && (
            <div className="alert error" role="alert">
              <Activity size={18} />
              <span>{error}</span>
              <button aria-label="Dispensar erro" onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              <Check size={18} />
              <span>{notice}</span>
              <button aria-label="Dispensar aviso" onClick={() => setNotice('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {loading && (
            <div className="loading">
              <Loader2 size={18} className="spin" /> Conectando ao seu espaço…
            </div>
          )}
          {!loading && !overview && (
            <div className="panel">
              <Empty title="Vamos conectar seu espaço">
                Inicie o backend Python para carregar o banco de dados e os agentes.
              </Empty>
              <button className="btn secondary" onClick={() => void refresh()}>
                Tentar novamente
              </button>
            </div>
          )}
          {section === 'command' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span /> UM NOVO CAPÍTULO PARA A SUA MARCA
                  </div>
                  <h1>
                    Olá, vamos crescer juntos<span className="gold">?</span>
                  </h1>
                  <p>Um olhar para o mercado. Um mundo de possibilidades.</p>
                </div>
                <button
                  className="btn secondary"
                  onClick={() => void downloadReport()}
                  disabled={!!busy}
                >
                  <ArrowDownToLine size={16} />
                  Exportar relatório
                </button>
              </div>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-label">
                    <Sparkles size={13} /> INTELIGÊNCIA COM PROPÓSITO
                  </span>
                  <h2>
                    Pequenas histórias.
                    <br />
                    <em>Grandes possibilidades.</em>
                  </h2>
                  <p>
                    Conecte os sinais do mercado à essência da sua marca.
                    <br />
                    Seus agentes ajudam a escrever o próximo capítulo.
                  </p>
                  <button
                    className="btn gold-button"
                    disabled={!!busy}
                    onClick={() => void runAgent('radar')}
                  >
                    {busy === 'radar' ? (
                      <Loader2 className="spin" size={16} />
                    ) : (
                      <Radio size={17} />
                    )}
                    Pesquisar mercado
                    <ArrowRight size={16} />
                  </button>
                  <span className="hero-footnote">
                    Fontes públicas · Evidências reais · Seu olhar na decisão
                  </span>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <svg viewBox="0 0 360 250">
                    <defs>
                      <linearGradient id="book" x1="0" x2="1" y1="0" y2="1">
                        <stop stopColor="#eccb7f" />
                        <stop offset="1" stopColor="#b68d49" />
                      </linearGradient>
                    </defs>
                    <circle cx="200" cy="120" r="100" fill="none" stroke="#ffffff10" />
                    <circle cx="200" cy="120" r="76" fill="none" stroke="#ffffff10" />
                    <path d="M224 37a39 39 0 1 0 36 59 34 34 0 0 1-36-59" fill="#ecd191" />
                    <g fill="#efdca3">
                      <path d="m117 51 3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
                      <path d="m286 122 2 7 7 2-7 2-2 7-2-7-7-2 7-2z" />
                      <circle cx="157" cy="28" r="2" />
                      <circle cx="299" cy="52" r="2" />
                      <circle cx="114" cy="137" r="2" />
                      <circle cx="252" cy="175" r="2" />
                    </g>
                    <path
                      d="M111 178q43-22 78-2 39-24 80-7l-2 51q-40-13-78 5-39-14-79 2z"
                      fill="#b38647"
                    />
                    <path
                      d="M104 167q44-19 85 2 38-28 84-16l-6 60q-42-12-78 5-43-15-85-2z"
                      fill="#f9e9be"
                    />
                    <path d="M110 157q40-18 79 12l-1 42q-39-26-78-11z" fill="url(#book)" />
                    <path d="M189 169q32-34 77-27v58q-43-2-78 11z" fill="#f5dfab" />
                    <path
                      d="M122 171q26-9 53 8m-53 1q26-9 53 8m30-12q22-16 47-16m-47 26q22-16 47-16"
                      fill="none"
                      stroke="#af884c"
                      strokeWidth="2"
                      opacity=".5"
                    />
                    <path
                      d="M163 143q-16-34 16-56m-9 40q21-7 22-21"
                      fill="none"
                      stroke="#c6b28b"
                      strokeDasharray="3 6"
                    />
                    <path d="m181 79 2 8 8 2-8 2-2 8-2-8-8-2 8-2z" fill="#fff0be" />
                  </svg>
                  <div className="art-caption">A aventura começa com o seu nome.</div>
                </div>
              </section>
              <div className="metrics-grid">
                {[
                  {
                    label: 'Evidências coletadas',
                    value: overview?.counts.evidence,
                    icon: Radio,
                    caption: 'Fontes com links registrados',
                    tone: 'lavender',
                  },
                  {
                    label: 'Oportunidades mapeadas',
                    value: overview?.counts.recommendations,
                    icon: Target,
                    caption: 'Recomendações para avaliar',
                    tone: 'mint',
                  },
                  {
                    label: 'Conteúdos no estúdio',
                    value: overview?.counts.contents,
                    icon: WandSparkles,
                    caption: 'Ideias esperando seu olhar',
                    tone: 'peach',
                  },
                  {
                    label: 'Seguidores no Instagram',
                    value: metrics.history[0]?.metrics.followers_count,
                    icon: Users,
                    caption: 'Requer conexão oficial',
                    tone: 'blue',
                  },
                ].map((card) => (
                  <article className="metric-card" key={card.label}>
                    <div>
                      <span>{card.label}</span>
                      <span className={`metric-icon ${card.tone}`}>
                        <card.icon size={18} />
                      </span>
                    </div>
                    <strong>{card.value ?? '—'}</strong>
                    <small>{card.caption}</small>
                  </article>
                ))}
              </div>
              <div className="two-columns">
                <section className="panel opportunities">
                  <div className="panel-head">
                    <div>
                      <span className="section-kicker">DO SINAL À AÇÃO</span>
                      <h2>Oportunidades em foco</h2>
                    </div>
                    <button className="text-button" onClick={() => navigate('reports')}>
                      Ver todas <ArrowRight size={14} />
                    </button>
                  </div>
                  {recommendationList(actionable)}
                </section>
                <section className="panel journey">
                  <div className="panel-head">
                    <div>
                      <span className="section-kicker">SUA ROTINA DE CRESCIMENTO</span>
                      <h2>O próximo passo</h2>
                    </div>
                    <BookOpen size={21} className="muted" />
                  </div>
                  <div className="journey-list">
                    {[
                      {
                        n: '01',
                        title: 'Descubra o que importa',
                        desc: 'Busque sinais ou adicione uma fonte.',
                        done: !!evidence.length,
                        section: 'radar',
                      },
                      {
                        n: '02',
                        title: 'Encontre uma direção',
                        desc: 'Transforme evidências em hipóteses.',
                        done: !!recommendations.length,
                        section: 'reports',
                      },
                      {
                        n: '03',
                        title: 'Dê vida à sua ideia',
                        desc: 'Crie, revise e aprove o conteúdo.',
                        done: !!contents.length,
                        section: 'studio',
                      },
                    ].map((step) => (
                      <button key={step.n} onClick={() => navigate(step.section as Section)}>
                        <span className={step.done ? 'step done' : 'step'}>
                          {step.done ? <Check size={15} /> : step.n}
                        </span>
                        <div>
                          <strong>{step.title}</strong>
                          <small>{step.desc}</small>
                        </div>
                        <ArrowUpRight size={15} />
                      </button>
                    ))}
                  </div>
                  <div className="journey-footer">
                    <ShieldCheck size={16} />
                    <span>Cada publicação passa por você.</span>
                  </div>
                </section>
              </div>
              <section className="agents-section">
                <div className="section-heading">
                  <div>
                    <h2>Seu pequeno time de grandes ideias</h2>
                    <p>Três agentes, uma direção: o crescimento da sua marca.</p>
                  </div>
                  <button className="text-button" onClick={() => navigate('agents')}>
                    Gerenciar agentes <Settings2 size={15} />
                  </button>
                </div>
                <div className="agent-grid">{agents.map(agentCard)}</div>
              </section>
              <div className="bottom-note">
                <span>
                  <span className="status-dot on" />
                  {overview?.database === 'postgresql'
                    ? 'PostgreSQL conectado'
                    : 'Persistência local · SQLite'}
                </span>
                <span>
                  Dados da sua marca. Decisões com contexto. <Sparkles size={13} />
                </span>
              </div>
            </>
          )}

          {(section === 'radar' || section === 'audience') && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">ESCUTE ANTES DE CRIAR</div>
                  <h1>
                    {section === 'radar'
                      ? 'Seu radar de oportunidades'
                      : 'Conexões que fazem sentido'}
                  </h1>
                  <p>
                    {section === 'radar'
                      ? 'Fontes públicas, contexto e evidências para cada descoberta.'
                      : 'Comunidades, criadores e profissionais classificados pela afinidade temática.'}
                  </p>
                </div>
                <button className="btn primary" onClick={() => setModal('evidence')}>
                  <Plus size={16} />
                  Adicionar fonte
                </button>
              </div>
              <div className="toolbar">
                <div className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Buscar evidências"
                    placeholder="Buscar nas evidências…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Filtrar tema"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                >
                  <option value="">Todos os temas</option>
                  {overview?.workspace.themes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <button
                  className="btn secondary"
                  disabled={!!busy}
                  onClick={() => void runAgent('radar')}
                >
                  <Radio size={16} />
                  {busy === 'radar' ? 'Pesquisando…' : 'Executar Radar'}
                </button>
                <button className="btn secondary" onClick={() => setShowHistory(!showHistory)}>
                  <Clock3 size={16} />
                  Histórico
                </button>
              </div>
              <div className="tabs">
                <button className={!category ? 'selected' : ''} onClick={() => setCategory('')}>
                  Todas as fontes
                </button>
                {Object.entries(categories).map(([id, name]) => (
                  <button
                    className={category === id ? 'selected' : ''}
                    key={id}
                    onClick={() => setCategory(id)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="info-strip">
                <ShieldCheck size={16} />
                {section === 'audience'
                  ? 'Sugestões para avaliação humana. Nenhuma lista privada, contato automático ou ação de seguir contas.'
                  : 'Afinidade é uma classificação por regras. Uma menção não comprova tendência, demanda ou resultado comercial.'}
              </div>
              <div className="evidence-grid">
                {filtered.map((e) => (
                  <article className="panel evidence-card" key={e.id}>
                    <div className="evidence-meta">
                      <span className="pill">{categories[e.category]}</span>
                      <span className="score">
                        {e.score}
                        <small>/100</small>
                      </span>
                    </div>
                    <span className="section-kicker">{e.topic}</span>
                    <h3>{e.title}</h3>
                    <p>{e.excerpt || 'A fonte não forneceu resumo.'}</p>
                    <details>
                      <summary>Como foi classificada</summary>
                      <ul>
                        {e.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </details>
                    <div className="evidence-footer">
                      <div>
                        <strong>{e.publisher || 'Fonte pública'}</strong>
                        <small>
                          {e.source_type === 'manual'
                            ? 'Registro manual · não verificado automaticamente'
                            : e.source_type === 'search_candidate'
                              ? 'Busca pública · candidato não verificado'
                              : 'Feed público · trecho da fonte'}
                          <br />
                          {date(e.created_at)}
                        </small>
                      </div>
                      <a
                        className="icon-btn"
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Abrir fonte: ${e.title}`}
                      >
                        <ExternalLink size={17} />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
              {!filtered.length && (
                <section className="panel">
                  <Empty icon={Radio} title="Seu radar está pronto para descobrir">
                    Execute uma pesquisa ou registre um link público com o trecho que sustenta a
                    oportunidade. Os resultados reais aparecerão aqui.
                  </Empty>
                </section>
              )}
              {showHistory && (
                <section className="panel history">
                  <div className="panel-head">
                    <h2>Histórico de pesquisas e agentes</h2>
                    <span className="pill">Últimas 100 execuções</span>
                  </div>
                  {runs.length ? (
                    runs.map((r) => (
                      <details key={r.id} className="run-row">
                        <summary>
                          <span className="run-icon">
                            <Activity size={17} />
                          </span>
                          <strong>{names[r.agent]}</strong>
                          <span>{date(r.created_at)}</span>
                          <span>{r.result_count} resultados</span>
                          <Badge value={r.status} />
                        </summary>
                        <div className="run-detail">
                          <p>
                            Modo: {modes[r.mode] || r.mode}. {r.error}
                          </p>
                          {r.details.source_errors?.map((s) => (
                            <p key={s.source}>
                              <a href={s.source} target="_blank" rel="noopener noreferrer">
                                {s.topic}
                              </a>{' '}
                              — {s.error}
                            </p>
                          ))}
                        </div>
                      </details>
                    ))
                  ) : (
                    <Empty title="Nenhuma execução ainda">
                      Cada execução registra início, resultado e possíveis falhas.
                    </Empty>
                  )}
                </section>
              )}
            </>
          )}

          {section === 'studio' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">IDEIAS QUE GANHAM VIDA</div>
                  <h1>Estúdio criativo</h1>
                  <p>A essência da sua marca, em novos formatos. Sempre com revisão humana.</p>
                </div>
                <span className="pill">
                  <WandSparkles size={13} />
                  {integrations?.openai.enabled && integrations.openai.configured
                    ? 'OpenAI habilitada'
                    : 'Modelo editorial local'}
                </span>
              </div>
              <div className="studio-grid">
                <section className="panel">
                  <div className="panel-head">
                    <h2>Vamos criar uma ideia?</h2>
                  </div>
                  <form
                    className="form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void action(
                        'creative',
                        async () => {
                          const run = await api<Run>('agents/creative/run', 'POST', {
                            format: f.get('format'),
                            brief: f.get('brief'),
                            evidence_ids: f.get('evidence') ? [f.get('evidence')] : [],
                          });
                          if (run.status === 'failed') {
                            await refresh();
                            throw new Error(run.error || 'Falha na criação.');
                          }
                        },
                        'Rascunho criado. Revise antes de aprovar.',
                      );
                    }}
                  >
                    <label>
                      Formato
                      <select name="format">
                        {Object.entries(formats).map(([id, name]) => (
                          <option value={id} key={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      O que vamos explorar?
                      <textarea
                        name="brief"
                        minLength={5}
                        maxLength={1500}
                        required
                        placeholder="Uma aventura acolhedora sobre a curiosidade, para ler em família…"
                        rows={5}
                      />
                    </label>
                    <label>
                      Evidência de referência (opcional)
                      <select name="evidence">
                        <option value="">Criação editorial livre</option>
                        {evidence.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="form-note">
                      <ShieldCheck size={16} />
                      <p>
                        {integrations?.openai.enabled && integrations.openai.configured
                          ? 'O brief e as evidências selecionadas serão enviados à OpenAI. Não inclua dados pessoais de crianças.'
                          : 'Sem chave de IA, o estúdio usa um modelo editorial limitado. A adaptação criativa completa exige OpenAI habilitada.'}
                      </p>
                    </div>
                    <button className="btn primary" disabled={!!busy}>
                      {busy === 'creative' ? (
                        <Loader2 className="spin" size={16} />
                      ) : (
                        <Sparkles size={16} />
                      )}
                      Criar rascunho
                    </button>
                  </form>
                </section>
                <section>
                  <div className="section-heading">
                    <h2>Sua biblioteca de ideias</h2>
                    <span className="pill">{contents.length} conteúdos</span>
                  </div>
                  {contents.length ? (
                    <div className="content-list">
                      {contents.map((c) => (
                        <article className="panel content-card" key={c.id}>
                          <div className="content-meta">
                            <span className="section-kicker">{formats[c.format]}</span>
                            <Badge value={c.status} />
                          </div>
                          <h3>{c.title}</h3>
                          <p>
                            {c.body.text.slice(0, 210)}
                            {c.body.text.length > 210 ? '…' : ''}
                          </p>
                          <div className="content-footer">
                            <small>
                              Versão {c.version} · {date(c.created_at)}
                            </small>
                            <button
                              className="text-button"
                              onClick={() => setEditing(structuredClone(c))}
                            >
                              <Eye size={15} />
                              Revisar
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="panel">
                      <Empty icon={BookOpen} title="Toda boa história começa com uma ideia">
                        Conte o que deseja criar. Seu rascunho será salvo aqui, pronto para receber
                        seu olhar.
                      </Empty>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}

          {section === 'calendar' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">UM RITMO PARA A SUA MARCA</div>
                  <h1>Calendário editorial</h1>
                  <p>
                    Planejamento interno em America/Fortaleza. Nenhum item é publicado
                    automaticamente.
                  </p>
                </div>
                <button className="btn primary" onClick={() => navigate('studio')}>
                  <Plus size={16} />
                  Criar conteúdo
                </button>
              </div>
              <div className="info-strip">
                <ShieldCheck size={16} />A aprovação valida o texto. Mídia, permissões Meta e
                publicação externa ainda exigem implementação e validação.
              </div>
              <section className="panel">
                {contents.filter((c) => c.status !== 'draft').length ? (
                  contents
                    .filter((c) => c.status !== 'draft')
                    .sort((a, b) => (a.scheduled_at || 'z').localeCompare(b.scheduled_at || 'z'))
                    .map((c) => (
                      <div className="calendar-row" key={c.id}>
                        <span className="calendar-icon">
                          <CalendarDays size={24} />
                        </span>
                        <div>
                          <h3>{c.title}</h3>
                          <p>
                            {formats[c.format]} ·{' '}
                            {c.scheduled_at
                              ? date(c.scheduled_at)
                              : 'Escolha uma data para o plano'}
                          </p>
                          <Badge value={c.status} />
                        </div>
                        {c.status === 'approved' && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const f = new FormData(e.currentTarget);
                              void action(
                                c.id,
                                () =>
                                  api(`contents/${c.id}/plan`, 'POST', {
                                    version: c.version,
                                    scheduled_at: `${f.get('date')}:00-03:00`,
                                  }),
                                'Data salva no calendário interno. Não houve agendamento na Meta.',
                              );
                            }}
                          >
                            <label>
                              Data e hora · Fortaleza
                              <input
                                aria-label={`Data de ${c.title}`}
                                name="date"
                                type="datetime-local"
                                required
                              />
                            </label>
                            <button className="btn secondary" disabled={!!busy}>
                              Planejar
                            </button>
                          </form>
                        )}
                        <button
                          className="icon-btn"
                          aria-label={`Revisar ${c.title}`}
                          onClick={() => setEditing(structuredClone(c))}
                        >
                          <Eye size={18} />
                        </button>
                      </div>
                    ))
                ) : (
                  <Empty icon={CalendarDays} title="Abra espaço para o próximo capítulo">
                    Revise e aprove um rascunho no estúdio para incluí-lo no planejamento.
                  </Empty>
                )}
              </section>
            </>
          )}

          {section === 'reports' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">CRESCIMENTO COM CONTEXTO</div>
                  <h1>O que os sinais nos contam</h1>
                  <p>Hipóteses rastreáveis e histórico real de resultados.</p>
                </div>
                <button
                  className="btn secondary"
                  disabled={!!busy}
                  onClick={() => void downloadReport()}
                >
                  <ArrowDownToLine size={16} />
                  Exportar oportunidades
                </button>
              </div>
              <div className="two-columns">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <span className="section-kicker">ESTRATEGISTA</span>
                      <h2>Recomendações de ação</h2>
                    </div>
                    <button
                      className="btn primary"
                      disabled={!!busy}
                      onClick={() => void runAgent('strategist')}
                    >
                      <Sparkles size={15} />
                      {busy === 'strategist' ? 'Analisando…' : 'Analisar evidências'}
                    </button>
                  </div>
                  {recommendationList(recommendations)}
                </section>
                <section className="panel">
                  <div className="panel-head">
                    <h2>Evolução do Instagram</h2>
                    <TrendingUp size={20} />
                  </div>
                  {metrics.history.length ? (
                    <div className="metric-history">
                      {metrics.history.map((m) => (
                        <div key={m.id}>
                          <strong>{date(m.created_at)}</strong>
                          <p>
                            Seguidores: {m.metrics.followers_count ?? 'Indisponível'} · Publicações:{' '}
                            {m.metrics.media_count ?? 'Indisponível'}
                          </p>
                        </div>
                      ))}
                      {Object.keys(metrics.delta).length > 0 && (
                        <p>
                          Diferença entre as duas últimas coletas:{' '}
                          {Object.entries(metrics.delta)
                            .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Empty icon={TrendingUp} title="Resultados merecem dados reais">
                      Conecte a conta profissional pela API oficial para iniciar o histórico.
                      Alcance, visualizações, interações e conversões ainda não estão integrados.
                    </Empty>
                  )}
                  <div className="panel-action">
                    <button
                      className="btn secondary"
                      disabled={!!busy}
                      onClick={() =>
                        void action(
                          'instagram',
                          () => api('instagram/sync', 'POST'),
                          'Métricas oficiais registradas.',
                        )
                      }
                    >
                      <Activity size={16} />
                      Sincronizar conta
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}

          {section === 'crm' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">CUIDADO EM CADA RELAÇÃO</div>
                  <h1>CRM comercial</h1>
                  <p>
                    Organize contatos voluntários e pedidos. Sem mensagens comerciais automáticas.
                  </p>
                </div>
                <div className="button-group">
                  <button className="btn secondary" onClick={() => setModal('order')}>
                    <Plus size={16} />
                    Registrar pedido
                  </button>
                  <button className="btn primary" onClick={() => setModal('customer')}>
                    <Plus size={16} />
                    Adicionar cliente
                  </button>
                </div>
              </div>
              <div className="two-columns">
                <section className="panel">
                  <div className="panel-head">
                    <h2>Clientes e solicitações</h2>
                    <span className="pill">{customers.length}</span>
                  </div>
                  {customers.length ? (
                    customers.map((c) => (
                      <article className="crm-row" key={c.id}>
                        <span className="profile-avatar">{c.name.slice(0, 2).toUpperCase()}</span>
                        <div>
                          <h3>{c.name}</h3>
                          <p>{c.contact || 'Sem contato registrado'}</p>
                          <small>{c.notes}</small>
                          <p className="tiny">
                            {c.consent
                              ? 'Contato voluntário informado'
                              : 'Consentimento não informado'}
                          </p>
                        </div>
                        <button
                          className="icon-btn"
                          aria-label={`Excluir ${c.name}`}
                          onClick={() => {
                            if (
                              confirm(
                                'Excluir este cliente e seus pedidos? Esta ação remove os dados pessoais armazenados.',
                              )
                            )
                              void action(
                                c.id,
                                () => api(`customers/${c.id}`, 'DELETE'),
                                'Cliente e pedidos excluídos.',
                              );
                          }}
                        >
                          <X size={16} />
                        </button>
                      </article>
                    ))
                  ) : (
                    <Empty icon={Users} title="Relações que começam com confiança">
                      Cadastre apenas informações necessárias, fornecidas pelo próprio cliente.
                      Evite dados pessoais de crianças.
                    </Empty>
                  )}
                </section>
                <section className="panel">
                  <div className="panel-head">
                    <h2>Pedidos registrados</h2>
                  </div>
                  {orders.length ? (
                    orders.map((o) => (
                      <div className="order-row" key={o.id}>
                        <div>
                          <h3>{o.description}</h3>
                          <p>{customers.find((c) => c.id === o.customer_id)?.name || 'Cliente'}</p>
                          <select
                            aria-label={`Estágio de ${o.description}`}
                            value={o.status}
                            disabled={!!busy}
                            onChange={(e) => {
                              const next = e.target.value;
                              if (
                                confirm(
                                  'Confirmar a atualização administrativa deste pedido? Nenhuma cobrança ou movimentação financeira será realizada.',
                                )
                              )
                                void action(
                                  o.id,
                                  () =>
                                    api(`orders/${o.id}`, 'PUT', { status: next, confirmed: true }),
                                  'Estágio atualizado. Nenhuma cobrança foi realizada.',
                                );
                            }}
                          >
                            {Object.entries({
                              requested: 'Solicitado',
                              in_progress: 'Em produção',
                              delivered: 'Entregue',
                              paid: 'Pagamento confirmado',
                              canceled: 'Cancelado',
                            }).map(([value, label]) => (
                              <option value={value} key={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <strong>{money(o.amount_cents)}</strong>
                      </div>
                    ))
                  ) : (
                    <Empty icon={FileText} title="Um lugar para cada pedido">
                      Os valores são registros administrativos confirmados pelo responsável. Nenhuma
                      cobrança é realizada.
                    </Empty>
                  )}
                </section>
              </div>
            </>
          )}

          {section === 'agents' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">INTELIGÊNCIA COM LIMITES CLAROS</div>
                  <h1>Seu time, suas regras</h1>
                  <p>Execuções independentes, histórico transparente e aprovação humana.</p>
                </div>
              </div>
              <div className="agent-grid">{agents.map(agentCard)}</div>
              <div className="two-columns settings-columns">
                <section className="panel">
                  <div className="panel-head">
                    <h2>Rotinas dos agentes</h2>
                  </div>
                  {agents.map((a) => (
                    <form
                      className="settings-row"
                      key={a.name}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void action(a.name, () =>
                          api(`agents/${a.name}`, 'PUT', {
                            enabled: f.get('enabled') === 'on',
                            interval_hours: Number(f.get('interval')),
                          }),
                        );
                      }}
                    >
                      <div>
                        <h3>{names[a.name]}</h3>
                        <small>Última: {date(a.last_run?.created_at)}</small>
                        <p className="tiny">
                          Próxima:{' '}
                          {a.next_run
                            ? date(a.next_run)
                            : a.name === 'creative'
                              ? 'Após um novo brief'
                              : 'Dependente do GitHub Actions'}
                        </p>
                        <p className="tiny">{a.schedule_note}</p>
                      </div>
                      <div className="setting-controls">
                        <label className="check-label">
                          <input type="checkbox" name="enabled" defaultChecked={a.enabled} />
                          Ativo
                        </label>
                        <label>
                          Intervalo (h)
                          <input
                            type="number"
                            name="interval"
                            defaultValue={a.interval_hours}
                            min={6}
                            max={168}
                          />
                        </label>
                        <button className="btn secondary small" disabled={!!busy}>
                          Salvar
                        </button>
                      </div>
                    </form>
                  ))}
                </section>
                <section className="panel">
                  <div className="panel-head">
                    <h2>Integrações e autonomia</h2>
                  </div>
                  <div className="integration-row">
                    <span className="integration-icon">
                      <Sparkles size={18} />
                    </span>
                    <div>
                      <h3>OpenAI</h3>
                      <p>
                        {integrations?.openai.configured && integrations.openai.enabled
                          ? `Configurada · ${integrations.openai.model}`
                          : 'Opcional · não habilitada'}
                      </p>
                    </div>
                    <span className="pill">Chave no servidor</span>
                  </div>
                  <div className="integration-row">
                    <span className="integration-icon">
                      <Users size={18} />
                    </span>
                    <div>
                      <h3>Instagram oficial</h3>
                      <p>
                        {integrations?.instagram.configured
                          ? 'Configurado · validar conexão em Relatórios'
                          : 'Aguardando token, conta e versão da API'}
                      </p>
                    </div>
                  </div>
                  <div className="integration-row">
                    <span className="integration-icon">
                      <ShieldCheck size={18} />
                    </span>
                    <div>
                      <h3>
                        {overview?.database === 'postgresql'
                          ? 'PostgreSQL / Supabase'
                          : 'SQLite local'}
                      </h3>
                      <p>
                        {overview?.mode === 'production'
                          ? 'Sessão e acesso por empresa'
                          : 'Sem credenciais externas'}
                      </p>
                    </div>
                  </div>
                  <div className="autonomy">
                    <h3>Três níveis de autonomia</h3>
                    <p>
                      <strong>01 · Automático</strong>Pesquisa, análise e relatórios.
                    </p>
                    <p>
                      <strong>02 · Supervisionado</strong>Criação e planejamento editorial.
                    </p>
                    <p>
                      <strong>03 · Aprovação obrigatória</strong>Conteúdo comercial, interações
                      externas e registros financeiros.
                    </p>
                    <small>
                      Publicação externa, cobrança e mensagens automáticas não estão habilitadas.
                    </small>
                  </div>
                </section>
              </div>
            </>
          )}
        </main>
        <footer className="footer">
          <span>
            um conto <span className="gold">✦</span> um universo de possibilidades
          </span>
          <span>Feito para crescer com intenção.</span>
        </footer>
      </div>

      {modal === 'evidence' && (
        <Modal title="Registrar uma evidência" close={() => setModal(null)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action(
                'evidence',
                async () => {
                  await api('evidence', 'POST', Object.fromEntries(f));
                  setModal(null);
                },
                'Fonte registrada e classificada.',
              );
            }}
          >
            <p className="form-intro">
              Registre um link público e o trecho que sustenta a observação. O conteúdo manual não é
              verificado automaticamente.
            </p>
            <label>
              Título
              <input name="title" required minLength={5} maxLength={400} />
            </label>
            <label>
              URL pública HTTPS
              <input name="url" type="url" required placeholder="https://…" />
            </label>
            <label>
              Evidência ou trecho observado
              <textarea name="excerpt" required minLength={20} maxLength={1500} rows={4} />
            </label>
            <div className="form-grid">
              <label>
                Tema
                <select name="topic">
                  {overview?.workspace.themes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Tipo de fonte
                <select name="category">
                  {Object.entries(categories).map(([id, name]) => (
                    <option value={id} key={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Veículo ou perfil profissional
              <input name="publisher" maxLength={200} />
            </label>
            <button className="btn primary" disabled={!!busy}>
              Salvar evidência <Check size={16} />
            </button>
          </form>
        </Modal>
      )}
      {modal === 'customer' && (
        <Modal title="Adicionar cliente" close={() => setModal(null)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action('customer', async () => {
                await api('customers', 'POST', {
                  name: f.get('name'),
                  contact: f.get('contact'),
                  notes: f.get('notes'),
                  consent: f.get('consent') === 'on',
                });
                setModal(null);
              });
            }}
          >
            <label>
              Nome do responsável
              <input name="name" minLength={2} maxLength={120} required />
            </label>
            <label>
              Contato fornecido pelo cliente
              <input name="contact" maxLength={250} />
            </label>
            <label>
              Solicitação ou observação
              <textarea name="notes" maxLength={2000} />
            </label>
            <label className="check-label">
              <input type="checkbox" name="consent" />
              Contato voluntário informado pelo cliente
            </label>
            <p className="tiny">
              Não cadastre dados pessoais de crianças. Nenhuma mensagem será enviada.
            </p>
            <button className="btn primary" disabled={!!busy}>
              Salvar cliente
            </button>
          </form>
        </Modal>
      )}
      {modal === 'order' && (
        <Modal title="Registrar pedido" close={() => setModal(null)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action(
                'order',
                async () => {
                  await api('orders', 'POST', {
                    customer_id: f.get('customer_id'),
                    description: f.get('description'),
                    amount_cents: Math.round(Number(f.get('amount')) * 100),
                    confirmed: f.get('confirmed') === 'on',
                  });
                  setModal(null);
                },
                'Pedido registrado. Nenhuma cobrança foi realizada.',
              );
            }}
          >
            <label>
              Cliente
              <select name="customer_id" required>
                <option value="">Selecione um cliente</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Descrição da solicitação
              <input name="description" minLength={3} maxLength={500} required />
            </label>
            <label>
              Valor acordado (R$)
              <input name="amount" type="number" min="0" max="1000000" step="0.01" required />
            </label>
            <label className="check-label">
              <input name="confirmed" type="checkbox" required />
              Confirmo o registro deste valor. Nenhuma cobrança será feita.
            </label>
            <button className="btn primary" disabled={!!busy}>
              Confirmar registro
            </button>
          </form>
        </Modal>
      )}
      {editing && (
        <Modal title="Revisar conteúdo" close={() => setEditing(null)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const current = editing;
              void action(
                'edit',
                async () => {
                  await api(`contents/${current.id}`, 'PUT', {
                    title: current.title,
                    body: current.body,
                    version: current.version,
                  });
                  setEditing(null);
                },
                'Alterações salvas. A versão precisa de nova aprovação.',
              );
            }}
          >
            <div className="content-meta">
              <span>
                {formats[editing.format]} · versão {editing.version}
              </span>
              <Badge value={editing.status} />
            </div>
            <label>
              Título
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                required
                minLength={3}
              />
            </label>
            <label>
              Texto
              <textarea
                rows={6}
                value={editing.body.text}
                onChange={(e) =>
                  setEditing({ ...editing, body: { ...editing.body, text: e.target.value } })
                }
              />
            </label>
            <label>
              Legenda
              <textarea
                rows={3}
                value={editing.body.caption}
                onChange={(e) =>
                  setEditing({ ...editing, body: { ...editing.body, caption: e.target.value } })
                }
              />
            </label>
            {editing.body.scenes.length > 0 && (
              <div className="preview-output">
                <h3>Cenas</h3>
                <ol>
                  {editing.body.scenes.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            )}
            {editing.body.slides.length > 0 && (
              <div className="preview-output">
                <h3>Slides</h3>
                <ol>
                  {editing.body.slides.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            )}
            <p className="tags">{editing.body.hashtags.join(' ')}</p>
            <details>
              <summary>Direção de arte e observações</summary>
              <p>{editing.body.cover_prompt}</p>
              <p>{editing.body.notes}</p>
            </details>
            <div className="form-note">
              <ShieldCheck size={18} />
              <p>
                Salvar uma edição remove a aprovação e o planejamento anteriores. Salve as
                alterações antes de aprovar. A aprovação se refere à versão salva.
              </p>
            </div>
            <div className="button-group">
              <button className="btn secondary" disabled={!!busy}>
                Salvar como rascunho
              </button>
              {editing.status === 'draft' && (
                <button
                  type="button"
                  className="btn primary"
                  disabled={!!busy || editingDirty}
                  onClick={() => {
                    const current = editing;
                    if (
                      confirm(
                        `Aprovar a versão ${current.version} já salva de “${current.title}”? Alterações não salvas neste formulário não serão incluídas. ${current.commercial ? 'Confirme também as condições comerciais.' : 'Revise texto e adequação à marca.'}`,
                      )
                    )
                      void action(
                        'approve',
                        async () => {
                          await api(`contents/${current.id}/approve`, 'POST', {
                            version: current.version,
                            confirmed: true,
                          });
                          setEditing(null);
                        },
                        'Texto aprovado. Você pode planejar uma data no calendário.',
                      );
                  }}
                >
                  <Check size={16} />
                  Aprovar versão salva
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
