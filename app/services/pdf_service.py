import fitz

def extract_text_from_pdf(path: str) -> str:
    doc = fitz.open(path)
    pages = []

    for page in doc:
        text = page.get_text("text")
        pages.append(text)

    return "\n\n".join(pages)