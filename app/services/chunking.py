from typing import List

def chunk_text(text: str, max_tokens: int = 1000, overlap: int = 100) -> List[str]:
    chunks = []
    start = 0

    while start < len(text):
        end = start + max_tokens
        chunk = text[start:end]
        chunks.append(chunk.strip())

        start = end - overlap
        if start < 0:
            start = 0
            
        if end >= len(text):
            break

    return [c for c in chunks if len(c) > 30]