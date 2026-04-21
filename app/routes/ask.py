from fastapi import APIRouter
from app.models.request_models import AskRequest
from app.services.embedding_service import embed_texts
from app.services.faiss_service import search, get_metadata
from app.services.llm_service import call_llm
from app.services.session_service import add_chat_message, get_chat_history

router = APIRouter()

@router.post("/ask")
def ask_question(req: AskRequest):

    # Context Retrieval
    q_emb = embed_texts([req.question])[0]
    indices = search(q_emb, top_k=5)

    chunks = []
    citations = []
    for idx in indices:
        meta = get_metadata(idx)
        if meta and meta["paper_id"] == req.paper_id:
            text = meta["text"]
            chunks.append(text)
            citations.append(f"Section/Chunk ID {idx}: {text[:100]}...")

    if not chunks:
        return {"answer": "No relevant data found in this paper.", "citations": []}

    content = "\n\n".join(chunks)

    # Get Chat History for continuity (Optional but good)
    history = get_chat_history(req.paper_id)
    history_str = ""
    if history:
        history_str = "Recent Conversation History:\n"
        for h in history[-3:]: # only last 3 to keep prompt short
            history_str += f"{h['role']}: {h['content']}\n"

    system_prompt = "You are an intelligent research assistant designed to answer questions strictly based on the provided document content."

    user_prompt = f"""
    Answer the following question based ONLY on the given research paper content.

    Question:
    {req.question}

    {history_str}

    Document Context:
    {content}

    Instructions:
    - Answer clearly with bullet points where necessary.
    - Be concise and accurate.
    - If the answer is not present in the document context, clearly say "Information not available in the document context."
    - DO NOT hallucinate.
    """

    response = call_llm(system_prompt, user_prompt)

    # Save to history
    add_chat_message(req.paper_id, "user", req.question)
    add_chat_message(req.paper_id, "assistant", response)

    return {"answer": response, "citations": citations}

@router.get("/history/{paper_id}")
def get_history(paper_id: str):
    return {"history": get_chat_history(paper_id)}