# Research Summarix AI 🚀

**Research Summarix AI** is an advanced, AI-powered research assistant designed to transform the way we interact with academic and technical documents. Leveraging Retrieval-Augmented Generation (RAG) and high-performance LLMs, it distills complex papers into actionable insights in seconds.

## 🌟 Key Features

### 🧠 Intelligence & Analysis
- **Multi-Level Summarization**: Choose between Executive Summaries, Technical Synopses, or Detailed Deep-Dive Analyses.
- **RAG-Powered Chat**: Ask complex questions and get answers strictly grounded in the document context.
- **Research Gap Analysis**: Identifies limitations and suggests future research directions.
- **Keyword & Section Extraction**: Instantly isolate methodologies, results, and core contributions.

### 🎓 Learning & Education
- **ELI5 (Explain Like I'm Five)**: Simplifies complex technical jargon into intuitive, real-world metaphors.
- **AI-Generated Quizzes**: Test your knowledge with 5-question MCQs generated directly from the content.
- **Digital Flashcards**: Automatically creates study cards for key terms and findings.
- **Mind Map Visualization**: Hierarchical structure visualization of the paper's main themes.
- **Technical Glossary**: A context-aware dictionary explaining paper-specific jargon.

### 💼 Premium Experience
- **Document Library**: Persistent history management for all previous uploads.
- **Multi-Model Support**: Integrated fallback system using Gemini, Groq (Llama 3), and OpenRouter.
- **Theme-Aware UI**: Beautiful, high-impact dashboard with seamless Dark/Light mode transitions.

---

## 🛠️ Technical Stack

- **Backend**: FastAPI (Python), FAISS (Vector Database)
- **Frontend**: React, Vite, CSS3 (Glassmorphism)
- **RAG Pipeline**: Sentence Transformers, PyMuPDF, OpenAI-compatible APIs (Gemini/Groq)
- **Deployment**: Configured for quick setup with `.env` based orchestration.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js & npm

### Backend Setup
1. Navigate to the root directory.
2. Create reaching virtual environment: `python -m venv venv`.
3. Activate venv: `.\venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux).
4. Install dependencies: `pip install -r requirements.txt`.
5. Configure `.env` with your Gemini/Groq API keys.
6. Run: `uvicorn app.main:app --reload`.

### Frontend Setup
1. Navigate to `frontend/`.
2. Install dependencies: `npm install`.
3. Run: `npm run dev`.

---

## 📄 License
MIT License - See [LICENSE](LICENSE) for details.

#AI #MachineLearning #Research #FastAPI #React #Productivity #EdTech #GenerativeAI
