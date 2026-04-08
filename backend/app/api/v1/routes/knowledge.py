from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from ....db.database import get_db
from ....models.clone import Clone
from ....models.schemas import IngestRequest, IngestResponse
from ....core.security import verify_token
from ....core.dependencies import get_knowledge_provider
from ....services.interfaces.knowledge import KnowledgeProvider

router = APIRouter(prefix="/admin/clones", tags=["knowledge"])


@router.post("/{clone_id}/ingest", response_model=IngestResponse)
async def ingest_knowledge(
    clone_id: str,
    payload: IngestRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
    knowledge: KnowledgeProvider = Depends(get_knowledge_provider),
):
    """
    Add text knowledge to a clone's vector store.
    Accepts plain text — paste in writings, quotes, beliefs, life lessons, etc.
    Chunks automatically before embedding.
    """
    clone = db.query(Clone).filter(Clone.id == clone_id).first()
    if not clone:
        raise HTTPException(status_code=404, detail="Clone not found")

    # Count chars as a proxy for chunks before ingestion
    approx_chunks = max(1, len(payload.text) // 400)
    await knowledge.ingest(clone_id, payload.text, source=payload.source)

    return IngestResponse(
        clone_id=clone_id,
        source=payload.source,
        chunks_added=approx_chunks,
    )


@router.post("/{clone_id}/ingest/file", response_model=IngestResponse)
async def ingest_file(
    clone_id: str,
    file: UploadFile = File(...),
    source: str = Form(default=""),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
    knowledge: KnowledgeProvider = Depends(get_knowledge_provider),
):
    """
    Upload a .txt or .md file as knowledge for a clone.
    Max sensible size: a few MB of plain text.
    """
    clone = db.query(Clone).filter(Clone.id == clone_id).first()
    if not clone:
        raise HTTPException(status_code=404, detail="Clone not found")

    allowed = {".txt", ".md"}
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed:
        raise HTTPException(status_code=422, detail="Only .txt and .md files are supported.")

    raw = await file.read()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    if not text.strip():
        raise HTTPException(status_code=422, detail="File appears to be empty.")

    source_label = source or file.filename
    approx_chunks = max(1, len(text) // 400)
    await knowledge.ingest(clone_id, text, source=source_label)

    return IngestResponse(clone_id=clone_id, source=source_label, chunks_added=approx_chunks)


@router.delete("/{clone_id}/knowledge", status_code=204)
async def clear_knowledge(
    clone_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
    knowledge: KnowledgeProvider = Depends(get_knowledge_provider),
):
    """Remove all knowledge for a clone (e.g. before re-ingesting)."""
    await knowledge.delete_clone(clone_id)
