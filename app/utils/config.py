import os

DATA_DIR = "data"
INDEX_DIR = "index"

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(INDEX_DIR, exist_ok=True)

# MiniLM model (faster)
EMBED_MODEL_NAME = "all-MiniLM-L6-v2"
EMBED_DIM = 384

TOP_K = 5