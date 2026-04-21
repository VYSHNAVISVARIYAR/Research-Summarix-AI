from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.routes import upload, summarize, insights, ask, auth, extra
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os

app = FastAPI(title="Research Summarix AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://127.0.0.1:8000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(summarize.router, prefix="/api", tags=["summarize"])
app.include_router(insights.router, prefix="/api", tags=["insights"])
app.include_router(ask.router, prefix="/api", tags=["ask"])
app.include_router(extra.router, prefix="/api/feature", tags=["extra"])

# Serve frontend statically
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(frontend_path, "index.html"))

@app.get("/health")
def health():
    return {"status": "ok"}

app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")