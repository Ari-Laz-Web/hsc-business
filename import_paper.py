#!/usr/bin/env python3
"""
HSC Business Studies past-paper import helper.

Usage:
    python3 import_paper.py <path-to-pdf> [year]
"""

import json
import re
import sys
from pathlib import Path
from typing import Optional, List, Dict

try:
    from pypdf import PdfReader
except ImportError:
    print("pypdf not installed. Run: pip3 install pypdf")
    sys.exit(1)


def extract_text(pdf_path: Path) -> str:
    """Extract all text from the PDF, page by page, separated by markers."""
    reader = PdfReader(str(pdf_path))
    pages = []
    for i, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
        except Exception as e:
            print(f"  (page {i+1} extract warning: {e})")
            text = ""
        # Remove page-number footers like "– 4 –" or "- 5 -"
        text = re.sub(r"(?m)^\s*[–\-]\s*\d{1,3}\s*[–\-]\s*$", "", text)
        pages.append(text)
    return "\n".join(pages)


# NESA papers use bare numbers at line start, followed by space(s) and
# then question text (which usually starts with a capital letter or 'Use').
# Examples: "12  Which of the following..." or "21 (a) Outline..."
QUESTION_START_RE = re.compile(
    r"(?m)^\s*(?:Question\s+)?(\d{1,2})\s{2,}([A-Z(])",
)
# Fallback: also match "Question 26" style headers
QUESTION_HEADER_RE = re.compile(r"(?m)^\s*Question\s+(\d{1,2})\b")

MARKS_RE = re.compile(r"\((\d{1,2})\s*marks?\)", re.IGNORECASE)
SINGLE_MARK_RE = re.compile(r"\(1\s*mark\)", re.IGNORECASE)
# MCQ options: "A.  Cost leadership" or "A.   Something"
MCQ_OPTION_RE = re.compile(r"(?m)^\s*([A-D])\.\s+(.+?)$")


def split_into_questions(text: str) -> List[Dict]:
    """Find all question starts and split the text accordingly."""
    matches = []
    for m in QUESTION_START_RE.finditer(text):
        matches.append((m.start(), int(m.group(1)), m.end() - 1))
    for m in QUESTION_HEADER_RE.finditer(text):
        # Only add if not already captured by the main regex at this position
        if not any(abs(start - m.start()) < 5 for start, _, _ in matches):
            matches.append((m.start(), int(m.group(1)), m.end()))

    matches.sort()
    if not matches:
        return []

    questions = []
    for i, (pos, number, content_start) in enumerate(matches):
        end = matches[i + 1][0] if i + 1 < len(matches) else len(text)
        raw = text[content_start:end].strip()
        questions.append({"number": number, "raw": raw})

    # Filter spurious matches: question numbers should be strictly increasing
    # (with allowance for repeated numbers from headers like "Question 26"
    # immediately preceding the question content)
    filtered = []
    expected = 1
    for q in questions:
        if q["number"] >= expected:
            filtered.append(q)
            expected = q["number"] + 1
        elif q["number"] == expected - 1 and filtered:
            # Likely a "Question N" header right before "N ..." content -
            # merge into previous
            filtered[-1]["raw"] = (filtered[-1]["raw"] + "\n" + q["raw"]).strip()
    return filtered


def detect_type(raw: str, number: int, marks: Optional[int]) -> str:
    if number <= 20 and len(MCQ_OPTION_RE.findall(raw)) >= 3:
        return "mcq"
    if marks is None:
        return "short"
    if marks >= 15:
        return "report" if re.search(r"\breport\b", raw, re.IGNORECASE) else "extended"
    return "short"


def parse_mcq(raw: str) -> Dict:
    options = MCQ_OPTION_RE.findall(raw)
    first_opt = MCQ_OPTION_RE.search(raw)
    prompt = raw[: first_opt.start()].strip() if first_opt else raw.strip()
    prompt = clean_whitespace(prompt)
    opt_texts = [clean_whitespace(text) for _, text in options[:4]]
    return {"prompt": prompt, "options": opt_texts, "correct": ""}


def parse_text_question(raw: str) -> Dict:
    text = MARKS_RE.sub("", raw)
    text = SINGLE_MARK_RE.sub("", text)
    text = clean_whitespace(text).strip()
    return {"prompt": text}


def clean_whitespace(s: str) -> str:
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def extract_marks(raw: str) -> Optional[int]:
    m = MARKS_RE.search(raw) or SINGLE_MARK_RE.search(raw)
    if not m:
        return None
    if "1 mark" in m.group(0).lower():
        return 1
    return int(m.group(1)) if m.lastindex else 1


KEYWORDS = {
    "operations": [
        "operations", "supply chain", "inputs", "outputs", "transformation",
        "quality", "logistics", "inventory", "production", "gantt", "lean",
    ],
    "marketing": [
        "marketing", "branding", "promotion", "advertising", "product",
        "consumer behaviour", "target market", "market segment", "pricing",
    ],
    "finance": [
        "finance", "financial", "cash flow", "balance sheet", "profitability",
        "liquidity", "solvency", "debt", "equity", "ratio", "income statement",
        "gearing", "current assets", "shareholders",
    ],
    "hr": [
        "human resource", "employee", "recruitment", "training", "workplace",
        "industrial relations", "performance management", "remuneration",
        "leadership style", "staff",
    ],
}


def guess_topic(text: str) -> str:
    text = text.lower()
    scores = {topic: sum(text.count(kw) for kw in kws)
              for topic, kws in KEYWORDS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else ""


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 import_paper.py <pdf> [year]")
        sys.exit(1)

    pdf_path = Path(sys.argv[1]).expanduser()
    if not pdf_path.exists():
        print(f"File not found: {pdf_path}")
        sys.exit(1)

    year = None
    if len(sys.argv) >= 3:
        year = int(sys.argv[2])
    else:
        m = re.search(r"(20\d{2})", pdf_path.name)
        if m:
            year = int(m.group(1))
        else:
            year = int(input("Year? "))

    print(f"Reading {pdf_path.name}...")
    text = extract_text(pdf_path)
    print(f"  extracted {len(text):,} chars across the document")

    questions = split_into_questions(text)
    print(f"  detected {len(questions)} candidate questions")
    if questions:
        nums = [q["number"] for q in questions]
        print(f"  question numbers: {nums}")

    output = []
    for q in questions:
        raw = q["raw"]
        marks = extract_marks(raw)
        qtype = detect_type(raw, q["number"], marks)

        if qtype == "mcq":
            parsed = parse_mcq(raw)
            entry = {
                "id": f"TODO-{year}-q{q['number']}",
                "year": year,
                "type": "mcq",
                "marks": marks or 1,
                "prompt": parsed["prompt"],
                "options": parsed["options"],
                "correct": parsed["correct"],
                "explanation": "",
                "_topic_guess": guess_topic(parsed["prompt"]),
                "_topic": "",
                "_subtopic": "",
            }
        else:
            parsed = parse_text_question(raw)
            entry = {
                "id": f"TODO-{year}-q{q['number']}",
                "year": year,
                "type": qtype,
                "marks": marks,
                "prompt": parsed["prompt"],
                "suggested_words": {"short": 100, "report": 800, "extended": 1000}.get(qtype),
                "criteria": [{"band": "", "description": ""}],
                "exemplar": "",
                "_topic_guess": guess_topic(parsed["prompt"]),
                "_topic": "",
                "_subtopic": "",
            }
        output.append(entry)

    out_path = pdf_path.with_name(f"{pdf_path.stem}_draft.json")
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nWrote {out_path}")
    print(f"  {sum(1 for q in output if q['type'] == 'mcq')} MCQs")
    print(f"  {sum(1 for q in output if q['type'] == 'short')} short answer")
    print(f"  {sum(1 for q in output if q['type'] == 'report')} business report")
    print(f"  {sum(1 for q in output if q['type'] == 'extended')} extended response")


if __name__ == "__main__":
    main()
