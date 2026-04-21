import React, { useState, useEffect, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import './index.css';

const API_BASE = "http://localhost:8000";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [userName, setUserName] = useState(localStorage.getItem("userName") || "");
  const [view, setView] = useState("auth"); // auth, dashboard
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      localStorage.setItem("userName", userName);
      setView("dashboard");
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("userName");
      setView("auth");
    }
  }, [token, userName]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

  const handleLogout = () => {
    setToken("");
    setUserName("");
  };

  return (
    <div className="app-shell">
      <AppBackground view={view} />
      {view === "auth" ? 
        <Auth setToken={setToken} setUserName={setUserName} theme={theme} toggleTheme={toggleTheme} /> : 
        <Dashboard token={token} userName={userName} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
      }
    </div>
  );
}

function AppBackground({ view }) {
  return (
    <div className={`app-background ${view === 'dashboard' ? 'view-dashboard' : ''}`}>
      <div className="bg-image-layer"></div>
      <div className="bg-motif-layer"></div>
    </div>
  );
}

// --- AUTH COMPONENT ---
function Auth({ setToken, setUserName, theme, toggleTheme }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isLogin) {
        const fd = new URLSearchParams();
        fd.append("username", email);
        fd.append("password", password);
        const res = await fetch(`${API_BASE}/api/login`, {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: fd
        });
        if (!res.ok) throw new Error("Invalid credentials");
        const data = await res.json();
        setToken(data.access_token);
        setUserName(email.split('@')[0]);
      } else {
        const res = await fetch(`${API_BASE}/api/signup`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password })
        });
        if (!res.ok) throw new Error("Signup failed");
        setIsLogin(true);
        alert("Account created. Please login.");
      }
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>Research Summarix AI</h1>
        <button className="theme-toggle-auth" onClick={toggleTheme} title="Toggle Dark/Light Mode">
          {theme === "dark" ? "☀️ Light" : "🌙 Dark"} Mode
        </button>
        <div className="auth-tabs">
          <button className={isLogin ? 'active' : ''} onClick={() => setIsLogin(true)}>Login</button>
          <button className={!isLogin ? 'active' : ''} onClick={() => setIsLogin(false)}>Sign Up</button>
        </div>
        <form onSubmit={handleSubmit}>
          {!isLogin && <input type="text" placeholder="Name" required value={name} onChange={e => setName(e.target.value)} />}
          <input type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit" className="primary-btn" disabled={loading}>{loading ? "..." : (isLogin ? "Login" : "Sign Up")}</button>
          {error && <p className="error-msg">{error}</p>}
        </form>
      </div>
    </div>
  );
}

// --- MAIN DASHBOARD (DOCUMENT-CENTRIC) ---
function Dashboard({ token, userName, onLogout, theme, toggleTheme }) {
  const [activePaper, setActivePaper] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState("summarize"); 
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [analysisCache, setAnalysisCache] = useState({}); // Stores results for all tools
  const [summaryLevel, setSummaryLevel] = useState("medium");
  const [quizData, setQuizData] = useState(null);
  const [flashcardData, setFlashcardData] = useState(null);
  const [mindmapData, setMindmapData] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({}); // { index: selectedOption }
  const [paperUrl, setPaperUrl] = useState("");
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const [processingStatus, setProcessingStatus] = useState("Processing document...");

  // Trigger analysis when tabs are switched or paper changes
  useEffect(() => {
    if (!activePaper) return;
    
    // Using !analysisCache[key] handles both undefined and null
    if (activeAnalysisTab === 'summarize' && !analysisCache['summarize'] && !isLoading) {
        executeAction('summarize');
    } else if (activeAnalysisTab === 'insights' && !analysisCache['insights'] && !isLoading) {
        executeAction('insights');
    } else if (activeAnalysisTab === 'mindmap' && !mindmapData && !isLoading) {
        executeAction('mindmap');
    } else if (activeAnalysisTab === 'quiz' && !quizData && !isLoading) {
        executeAction('quiz');
    } else if (activeAnalysisTab === 'flashcards' && !flashcardData && !isLoading) {
        executeAction('flashcards');
    } else if (['keywords', 'eli5', 'gap', 'glossary'].includes(activeAnalysisTab) && !analysisCache[activeAnalysisTab] && !isLoading) {
        executeAction(activeAnalysisTab);
    }
  }, [activeAnalysisTab, activePaper, analysisCache, summaryLevel, quizData, flashcardData, mindmapData]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);
    
    // Smoothly cycle through status messages while backend works
    const messages = ["Reading paper structure...", "Extracting key findings...", "Generating semantic embeddings...", "Syncing with AI brain..."];
    let i = 0;
    const interval = setInterval(() => {
      setProcessingStatus(messages[i % messages.length]);
      i++;
    }, 1500);

    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd
      });
      const data = await res.json();
      setActivePaper({ id: data.paper_id, name: file.name });
      setAnalysisCache({ 'initial': `**Successfully Processed ${file.name}**\n\nAll features are now unlocked. Please select an analysis tool below.` });
      setQuizData(null); setFlashcardData(null); setMindmapData(null);
    } catch (e) { alert("Upload failed"); } finally { 
      setIsLoading(false); 
      clearInterval(interval);
      setProcessingStatus("Processing document..."); 
    }
  };

  const handleUrlUpload = async (e) => {
    e.preventDefault();
    if (!paperUrl.trim()) return;
    setIsLoading(true);
    
    const messages = ["Connecting to source...", "Fetching paper content...", "Extracting research data...", "Feeding AI brain..."];
    let i = 0;
    const interval = setInterval(() => {
      setProcessingStatus(messages[i % messages.length]);
      i++;
    }, 1500);

    try {
      const res = await fetch(`${API_BASE}/api/upload-url`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ url: paperUrl })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || "Unknown server error");
      }

      const paperName = data.title || paperUrl.split('/').pop() || "Linked Paper";
      setActivePaper({ id: data.paper_id, name: paperName });
      setAnalysisCache({ 'initial': `**Successfully Processed ${paperName}**\n\nAll features are now unlocked. Please select an analysis tool below.` });
      setQuizData(null); setFlashcardData(null); setMindmapData(null);
    } catch (e) { 
      alert("URL processing failed: " + e.message); 
    } finally { 
      setIsLoading(false); 
      clearInterval(interval);
      setProcessingStatus("Processing document..."); 
    }
  };

  const executeAction = async (actionType, params = {}) => {
    if (!activePaper) return;
    setIsLoading(true);
    
    const analysisMessages = ["Consulting AI Scholar...", "Synthesizing research data...", "Extracting key metrics...", "Building logical response..."];
    let j = 0;
    const actionInterval = setInterval(() => {
        setProcessingStatus(analysisMessages[j % analysisMessages.length]);
        j++;
    }, 2000);

    let endpoint = "";
    let body = { paper_id: activePaper.id, ...params };
    
    switch(actionType) {
      case "summarize": endpoint = "/api/summarize"; body.length = summaryLevel; break;
      case "insights": endpoint = "/api/insights"; break;
      case "keywords": endpoint = "/api/feature/keywords"; break;
      case "eli5": endpoint = "/api/feature/eli5"; break;
      case "gap": endpoint = "/api/feature/research-gap"; break;
      case "quiz": endpoint = "/api/feature/quiz"; break;
      case "flashcards": endpoint = "/api/feature/flashcards"; break;
      case "mindmap": endpoint = "/api/feature/mindmap"; break;
      case "glossary": endpoint = "/api/feature/glossary"; break;
    }

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (actionType === "quiz") {
        setQuizData(data.quiz || []);
        setQuizAnswers({});
      } else if (actionType === "flashcards") {
        setFlashcardData(data.flashcards || []);
      } else if (actionType === "mindmap") {
        setMindmapData(data.mindmap || null);
      } else {
        setQuizData(null);
        setFlashcardData(null);
        setMindmapData(null);
        const resultText = data.summary || data.insights || data.eli5 || data.gaps || data.section_summary || data.glossary || (data.keywords ? `### Keywords:\n${data.keywords.join(", ")}` : "No result.");
        setAnalysisCache(prev => ({ ...prev, [actionType]: resultText }));
      }
    } catch (e) { 
      console.error(e);
      const errMsg = `❌ **Analysis Failed**\n\nThe AI was unable to process this request. This often happens if the API key is missing or the server is overloaded. Please check your .env file or try again in a moment.`;
      setAnalysisCache(prev => ({ ...prev, [actionType]: errMsg }));
      if (actionType === 'quiz') setQuizData([]);
      if (actionType === 'flashcards') setFlashcardData([]);
      if (actionType === 'mindmap') setMindmapData({ central: "Error", branches: [] });
    } finally { 
      setIsLoading(false); 
      clearInterval(actionInterval);
      setProcessingStatus("Processing document...");
    }
  };

  const handleQuizAnswer = (qIdx, option) => {
     setQuizAnswers(prev => ({ ...prev, [qIdx]: option }));
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !activePaper) return;
    const q = chatInput; setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: q }]);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ask`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ paper_id: activePaper.id, question: q })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: "assistant", content: data.answer, citations: data.citations }]);
    } catch (e) { alert("Chat failed"); } finally { setIsLoading(false); }
  };

  const exportToPDF = () => {
    const el = document.getElementById('pdf-export-content');
    if (!el) {
        alert("Nothing to export yet!");
        return;
    }

    // Directly apply the print class to the active DOM element
    // This allows html2canvas to flawlessly trace the CSS properties
    el.classList.add('pdf-print-mode');
    el.style.padding = '40px'; 

    const opt = {
      margin: 15,
      filename: `${activeAnalysisTab}-export.pdf`,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    // We execute the export, and instantly revert the theme 
    // once the pdf engine has fully captured the frame.
    html2pdf().from(el).set(opt).save().then(() => {
        el.classList.remove('pdf-print-mode');
        el.style.padding = '';
    });
  };

  const formatMD = (text) => {
    if (!text) return { __html: "" };
    
    let html = text;
    // Simple table parser
    if (html.includes('|')) {
        const lines = html.split('\n');
        let tableHTML = '<div class="table-container"><table><thead>';
        let inTable = false;
        let finalLines = [];
        
        lines.forEach((line) => {
            if (line.trim().startsWith('|')) {
                const cells = line.split('|').filter(c => c.trim() !== '');
                if (line.includes('---')) {
                    if (inTable) tableHTML = tableHTML.replace('</thead>', '</thead><tbody>');
                    return;
                }
                
                if (!inTable) {
                    inTable = true;
                    tableHTML += '<tr>' + cells.map(c => `<th>${c.trim()}</th>`).join('') + '</tr>';
                } else {
                    tableHTML += '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
                }
            } else {
                if (inTable) {
                    tableHTML += '</tbody></table></div>';
                    finalLines.push(tableHTML);
                    tableHTML = '<div class="table-container"><table><thead>'; // Reset for next potential table
                    inTable = false;
                }
                finalLines.push(line);
            }
        });
        if (inTable) tableHTML += '</tbody></table></div>';
        html = finalLines.join('\n') + (inTable ? tableHTML : '');
    }

    html = html
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/^\s*\*\s+(.*)$/gim, '• $1')
      .replace(/\n/gim, '<br/>');
    return { __html: html };
  };

  return (
    <div className="dashboard-container">
      {/* 🔝 TOP SECTION: UPLOAD (THE CENTRAL ACTION) */}
      <div className="header-bar">
        <div className="logo-group">
          <div className="logo">Research Summarix AI</div>
          {activePaper && (
            <div className="active-doc-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>{activePaper.name}</span>
            </div>
          )}
        </div>
        
        <div className="header-actions">
          <button className="btn-theme-toggle" onClick={toggleTheme} title="Change appearance">
            {theme === "dark" ? 
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> :
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
          
          <input type="file" ref={fileInputRef} hidden accept=".pdf" onChange={handleUpload} />
          
          <div className="user-area">
            <span className="user-name">{userName}</span>
            <button className="btn-logout" onClick={onLogout}>Logout</button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="global-loader">
          <div className="loader-content">
            <div className="spinner"></div>
            <p>{processingStatus}</p>
          </div>
        </div>
      )}

      {/* 🎛️ MIDDLE SECTION: ACTION BUTTONS (SHOWN ONLY AFTER UPLOAD) */}
      {activePaper && (
        <div className="actions-bar">
          <button className={activeAnalysisTab === 'summarize' ? 'active' : ''} onClick={() => { setActiveAnalysisTab('summarize'); setAnalysisCache(p => ({...p, 'summarize': null})); }}>Summarize</button>
          <button className={activeAnalysisTab === 'insights' ? 'active' : ''} onClick={() => { setActiveAnalysisTab('insights'); setAnalysisCache(p => ({...p, 'insights': null})); }}>Insights</button>
          <button className={activeAnalysisTab === 'chat' ? 'active' : ''} onClick={() => setActiveAnalysisTab('chat')}>Chat with Paper</button>
          <button className={activeAnalysisTab === 'quiz' ? 'active' : ''} onClick={() => { setActiveAnalysisTab('quiz'); setQuizData(null); }}>Quiz MCQs</button>
          <button className={activeAnalysisTab === 'flashcards' ? 'active' : ''} onClick={() => { setActiveAnalysisTab('flashcards'); setFlashcardData(null); }}>Flashcards</button>
          <button className={activeAnalysisTab === 'mindmap' ? 'active' : ''} onClick={() => { setActiveAnalysisTab('mindmap'); setMindmapData(null); }}>Mind Map</button>
          <button className={activeAnalysisTab === 'keywords' ? 'active' : ''} onClick={() => { setActiveAnalysisTab('keywords'); setAnalysisCache(p => ({...p, 'keywords': null})); }}>Keywords</button>
          <button className={activeAnalysisTab === 'eli5' ? 'active' : ''} onClick={() => { setActiveAnalysisTab('eli5'); setAnalysisCache(p => ({...p, 'eli5': null})); }}>ELI5</button>
          <button className={activeAnalysisTab === 'gap' ? 'active' : ''} onClick={() => { setActiveAnalysisTab('gap'); setAnalysisCache(p => ({...p, 'gap': null})); }}>Gap Detection</button>
          <button className={activeAnalysisTab === 'glossary' ? 'active' : ''} onClick={() => { setActiveAnalysisTab('glossary'); setAnalysisCache(p => ({...p, 'glossary': null})); }}>Jargon Buster</button>
        </div>
      )}

      {/* 🖥️ BOTTOM SECTION: OUTPUT DISPLAY */}
      <div className="output-display">
        {!activePaper ? (
          <div className="hero-landing">
            <div className="hero-left">
              <div className="features-showcase">
                <div className="feature-item">
                  <div className="f-icon">📝</div>
                  <div className="f-text">
                    <h4>Multi-Length Summaries</h4>
                    <p>Get short, medium, or detailed technical synopses of any paper.</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="f-icon">💡</div>
                  <div className="f-text">
                    <h4>Deep Research Insights</h4>
                    <p>Extract core contributions, methodologies, and quantitative results.</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="f-icon">🗺️</div>
                  <div className="f-text">
                    <h4>Interactive Mind Maps</h4>
                    <p>Visualize the structure and logic of research with AI-generated maps.</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="f-icon">🎓</div>
                  <div className="f-text">
                    <h4>Study Tools</h4>
                    <p>Auto-generate quizzes and active-recall flashcards for better learning.</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="f-icon">🔍</div>
                  <div className="f-text">
                    <h4>Gap Detection</h4>
                    <p>Identify limitations and future research opportunities in the literature.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="hero-right">
              <div className="upload-options-stack">
                <div className="upload-hero-card" onClick={() => fileInputRef.current?.click()}>
                  <div className="upload-icon-large">
                     <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                  <h2>Upload PDF</h2>
                  <p>Select a file from your device</p>
                  <div className="primary-btn-sm" style={{ width: '100%' }}>Choose File</div>
                </div>

                <div className="separator-or">
                  <span>OR</span>
                </div>

                <div className="link-hero-card">
                  <div className="link-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  </div>
                  <h3>Analyze via Link</h3>
                  <p>Paste a PDF URL or paper link to understand it</p>
                  <form className="link-input-group" onSubmit={handleUrlUpload}>
                    <input 
                      type="url" 
                      placeholder="https://arxiv.org/pdf/..." 
                      value={paperUrl} 
                      onChange={(e) => setPaperUrl(e.target.value)}
                      required
                    />
                    <button type="submit" className="primary-btn-sm">Analyze</button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="analysis-view">
            {activeAnalysisTab === 'summarize' && (
              <div className="tab-view">
                 <div className="tab-header">
                    <h3>Summarization</h3>
                    <select value={summaryLevel} onChange={(e) => {
                        setSummaryLevel(e.target.value);
                        setAnalysisCache(prev => ({ ...prev, 'summarize': null })); // Clear cache to trigger re-generation
                    }}>
                        <option value="short">Short</option>
                        <option value="medium">Medium</option>
                        <option value="large">Detailed</option>
                    </select>
                    {analysisCache[activeAnalysisTab] && <button className="primary-btn-sm" style={{ background: '#f59e0b', color: '#fff', marginLeft: 'auto' }} onClick={exportToPDF}>📄 Export PDF</button>}
                 </div>
                 <div className="result-area" id="pdf-export-content" dangerouslySetInnerHTML={formatMD(analysisCache[activeAnalysisTab] || analysisCache['initial'])} />
              </div>
            )}

            {activeAnalysisTab === 'insights' && (
              <div className="tab-view">
                 <div className="tab-header">
                    <h3>Research Insights</h3>
                    {analysisCache[activeAnalysisTab] && <button className="primary-btn-sm" style={{ background: '#f59e0b', color: '#fff', marginLeft: 'auto' }} onClick={exportToPDF}>📄 Export PDF</button>}
                 </div>
                 <div className="result-area" id="pdf-export-content" dangerouslySetInnerHTML={formatMD(analysisCache[activeAnalysisTab])} />
              </div>
            )}

            {activeAnalysisTab === 'chat' && (
              <div className="chat-view">
                 <div className="chat-thread">
                    {chatMessages.map((m, i) => (
                      <div key={i} className={`chat-line ${m.role}`}>
                        <strong>{m.role === 'user' ? 'You' : 'AI'}:</strong>
                        <p>{m.content}</p>
                        {m.citations && <div className="citations">Refs: {m.citations.join(", ")}</div>}
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                 </div>
                 <div className="chat-input-row">
                    <input type="text" placeholder="Ask a question about the document..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} />
                    <button onClick={sendChat}>Send</button>
                 </div>
              </div>
            )}

            {activeAnalysisTab === 'quiz' && (
              <div className="tab-view">
                 <div className="tab-header">
                    <h3>Quiz MCQs</h3>
                 </div>
                 <div className="quiz-area">
                   {quizData === null ? (
                       <div className="result-area" style={{ textAlign: 'center' }}>
                           <p>🚀 **AI is analyzing the research to build your quiz...**</p>
                           <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>This usually takes 5-10 seconds for deep logical synthesis.</p>
                       </div>
                   ) : (
                       <div className="quiz-grid">
                           {quizData.map((q, idx) => (
                               <div key={idx} className="quiz-card">
                                   <h4>{idx + 1}. {q.question}</h4>
                                   <div className="options-grid">
                                       {q.options.map((opt, oIdx) => {
                                           const isSelected = quizAnswers[idx] === opt;
                                           const isCorrect = q.answer === opt;
                                           const showReveal = !!quizAnswers[idx];
                                           
                                           let className = "option-btn";
                                           if (isSelected) className += " selected";
                                           if (showReveal && isCorrect) className += " correct";
                                           if (showReveal && isSelected && !isCorrect) className += " incorrect";

                                           return (
                                               <button key={oIdx} className={className} onClick={() => handleQuizAnswer(idx, opt)} disabled={showReveal}>
                                                   {opt}
                                               </button>
                                           );
                                       })}
                                   </div>
                                   {quizAnswers[idx] && (
                                       <div className="explanation-box animated slide-up">
                                           <strong>{quizAnswers[idx] === q.answer ? '✅ Correct!' : `❌ Incorrect (Correct: ${q.answer})`}</strong>
                                           <p>{q.explanation}</p>
                                       </div>
                                   )}
                               </div>
                           ))}
                       </div>
                   )}
                 </div>
              </div>
            )}

            {activeAnalysisTab === 'flashcards' && (
              <div className="tab-view">
                 <div className="tab-header">
                    <h3>Active-Recall Flashcards</h3>
                 </div>
                 <div className="flashcards-area">
                   {flashcardData === null ? (
                       <div className="result-area" style={{ textAlign: 'center' }}>
                           <p>🧠 **Synthesizing concepts for active-recall flashcards...**</p>
                       </div>
                   ) : (
                       <div className="flashcards-grid">
                           {flashcardData.map((f, idx) => (
                               <Flashcard key={idx} front={f.front} back={f.back} />
                           ))}
                       </div>
                   )}
                 </div>
              </div>
            )}

            {activeAnalysisTab === 'mindmap' && (
              <div className="tab-view">
                 <div className="tab-header">
                    <h3>Research Mind Map</h3>
                 </div>
                 <div className="mindmap-area">
                    {mindmapData === null ? (
                        <div className="result-area" style={{ textAlign: 'center' }}>
                            <p>🗺️ **Architecting the research mind map...**</p>
                        </div>
                    ) : (
                        <MindMap data={mindmapData} />
                    )}
                 </div>
              </div>
            )}

            {['keywords', 'eli5', 'gap', 'glossary'].includes(activeAnalysisTab) && (
               <div className="tab-view">
                 <div className="tab-header">
                    <h3>{
                      activeAnalysisTab === 'keywords' ? 'Keywords' :
                      activeAnalysisTab === 'eli5' ? 'ELI5 Explanation' :
                      activeAnalysisTab === 'gap' ? 'Research Gaps' :
                      'Jargon Buster'
                    }</h3>
                    {analysisCache[activeAnalysisTab] && <button className="primary-btn-sm" style={{ background: '#f59e0b', color: '#fff', marginLeft: 'auto' }} onClick={exportToPDF}>📄 Export PDF</button>}
                 </div>
                 <div className="result-area" id="pdf-export-content" dangerouslySetInnerHTML={formatMD(analysisCache[activeAnalysisTab])} />
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Flashcard({ front, back }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)}>
      <div className="flashcard-inner">
        <div className="flashcard-front">
          <p>{front}</p>
          <small>Click to flip</small>
        </div>
        <div className="flashcard-back">
          <p>{back}</p>
          <small>Click to hide</small>
        </div>
      </div>
    </div>
  );
}

// --- MIND MAP COMPONENT (SVG-based radial layout) ---
function MindMap({ data }) {
  const svgRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  if (!data || !data.central || !data.branches) {
    return <div className="result-area" style={{ textAlign: 'center' }}><p>Could not render mind map.</p></div>;
  }

  const width = 900;
  const height = 700;
  const cx = width / 2;
  const cy = height / 2;
  const branchRadius = 200;
  const leafRadius = 120;

  const branchColors = [
    '#2dd4bf', '#f472b6', '#818cf8', '#fb923c', '#a3e635', '#38bdf8'
  ];

  const branches = data.branches || [];
  const angleStep = (2 * Math.PI) / branches.length;

  return (
    <div className="mindmap-container">
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="mindmap-svg">
        {/* Subtle background grid */}
        <defs>
          <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(45,212,191,0.05)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          {branchColors.map((color, i) => (
            <linearGradient key={`grad-${i}`} id={`lineGrad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
          ))}
        </defs>
        <circle cx={cx} cy={cy} r={Math.min(cx, cy) - 20} fill="url(#bgGrad)" />

        {/* Branch lines and nodes */}
        {branches.map((branch, bi) => {
          const angle = angleStep * bi - Math.PI / 2;
          const bx = cx + branchRadius * Math.cos(angle);
          const by = cy + branchRadius * Math.sin(angle);
          const color = branchColors[bi % branchColors.length];
          const children = branch.children || [];
          const childAngleSpread = 0.6;
          const childStart = angle - (childAngleSpread * (children.length - 1)) / 2;

          return (
            <g key={bi}>
              {/* Line from center to branch */}
              <line
                x1={cx} y1={cy} x2={bx} y2={by}
                stroke={`url(#lineGrad-${bi})`}
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.8"
              />

              {/* Branch node */}
              <circle
                cx={bx} cy={by} r={hoveredNode === `b-${bi}` ? 46 : 42}
                fill="rgba(10,15,24,0.9)"
                stroke={color}
                strokeWidth="2.5"
                style={{ cursor: 'pointer', transition: 'r 0.3s' }}
                onMouseEnter={() => setHoveredNode(`b-${bi}`)}
                onMouseLeave={() => setHoveredNode(null)}
              />
              <text
                x={bx} y={by}
                textAnchor="middle" dominantBaseline="middle"
                fill={color}
                fontSize="11" fontWeight="700"
                style={{ pointerEvents: 'none' }}
              >
                {wrapText(branch.label, 14).map((line, li) => (
                  <tspan key={li} x={bx} dy={li === 0 ? `-${(wrapText(branch.label, 14).length - 1) * 6}px` : '14px'}>
                    {line}
                  </tspan>
                ))}
              </text>

              {/* Child nodes */}
              {children.map((child, ci) => {
                const childAngle = childStart + childAngleSpread * ci;
                const lx = bx + leafRadius * Math.cos(childAngle);
                const ly = by + leafRadius * Math.sin(childAngle);
                const nodeId = `l-${bi}-${ci}`;
                const isHovered = hoveredNode === nodeId;

                return (
                  <g key={ci}>
                    <line
                      x1={bx} y1={by} x2={lx} y2={ly}
                      stroke={color}
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      opacity="0.4"
                    />
                    <rect
                      x={lx - 55} y={ly - 18}
                      width="110" height="36"
                      rx="10" ry="10"
                      fill={isHovered ? 'rgba(255,255,255,0.08)' : 'rgba(10,15,24,0.85)'}
                      stroke={color}
                      strokeWidth="1.5"
                      opacity={isHovered ? 1 : 0.7}
                      style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                      onMouseEnter={() => setHoveredNode(nodeId)}
                      onMouseLeave={() => setHoveredNode(null)}
                    />
                    <text
                      x={lx} y={ly}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="#e2e8f0"
                      fontSize="9" fontWeight="600"
                      style={{ pointerEvents: 'none' }}
                    >
                      {wrapText(child, 16).map((line, li) => (
                        <tspan key={li} x={lx} dy={li === 0 ? `-${(wrapText(child, 16).length - 1) * 5}px` : '11px'}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Central node */}
        <circle
          cx={cx} cy={cy} r={hoveredNode === 'center' ? 58 : 54}
          fill="rgba(10,15,24,0.95)"
          stroke="#2dd4bf" strokeWidth="3"
          style={{ cursor: 'pointer', transition: 'r 0.3s' }}
          onMouseEnter={() => setHoveredNode('center')}
          onMouseLeave={() => setHoveredNode(null)}
        />
        <circle cx={cx} cy={cy} r={54} fill="none" stroke="rgba(45,212,191,0.2)" strokeWidth="8" />
        <text
          x={cx} y={cy}
          textAnchor="middle" dominantBaseline="middle"
          fill="#fff" fontSize="13" fontWeight="800"
          style={{ pointerEvents: 'none' }}
        >
          {wrapText(data.central, 12).map((line, li) => (
            <tspan key={li} x={cx} dy={li === 0 ? `-${(wrapText(data.central, 12).length - 1) * 7}px` : '16px'}>
              {line}
            </tspan>
          ))}
        </text>
      </svg>
    </div>
  );
}

function wrapText(text, maxChars) {
  if (!text) return [''];
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

export default App;
