from fastapi import APIRouter, UploadFile, File, HTTPException
import uuid
import os
from pydantic import BaseModel
from app.utils.config import DATA_DIR
from app.services.pdf_service import extract_text_from_pdf
from app.services.chunking import chunk_text
from app.services.embedding_service import embed_texts
from app.services.faiss_service import add_embeddings
from app.services.url_service import fetch_content_from_url

router = APIRouter()

class UrlRequest(BaseModel):
    url: str

def process_paper_text(text: str, paper_id: str):
    if not text:
        return {"error": "No text found to process."}
    
    print(f"DEBUG: Processing text for {paper_id}. Len: {len(text)}. Chunking...")
    chunks = chunk_text(text)
    print(f"DEBUG: Chunking complete. {len(chunks)} chunks found. Embedding...")

    embeddings = embed_texts(chunks)
    print(f"DEBUG: Embedding complete. Adding to FAISS...")

    add_embeddings(embeddings, chunks, paper_id)
    print("DEBUG: Success. Paper ID:", paper_id)
    return {"paper_id": paper_id}

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    print(f"DEBUG: Starting upload for {file.filename}")
    paper_id = str(uuid.uuid4())
    path = os.path.join(DATA_DIR, f"{paper_id}.pdf")

    with open(path, "wb") as f:
        f.write(await file.read())
    print(f"DEBUG: File saved at {path}")

    print("DEBUG: Extracting text...")
    text = extract_text_from_pdf(path)
    
    return process_paper_text(text, paper_id)

@router.post("/upload-url")
async def upload_url(request: UrlRequest):
    url = request.url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    print(f"DEBUG: Processing URL: {url}")
    try:
        result = fetch_content_from_url(url)
        if result["type"] == "pdf":
            text = extract_text_from_pdf(result["path"])
            return process_paper_text(text, result["paper_id"])
        else:
            return {
                **process_paper_text(result["text"], result["paper_id"]),
                "title": result.get("title")
            }
    except Exception as e:
        print(f"DEBUG: Error processing URL: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))