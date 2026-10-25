-- Initial schema for a dedicated Supabase project. Apply once as project owner.
BEGIN;


CREATE TABLE workspaces (
	id VARCHAR(36) NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	handle VARCHAR(100) NOT NULL, 
	segment VARCHAR(120) NOT NULL, 
	themes JSON NOT NULL, 
	brand JSON NOT NULL, 
	PRIMARY KEY (id)
)

;


CREATE TABLE agent_runs (
	agent VARCHAR(30) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	mode VARCHAR(30) NOT NULL, 
	finished_at TIMESTAMP WITH TIME ZONE, 
	result_count INTEGER NOT NULL, 
	error TEXT, 
	details JSON NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	workspace_id VARCHAR(36) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(workspace_id) REFERENCES workspaces (id)
)

;

CREATE UNIQUE INDEX uq_running_agent ON agent_runs (workspace_id, agent) WHERE status = 'running';

CREATE INDEX ix_agent_runs_workspace_id ON agent_runs (workspace_id);


CREATE TABLE agent_settings (
	agent VARCHAR(30) NOT NULL, 
	enabled BOOLEAN NOT NULL, 
	interval_hours INTEGER NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	workspace_id VARCHAR(36) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_agent_setting UNIQUE (workspace_id, agent), 
	FOREIGN KEY(workspace_id) REFERENCES workspaces (id)
)

;

CREATE INDEX ix_agent_settings_workspace_id ON agent_settings (workspace_id);


CREATE TABLE audit_events (
	actor VARCHAR(100) NOT NULL, 
	action VARCHAR(80) NOT NULL, 
	target_id VARCHAR(100) NOT NULL, 
	details JSON NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	workspace_id VARCHAR(36) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(workspace_id) REFERENCES workspaces (id)
)

;

CREATE INDEX ix_audit_events_workspace_id ON audit_events (workspace_id);


CREATE TABLE contents (
	format VARCHAR(30) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	body JSON NOT NULL, 
	evidence_ids JSON NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	version INTEGER NOT NULL, 
	commercial BOOLEAN NOT NULL, 
	approved_by VARCHAR(100), 
	approved_at TIMESTAMP WITH TIME ZONE, 
	scheduled_at TIMESTAMP WITH TIME ZONE, 
	media_url VARCHAR(1800), 
	id VARCHAR(36) NOT NULL, 
	workspace_id VARCHAR(36) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(workspace_id) REFERENCES workspaces (id)
)

;

CREATE INDEX ix_contents_workspace_id ON contents (workspace_id);


CREATE TABLE customers (
	name VARCHAR(120) NOT NULL, 
	contact VARCHAR(250) NOT NULL, 
	notes TEXT NOT NULL, 
	consent BOOLEAN NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	workspace_id VARCHAR(36) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(workspace_id) REFERENCES workspaces (id)
)

;

CREATE INDEX ix_customers_workspace_id ON customers (workspace_id);


CREATE TABLE evidence (
	title VARCHAR(400) NOT NULL, 
	url VARCHAR(1800) NOT NULL, 
	excerpt TEXT NOT NULL, 
	topic VARCHAR(120) NOT NULL, 
	publisher VARCHAR(200) NOT NULL, 
	source_type VARCHAR(30) NOT NULL, 
	category VARCHAR(30) NOT NULL, 
	published_at TIMESTAMP WITH TIME ZONE, 
	score INTEGER NOT NULL, 
	reasons JSON NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	workspace_id VARCHAR(36) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_evidence_workspace_url UNIQUE (workspace_id, url), 
	FOREIGN KEY(workspace_id) REFERENCES workspaces (id)
)

;

CREATE INDEX ix_evidence_workspace_id ON evidence (workspace_id);


CREATE TABLE memberships (
	workspace_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	role VARCHAR(20) NOT NULL, 
	PRIMARY KEY (workspace_id, user_id), 
	FOREIGN KEY(workspace_id) REFERENCES workspaces (id)
)

;


CREATE TABLE metric_snapshots (
	provider VARCHAR(40) NOT NULL, 
	account_id VARCHAR(100) NOT NULL, 
	metrics JSON NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	workspace_id VARCHAR(36) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(workspace_id) REFERENCES workspaces (id)
)

;

CREATE INDEX ix_metric_snapshots_workspace_id ON metric_snapshots (workspace_id);


CREATE TABLE orders (
	customer_id VARCHAR(36) NOT NULL, 
	description VARCHAR(500) NOT NULL, 
	amount_cents INTEGER NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	approved_by VARCHAR(100) NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	workspace_id VARCHAR(36) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(customer_id) REFERENCES customers (id), 
	FOREIGN KEY(workspace_id) REFERENCES workspaces (id)
)

;

CREATE INDEX ix_orders_workspace_id ON orders (workspace_id);


CREATE TABLE recommendations (
	run_id VARCHAR(36) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	rationale TEXT NOT NULL, 
	action TEXT NOT NULL, 
	category VARCHAR(40) NOT NULL, 
	priority INTEGER NOT NULL, 
	evidence_ids JSON NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	id VARCHAR(36) NOT NULL, 
	workspace_id VARCHAR(36) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(run_id) REFERENCES agent_runs (id), 
	FOREIGN KEY(workspace_id) REFERENCES workspaces (id)
)

;

CREATE INDEX ix_recommendations_workspace_id ON recommendations (workspace_id);


-- The API verifies Supabase Auth and membership before using its private DB connection.
-- Browser clients receive read-only access scoped by RLS; writes go through the API.
CREATE FUNCTION public.is_workspace_member(target_workspace varchar)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m
    WHERE m.workspace_id = target_workspace AND m.user_id = auth.uid()::text)
$$;
REVOKE ALL ON FUNCTION public.is_workspace_member(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(varchar) TO authenticated;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspaces FROM anon, authenticated;
GRANT SELECT ON public.workspaces TO authenticated;

CREATE POLICY tenant_read ON public.workspaces FOR SELECT TO authenticated USING (public.is_workspace_member(id));

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_runs FROM anon, authenticated;
GRANT SELECT ON public.agent_runs TO authenticated;

CREATE POLICY tenant_read ON public.agent_runs FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_settings FROM anon, authenticated;
GRANT SELECT ON public.agent_settings TO authenticated;

CREATE POLICY tenant_read ON public.agent_settings FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_events FROM anon, authenticated;
GRANT SELECT ON public.audit_events TO authenticated;

CREATE POLICY tenant_read ON public.audit_events FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contents FROM anon, authenticated;
GRANT SELECT ON public.contents TO authenticated;

CREATE POLICY tenant_read ON public.contents FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customers FROM anon, authenticated;
GRANT SELECT ON public.customers TO authenticated;

CREATE POLICY tenant_read ON public.customers FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evidence FROM anon, authenticated;
GRANT SELECT ON public.evidence TO authenticated;

CREATE POLICY tenant_read ON public.evidence FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.memberships FROM anon, authenticated;
GRANT SELECT ON public.memberships TO authenticated;

CREATE POLICY tenant_read ON public.memberships FOR SELECT TO authenticated USING (user_id = auth.uid()::text);

ALTER TABLE public.metric_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.metric_snapshots FROM anon, authenticated;
GRANT SELECT ON public.metric_snapshots TO authenticated;

CREATE POLICY tenant_read ON public.metric_snapshots FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orders FROM anon, authenticated;
GRANT SELECT ON public.orders TO authenticated;

CREATE POLICY tenant_read ON public.orders FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recommendations FROM anon, authenticated;
GRANT SELECT ON public.recommendations TO authenticated;

CREATE POLICY tenant_read ON public.recommendations FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

COMMIT;
