from fastapi import APIRouter
from app.models.request_models import SummarizeRequest
from app.services.embedding_service import embed_texts
from app.services.faiss_service import search, get_metadata
from app.services.llm_service import call_llm

router = APIRouter()

@router.post("/summarize")
def summarize(req: SummarizeRequest):

    # For a general summary (especially Large), we want broader context.
    # Searching for general aspects ensures we grab major parts of the paper.
    query = "abstract main idea, contributions, methodology, results, limitations applications"
    query_emb = embed_texts([query])[0]

    # Grab a solid amount of chunks to give good context, since Large covers everything.
    indices = search(query_emb, top_k=10)

    chunks = []
    for idx in indices:
        meta = get_metadata(idx)
        if meta and meta["paper_id"] == req.paper_id:
            chunks.append(meta["text"])

    if not chunks:
        return {"error": "No data found for this paper"}

    content = "\n".join(chunks)

    # Step 4: Decide summary length and exact prompt
    if req.length == "short":
        instruction = """
        Produce a concise Executive Summary:
        - Exactly 5 to 7 high-impact bullet points.
        - Focus on the core problem, unique approach, and key statistical results.
        - Avoid filler words; ensure technical precision.
        """
    elif req.length == "medium":
        instruction = """
        Produce a comprehensive Technical Synopsis (1-2 substantial paragraphs):
        - Paragraph 1: Contextualize the research problem and describe the methodological innovation.
        - Paragraph 2: Detail the validated results, performance metrics, and the broader significance of the findings.
        - Maintain a professional, academic tone.
        """
    else: # large
        instruction = """
        Provide a Detailed Research Analysis organized with clear typography and professional formatting:
        
        ### 1. Research Objective & Abstract
        Summarize the overarching goal and scope.
        
        ### 2. Core Contributions
        List specific novel techniques or datasets introduced.
        
        ### 3. Methodology & Implementation
        Deep dive into the experimental setup, algorithms, or theoretical frameworks used.
        
        ### 4. Results & Quantitative Analysis
        Detail the findings, including specific numbers, accuracy rates, or comparative benchmarks.
        
        ### 5. Limitations & Constraints
        Identify the boundary conditions and potential biases.
        
        ### 6. Practical Applications & Future Scope
        How can this work be used in the real world and what comes next?
        """

    system_prompt = "You are a professional research assistant."

    user_prompt = f"""
    You are analyzing a high-impact research paper. Using the extracted content below, strictly follow these instructions:
    
    {instruction}

    ---
    EXTRACTED TEXT CONTENT:
    {content}
    """

    response = call_llm(system_prompt, user_prompt)

    return {"summary": response}