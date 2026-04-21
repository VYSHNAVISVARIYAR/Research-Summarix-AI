import requests
import os
import uuid
from bs4 import BeautifulSoup
from app.utils.config import DATA_DIR

def fetch_content_from_url(url: str):
    """
    Fetches content from a URL.
    If it's a PDF, downloads it and returns the path.
    If it's a web page, returns the extracted text and a flag.
    """
    print(f"DEBUG: url_service fetching {url}")
    # Define standard headers to mimic a browser
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
    except requests.exceptions.SSLError:
        print(f"DEBUG: SSL Error, retrying without verification...")
        response = requests.get(url, headers=headers, timeout=15, verify=False)
        response.raise_for_status()
    except Exception as e:
        print(f"DEBUG: Fetch failed: {str(e)}")
        raise e
    
    content_type = response.headers.get('Content-Type', '').lower()
    print(f"DEBUG: Content-Type: {content_type}")
    
    if 'application/pdf' in content_type or url.lower().endswith('.pdf'):
        paper_id = str(uuid.uuid4())
        path = os.path.join(DATA_DIR, f"{paper_id}.pdf")
        with open(path, "wb") as f:
            f.write(response.content)
        return {"type": "pdf", "path": path, "paper_id": paper_id}
    else:
        # Assume it's a web page
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.extract()
            
        # Get text
        text = soup.get_text()
        
        # Break into lines and remove leading/trailing whitespace
        lines = (line.strip() for line in text.splitlines())
        # Break multi-headlines into a line each
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        # Drop blank lines
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        # We still need a paper_id for the database/FAISS
        paper_id = str(uuid.uuid4())
        
        # Extract title if possible
        title = soup.title.string if soup.title else url
        
        return {"type": "text", "text": text, "paper_id": paper_id, "title": title}
