from fastapi import APIRouter
from fastapi.responses import PlainTextResponse
from app.models.request_models import KeywordRequest, SectionSummarizeRequest, ELI5Request, GapRequest, QuizRequest, FlashcardRequest, MindmapRequest, GlossaryRequest
from app.services.embedding_service import embed_texts
from app.services.faiss_service import search, get_metadata
from app.services.llm_service import call_llm
from app.services.session_service import get_all_papers_for_user

router = APIRouter()

def _get_paper_content_dumb_search(paper_id: str):
    # This is a bit brute-force for full paper context if FAISS search doesn't extract all, 
    # but since this is an MVP without document DB, we will query FAISS with "introduction methodology conclusion" 
    # and just grab the top 20 chunks that map to the paper.
    query = "introduction methodology conclusion results limitations future work"
    q_emb = embed_texts([query])[0]
    indices = search(q_emb, top_k=30)
    
    chunks = []
    for idx in indices:
        meta = get_metadata(idx)
        if meta and meta["paper_id"] == paper_id:
            chunks.append(meta["text"])
    
    return "\n".join(chunks)

@router.post("/keywords")
def get_keywords(req: KeywordRequest):
    content = _get_paper_content_dumb_search(req.paper_id)
    if not content: return {"error": "Paper not found."}

    system_prompt = "You are a senior academic researcher and librarian specializing in metadata and indexing."
    user_prompt = f"""Identify the top 10 most critical domain-specific keywords and technical terms from this research content.
    - Prioritize methodologies, algorithms, and unique findings.
    - Each keyword should be conceptually significant.
    - Format: Return ONLY a comma-separated list of keywords.

    CONTENT SNIPPET:
    {content}
    """
    response = call_llm(system_prompt, user_prompt)
    return {"keywords": [k.strip() for k in response.split(",") if k.strip()]}

@router.post("/section-summarize")
def get_section_summary(req: SectionSummarizeRequest):
    content = _get_paper_content_dumb_search(req.paper_id)
    if not content: return {"error": "Paper not found."}

    system_prompt = "You are an expert technical editor."
    user_prompt = f"""
    Read the provided research sections and strictly output a summary categorized by:
    - Introduction
    - Methodology
    - Results
    - Conclusion

    Be concise. If a section is unidentifiable, note it.
    Content:\n{content}
    """
    response = call_llm(system_prompt, user_prompt)
    return {"section_summary": response}

@router.post("/eli5")
def eli5(req: ELI5Request):
    content = _get_paper_content_dumb_search(req.paper_id)
    if not content: return {"error": "Paper not found."}

    system_prompt = "You are an expert communicator who excels at simplifying extremely complex scientific concepts into intuitive metaphors that a 5-year-old would understand."
    
    topic = f"the concept of '{req.topic}'" if req.topic else "the core premise of this entire paper"
    
    user_prompt = f"""
    Explain {topic} in the most intuitive way possible for a 5-year-old child.
    - Use relatable analogies (like LEGOs, playground rules, or common animals).
    - Avoid all technical jargon.
    - Keep it under 150 words.
    - Start with something like 'Imagine you have...' or 'Think of it like...'
    
    RESEARCH PAPER CONTEXT:
    {content}
    """
    response = call_llm(system_prompt, user_prompt)
    return {"eli5": response}

@router.post("/research-gap")
def get_research_gaps(req: GapRequest):
    # Query FAISS specifically for limitations and future work
    query = "limitations shortcomings challenges future work directions opportunities gap"
    q_emb = embed_texts([query])[0]
    indices = search(q_emb, top_k=10)
    
    chunks = []
    for idx in indices:
        meta = get_metadata(idx)
        if meta and meta["paper_id"] == req.paper_id:
            chunks.append(meta["text"])
            
    content = "\n".join(chunks) if chunks else _get_paper_content_dumb_search(req.paper_id)
    if not content: return {"error": "Paper not found."}

    system_prompt = "You are an expert academic peer reviewer for top-tier journals like Nature and Science."
    user_prompt = f"""
    Critically analyze the provided portions of this research paper and identify major research gaps and opportunities:
    
    ### 1. Research Limitations 
    List technical constraints, data limitations, or methodological assumptions.
    
    ### 2. The Unsolved Problem (The Gap)
    Clearly articulate what remaines unknown despite this work.
    
    ### 3. Future Research Vectors
    Suggest 3 high-impact directions for subsequent research to tackle these gaps.
    
    FORMAT: Markdown bullet points for each section.
    
    CONTENT SNIPPETS:
    {content}
    """
    response = call_llm(system_prompt, user_prompt)
    return {"gaps": response}

@router.get("/export/{paper_id}/{export_type}", response_class=PlainTextResponse)
def export_results(paper_id: str, export_type: str):
    content = _get_paper_content_dumb_search(paper_id)
    if export_type == "summary":
        ans = call_llm("Summarizer", f"Summarize in detailed paragraphs:\n{content}")
        return ans
    elif export_type == "insights":
        ans = call_llm("Analyst", f"Extract deep insights:\n{content}")
        return ans
    return "Unknown export type."

@router.post("/quiz")
def generate_quiz(req: QuizRequest):
    content = _get_paper_content_dumb_search(req.paper_id)
    if not content: return {"error": "Paper not found."}

    system_prompt = "You are an educational designer. Your goal is to help a researcher test their understanding of a paper."
    user_prompt = f"""
    Based on the provided research context, generate 5 High-Quality Multiple Choice Questions (MCQs).
    - Each question should test a core concept, methodology, or key result.
    - Provide 4 options (A, B, C, D) for each.
    - Clearly mark the correct answer.
    - Ensure the explanation for the correct answer is insightful.

    FORMAT: You MUST return valid JSON ONLY in the following array structure:
    [
      {{
        "question": "What is...",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "answer": "Option A",
        "explanation": "This is correct because..."
      }},
      ...
    ]

    RESEARCH CONTEXT:
    {content}
    """
    response = call_llm(system_prompt, user_prompt)
    
    # Try to extract JSON if there's any surrounding text
    import json
    import re
    try:
        # Find the first [ and last ]
        match = re.search(r'\[.*\]', response, re.DOTALL)
        if match:
            quiz_json = json.loads(match.group())
            return {"quiz": quiz_json}
        else:
            return {"error": "Failed to generate valid quiz format."}
    except Exception as e:
        return {"error": f"JSON Parsing Error: {str(e)}", "raw": response}

@router.post("/flashcards")
def generate_flashcards(req: FlashcardRequest):
    content = _get_paper_content_dumb_search(req.paper_id)
    if not content: return {"error": "Paper not found."}

    system_prompt = "You are a specialized flashcard generator (Anki style)."
    user_prompt = f"""
    Generate 10 high-quality flashcards to help a student memorize concepts from this paper.
    - Front: A concise question or term.
    - Back: A clear, definitive answer or definition.
    - Focus on key definitions, findings, and methodologies.

    FORMAT: You MUST return valid JSON ONLY in the following array structure:
    [
      {{
        "front": "Term or Question",
        "back": "Definition or Answer"
      }},
      ...
    ]

    RESEARCH CONTEXT:
    {content}
    """
    response = call_llm(system_prompt, user_prompt)
    
    import json
    import re
    try:
        match = re.search(r'\[.*\]', response, re.DOTALL)
        if match:
            cards_json = json.loads(match.group())
            return {"flashcards": cards_json}
        else:
            return {"error": "Failed to generate valid flashcard format."}
    except Exception as e:
        return {"error": f"JSON Parsing Error: {str(e)}", "raw": response}

@router.post("/mindmap")
def generate_mindmap(req: MindmapRequest):
    content = _get_paper_content_dumb_search(req.paper_id)
    if not content: return {"error": "Paper not found."}

    system_prompt = "You are a knowledge architect who excels at distilling complex research into clear hierarchical structures."
    user_prompt = f"""
    Analyze this research paper and create a mind map structure.
    The mind map should have:
    - A central node with the paper's main topic/title (keep it short, max 6 words)
    - 4-6 major branches representing key themes (e.g., Problem, Methodology, Key Findings, Contributions, Limitations)
    - Each branch should have 2-4 sub-nodes with concise labels (max 8 words each)

    FORMAT: You MUST return valid JSON ONLY in the following structure:
    {{
      "central": "Main Topic",
      "branches": [
        {{
          "label": "Branch Name",
          "children": ["Sub-point 1", "Sub-point 2", "Sub-point 3"]
        }}
      ]
    }}

    RESEARCH CONTEXT:
    {content}
    """
    response = call_llm(system_prompt, user_prompt)

    import json
    import re
    try:
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            mindmap_json = json.loads(match.group())
            return {"mindmap": mindmap_json}
        else:
            return {"error": "Failed to generate valid mindmap format."}
    except Exception as e:
        return {"error": f"JSON Parsing Error: {str(e)}", "raw": response}


@router.post("/glossary")
def get_glossary(req: GlossaryRequest):
    content = _get_paper_content_dumb_search(req.paper_id)
    if not content: return {"error": "Paper not found."}

    system_prompt = "You are a master teacher who excels at explaining complex technical jargon using simple metaphors."
    user_prompt = f"""
    Identify the top 10-15 most technical or confusing terms from the following research content.
    For each term:
    1. Explain it simply.
    2. Provide a 'Real-World Metaphor' to help understand it better.

    FORMAT: Return the result as a Markdown table with the columns: | Term | Simple Explanation | Real-World Metaphor |

    CONTENT:
    {content}
    """
    response = call_llm(system_prompt, user_prompt)
    return {"glossary": response}

@router.get("/my-papers")
def list_my_papers():
    return {"papers": get_all_papers_for_user()}
