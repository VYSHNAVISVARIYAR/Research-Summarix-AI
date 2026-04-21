from fastapi import APIRouter
from app.models.request_models import InsightRequest
from app.services.embedding_service import embed_texts
from app.services.faiss_service import search, get_metadata
from app.services.llm_service import call_llm

router = APIRouter()

@router.post("/insights")
def generate_insights(req: InsightRequest):

    # Step 1: Query for deep understanding
    query = "important insights, key findings, patterns, conclusions"
    query_emb = embed_texts([query])[0]

    # Step 2: Search FAISS
    indices = search(query_emb, top_k=5)

    # Step 3: Collect chunks
    chunks = []
    for idx in indices:
        meta = get_metadata(idx)
        if meta and meta["paper_id"] == req.paper_id:
            chunks.append(meta["text"])

    if not chunks:
        return {"error": "No data found"}

    content = "\n".join(chunks)

    # Step 4: LLM Prompt (VERY IMPORTANT)
    system_prompt = "You are an expert research analyst."

    user_prompt = f"""
    Analyze the research paper and extract:

    1. 5-7 key insights
    2. Important concepts
    3. Hidden patterns or implications
    4. Future research directions

    Present clearly in bullet points.

    Content:
    {content}
    """

    # Step 5: Call LLM
    response = call_llm(system_prompt, user_prompt)

    return {"insights": response}