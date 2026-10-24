import pdfplumber, json, sys

src = r"C:\Users\FKDMA\Downloads\price wefam 13-10-2026.pdf"
out_tables = r"C:\Users\FKDMA\AppData\Local\hermes\cache\scratch\wefam-tables.json"
out_text = r"C:\Users\FKDMA\AppData\Local\hermes\cache\scratch\wefam-text.txt"

rows = []
full_text = []
with pdfplumber.open(src) as pdf:
    for i, page in enumerate(pdf.pages):
        txt = page.extract_text() or ""
        full_text.append(f"=== PAGE {i+1} ===\n{txt}")
        for t in page.extract_tables():
            for row in t:
                cells = [(c or "").strip().replace("\n", " ") for c in row]
                if any(cells):
                    rows.append({"page": i + 1, "cells": cells})

with open(out_tables, "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False)

with open(out_text, "w", encoding="utf-8") as f:
    f.write("\n".join(full_text))

print("table rows:", len(rows))
print("pages:", len(full_text))
