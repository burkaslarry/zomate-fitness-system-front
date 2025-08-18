from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import schemas, models
from app.database import get_db
from app.rabbitmq import rabbitmq_service

router = APIRouter()

RAG_QUERY_QUEUE = "rag_query_queue"

@router.post("/rag/query", status_code=202)
def query_rag(rag_query: schemas.RAGQuery, db: Session = Depends(get_db)):
    try:
        rabbitmq_service.publish_message(
            RAG_QUERY_QUEUE, {"query": rag_query.query}
        )
        return {"message": "RAG query has been submitted for processing"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
