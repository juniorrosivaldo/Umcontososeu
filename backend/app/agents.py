from datetime import timedelta

import httpx
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from . import ai, research
from .config import get_settings
from .models import AgentRun, AgentSetting, Content, Evidence, Recommendation, Workspace, now
from .schemas import CreativeInput, CreativeOutput, StrategyOutput


class AgentError(Exception):
    pass


def local_creative(workspace, request):
    # Deterministic editorial draft, explicitly labelled. No claims of AI inference.
    story = (
        "Lia encontrou uma estrela de papel debaixo da cama. Quando soprou a poeira, ela fez cócegas em seu nariz. "
        "— Preciso de um céu! — sussurrou a estrela. Lia pegou uma folha azul e desenhou nuvens bem fofinhas. "
        "Depois, acomodou a nova amiga perto da janela. Naquela noite, enquanto a lua espiava o quarto, Lia adormeceu contente: "
        "até uma pequena estrela podia encontrar um lugar para descansar."
    )
    family_brand = workspace.handle == "@umcontososeu"
    if family_brand:
        title = "Um céu para a estrela"
        text = (
            story
            if request.format == "story"
            else f"Ideia editorial para revisar: {request.brief}\nConvide a família a imaginar uma pequena aventura juntos, sem prometer resultados."
        )
        caption = "Uma pequena aventura para ler juntinhos. Qual nome vocês dariam à estrela? Salve para a próxima leitura em família.\nA aventura começa com o seu nome."
        tags = ["#LeituraEmFamilia", "#ContosInfantis", "#UmContoSoSeu"]
    else:
        title = request.brief[:100]
        text = f"Rascunho editorial sobre {request.brief}. Apresente uma dúvida frequente do público, explique uma prática verificável e convide a uma conversa voluntária."
        caption = f"Vamos conversar sobre {request.brief}? Compartilhe suas dúvidas. Texto sujeito à revisão da empresa."
        tags = []
    body = {
        "text": text,
        "caption": caption,
        "scenes": [],
        "slides": [],
        "hashtags": tags,
        "cover_prompt": "Ilustração editorial em aquarela: estrela de papel, quarto acolhedor, azul noturno e dourado suave; personagem fictícia; formato 4:5."
        if family_brand
        else "",
        "notes": f"Modelo editorial local, sem OpenAI. Brief recebido: {request.brief}. Revise a adequação; nenhum produto, preço, mídia ou publicação foi confirmado.",
    }
    if request.format == "reel":
        body["scenes"] = [
            "0–3 s: um livro se abre; texto: uma aventura em família.",
            "3–12 s: apresente o tema do brief com objetos e ilustrações.",
            "12–20 s: conclua com uma pergunta e convite para salvar.",
        ]
    if request.format == "carousel":
        body["slides"] = [
            request.brief,
            "Comece com uma pergunta que desperte curiosidade.",
            "Apresente uma ideia concreta e verificável.",
            "Convide o público a experimentar e compartilhar sua impressão.",
        ]
    if request.format == "stories":
        body["scenes"] = [
            "Pergunta aberta sobre o tema.",
            "Bastidor ilustrado, sem expor pessoas.",
            "Enquete editorial; validar opções antes de publicar.",
        ]
    if request.format == "campaign":
        title = "Conceito de campanha · " + request.brief[:90]
        body["text"] = (
            f"Conceito para revisão: {request.brief}. Defina produto, capacidade de entrega, condições e preço com o responsável antes de produzir uma oferta."
        )
        body["caption"] = "Rascunho interno. Aguardando validação comercial; não é uma oferta pública."
    return CreativeOutput(title=title, body=body)


def run_agent(db, workspace_id, agent, creative_input: CreativeInput | None = None):
    if agent not in ("radar", "strategist", "creative"):
        raise AgentError("Agente desconhecido.")
    setting = db.scalar(
        select(AgentSetting).where(AgentSetting.workspace_id == workspace_id, AgentSetting.agent == agent)
    )
    if setting and not setting.enabled:
        raise AgentError("Este agente está pausado.")
    workspace = db.get(Workspace, workspace_id)
    if not workspace:
        raise AgentError("Empresa não encontrada.")
    # Expired executions are explicitly failed; the partial unique index prevents concurrent duplicates.
    db.execute(
        update(AgentRun)
        .where(
            AgentRun.workspace_id == workspace_id,
            AgentRun.agent == agent,
            AgentRun.status == "running",
            AgentRun.created_at < now() - timedelta(minutes=15),
        )
        .values(
            status="failed", finished_at=now(), error="Execução interrompida; prazo de 15 minutos excedido."
        )
    )
    run = AgentRun(workspace_id=workspace_id, agent=agent)
    db.add(run)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AgentError("Este agente já possui uma execução em andamento.") from None
    settings = get_settings()
    use_ai = settings.ai_enabled and bool(settings.openai_api_key)
    try:
        if agent == "radar":
            run.mode = "public_rss"
            rows, errors = research.collect(workspace)
            count = 0
            for data in rows:
                _, added = research.store_evidence(db, workspace, data)
                count += int(added)
            run.result_count = count
            run.details = {
                "fetched": len(rows),
                "duplicates": len(rows) - count,
                "source_errors": errors,
                "scope": "Feeds públicos; sem leitura de seguidores ou coleta de perfis privados.",
            }
            run.status = "partial" if errors and rows else "failed" if errors else "completed"
            if errors:
                run.error = f"{len(errors)} fonte(s) indisponível(is). Veja os detalhes desta execução."
        elif agent == "strategist":
            evidence = list(
                db.scalars(
                    select(Evidence)
                    .where(Evidence.workspace_id == workspace_id)
                    .order_by(Evidence.created_at.desc())
                    .limit(40)
                )
            )
            if not evidence:
                raise AgentError("Cadastre evidências ou execute o Radar antes de gerar recomendações.")
            run.mode = "openai" if use_ai else "heuristic"
            if use_ai:
                result = ai.generate(
                    "Você é estrategista de crescimento orgânico. Gere até cinco hipóteses de ação justificadas pelas evidências fornecidas. Use somente IDs existentes. Não infira demanda ou sucesso a partir de menções. Inclua experimento e métrica verificável. Não sugira follow/unfollow, mensagens não solicitadas ou promessas de resultados.",
                    {
                        "brand": workspace.brand,
                        "segment": workspace.segment,
                        "evidence": [
                            {
                                "id": e.id,
                                "title": e.title,
                                "excerpt": e.excerpt,
                                "topic": e.topic,
                                "score": e.score,
                            }
                            for e in evidence
                        ],
                    },
                    StrategyOutput,
                )
                allowed = {e.id for e in evidence}
                if any(not set(item.evidence_ids) <= allowed for item in result.recommendations):
                    raise AgentError("A resposta da IA citou evidências inexistentes; resultado rejeitado.")
                items = [r.model_dump() for r in result.recommendations]
            else:
                picked = sorted(evidence, key=lambda e: e.score, reverse=True)[:5]
                items = [
                    {
                        "title": f"Testar conteúdo sobre {e.topic}",
                        "rationale": f"A fonte “{e.title}” foi registrada em {e.topic}. "
                        + " ".join(e.reasons)
                        + " Hipótese editorial, sem comprovação de tendência.",
                        "action": "Prepare um carrossel com uma pergunta ao público e a referência consultada. Após aprovação, compare salvamentos por alcance com conteúdos anteriores; só conclua após obter métricas.",
                        "category": "content",
                        "priority": e.score,
                        "evidence_ids": [e.id],
                    }
                    for e in picked
                ]
            for item in items:
                db.add(Recommendation(workspace_id=workspace_id, run_id=run.id, **item))
            run.result_count = len(items)
            run.details = {"evidence_count": len(evidence), "requires_human_validation": True}
            run.status = "completed"
        else:
            if creative_input is None:
                raise AgentError("O Criativo exige um brief e uma ação supervisionada.")
            evidence = list(
                db.scalars(
                    select(Evidence).where(
                        Evidence.workspace_id == workspace_id, Evidence.id.in_(creative_input.evidence_ids)
                    )
                )
            )
            if len(evidence) != len(set(creative_input.evidence_ids)):
                raise AgentError("O brief contém evidências inexistentes ou de outra empresa.")
            run.mode = "openai" if use_ai else "editorial_template"
            if use_ai:
                result = ai.generate(
                    "Você é editor da marca. Produza um rascunho original no formato pedido. Contos: 50 a 85 palavras, ficção acolhedora, crianças de 4 a 8 anos quando aplicável. Sem dados de crianças reais, sem imitar autores, sem promessas terapêuticas, sem ofertas ou preços não confirmados. Reels precisam de roteiro; carrosséis de slides. Nunca declare que uma mídia ou publicação existe. Assinatura e linguagem devem respeitar a marca.",
                    {
                        "brand": workspace.brand,
                        "name": workspace.name,
                        "brief": creative_input.model_dump(),
                        "evidence": [{"title": e.title, "excerpt": e.excerpt} for e in evidence],
                    },
                    CreativeOutput,
                )
            else:
                result = local_creative(workspace, creative_input)
            if creative_input.format == "story" and not 50 <= len(result.body.text.split()) <= 85:
                raise AgentError("O conto não passou na revisão automática de extensão (50–85 palavras).")
            content = Content(
                workspace_id=workspace_id,
                format=creative_input.format,
                title=result.title,
                body=result.body.model_dump(),
                evidence_ids=creative_input.evidence_ids,
                commercial=creative_input.format == "campaign",
            )
            db.add(content)
            db.flush()
            run.result_count = 1
            run.details = {"content_id": content.id, "review": "pending", "media": "not_created"}
            run.status = "completed"
        run.finished_at = now()
        db.commit()
    except Exception as exc:
        db.rollback()
        run = db.get(AgentRun, run.id)
        run.status = "failed"
        run.finished_at = now()
        if isinstance(exc, AgentError):
            run.error = str(exc)
        elif isinstance(exc, httpx.HTTPStatusError):
            run.error = f"Integração retornou HTTP {exc.response.status_code}. Verifique configuração, permissões e limites."
        else:
            run.error = f"Falha de execução ({type(exc).__name__}). Nenhum resultado parcial foi aprovado."
        db.commit()
    return run
