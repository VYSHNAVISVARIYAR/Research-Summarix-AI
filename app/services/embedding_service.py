from sentence_transformers import SentenceTransformer
import numpy as np
from app.utils.config import EMBED_MODEL_NAME

model = SentenceTransformer(EMBED_MODEL_NAME)

def embed_texts(texts: list[str]) -> np.ndarray:
    print(f"DEBUG: Encoding {len(texts)} chunks...")
    return model.encode(texts, convert_to_numpy=True, batch_size=32, show_progress_bar=True)