from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict

class QuizRequest(BaseModel):
    paper_id: str

class FlashcardRequest(BaseModel):
    paper_id: str

class MindmapRequest(BaseModel):
    paper_id: str

class GlossaryRequest(BaseModel):
    paper_id: str

class SummarizeRequest(BaseModel):
    paper_id: str
    length: str = "short"   # short / medium / long

class InsightRequest(BaseModel):
    paper_id: str

class AskRequest(BaseModel):
    paper_id: str
    question: str

class SectionSummarizeRequest(BaseModel):
    paper_id: str

class ELI5Request(BaseModel):
    paper_id: str
    topic: Optional[str] = None # If None, ELI5 the whole paper

class GapRequest(BaseModel):
    paper_id: str

class ExportRequest(BaseModel):
    paper_id: str

class KeywordRequest(BaseModel):
    paper_id: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    email: str
    name: str