import faiss
import numpy as np
import os
import json
from app.utils.config import EMBED_DIM, INDEX_DIR

index = faiss.IndexFlatL2(EMBED_DIM)
metadata_store = {}
next_id = 0

def add_embeddings(embeddings, chunks, paper_id):
    global next_id

    for i, emb in enumerate(embeddings):
        index.add(np.expand_dims(emb, axis=0))

        metadata_store[str(next_id)] = {
            "paper_id": paper_id,
            "text": chunks[i]
        }

        next_id += 1

def search(query_emb, top_k=5):
    D, I = index.search(np.expand_dims(query_emb, axis=0), top_k)
    return I[0]

def get_metadata(idx):
    return metadata_store.get(str(idx))