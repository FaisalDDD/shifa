# One-command importer: price-list PDF -> Shifa products SQL.
# Usage: py -3.10 import_price_list.py "path/to/list.pdf" [out.sql]
# Steps: extract tables (pdfplumber) -> parse -> normalize -> classify -> SQL.
import json, re, sys
import pdfplumber

src = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\FKDMA\Downloads\price wefam 13-10-2026.pdf"
out = sys.argv[2] if len(sys.argv) > 2 else r"C:\Users\FKDMA\AppData\Local\hermes\cache\scratch\price-import.sql"

HEADERS = {"ITEM", "DESC", "UNIT", "PRICE", "ORDER"}
FORM_RE = [
    (r"\btablets?\b", "tablet"), (r"\btab\b", "tablet"), (r"\bcaps?\b", "capsule"),
    (r"\bcapsules?\b", "capsule"), (r"\bsyrups?\b", "syrup"), (r"\bsy?rps?\b", "syrup"),
    (r"\bsuspensions?\b", "suspension"), (r"\bsusps?\b", "suspension"),
    (r"\binjections?\b", "injection"), (r"\binj\b", "injection"), (r"\bamp(oule)?s?\b", "ampoule"),
    (r"\bcreams?\b", "cream"), (r"\boin[tn]?ments?\b", "ointment"), (r"\bgels?\b", "gel"),
    (r"\bdrops?\b", "drops"), (r"\blotions?\b", "lotion"), (r"\bsoaps?\b", "soap"),
    (r"\bshampoos?\b", "shampoo"), (r"\bsachets?\b", "sachet"), (r"\bpowders?\b", "powder"),
    (r"\bsupp(ositories?)?\b", "suppository"), (r"\bvials?\b", "vial"), (r"\bsprays?\b", "spray"),
    (r"\binhalers?\b", "inhaler"), (r"\bsolutions?\b", "solution"),
    (r"\beff(ervescent)?\b", "effervescent"), (r"\blozenges?\b", "lozenge"),
    (r"\bplaster\b", "plaster"), (r"\bdressings?\b", "dressing"), (r"\binfusion\b", "infusion"),
    (r"\bdrip\b", "infusion"), (r"\bfoam\b", "foam"), (r"\bwash\b", "wash"),
    (r"\btonic\b", "tonic"), (r"\boil\b", "oil"),
]
STRENGTH_RE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|g|gm|ml|mI|IU|I\.U|U|%)\s*(?:/\s*(\d+(?:[.,]\d+)?)\s*(ml|5ml|1ml))?",
    re.IGNORECASE,
)
MFR_WORDS = [
    "RAFEF","Azal","Abo-omar","Israa","Scott Edil","ATLAL","TABUK -SUDAN","TABUK-SUDAN",
    "TABUK","Amipharma","C D C","TAHA","Al-shahba","Africa","Salsapela","Salmawit",
    "Swar Elzahab","fix pharma","Med pharma","D-LAMIS","Delta","Derma show","Rameda",
    "Techno pharma","Khair Zad","Dawani","SATA CO","Samph","Royal Plus","Ratag","ALDOMA",
    "ALRAFIA","ALZAMZAMI","Alsanahuri medical","Elshifa","Elmabarra","Al-motasim bellah",
    "Alnil","Alhaitham","Alwathba","Alwli Midcal","Alwaleef","Amanta","Awlad al-zaki",
    "OMAP","Badr","predo","FABENTOD","WALL GREN PHARMA","China","Ali kambal","Pharma Trading",
    "Pharma Ixir","PHARMA QUEEN","Pharmacare","Kalapharma","Kambal","king stone",
    "kondi medical","quick pharma","lawis","Crescent","LONG REACH","Mathely","Laboratory",
    "labrox lab","Nova laboratory","Medizen","Najmet al sahara","Next Generation","Noble",
    "Hala pharma","Cima","Diff. Companies","Integrated","Dan","RAZAM CO","Shoniz Medical",
    "Wafra Pharma","LAMA CO","Unity pharma","S M","B pharma",
]
FIX = {
    "amilodipine":"amlodipine","glemipride":"glimepiride","propanolol":"propranolol",
    "esmoprazole":"esomeprazole","trtinoin":"tretinoin","domperidne":"domperidone",
    "cefodoxime":"cefpodoxime","metfomin":"metformin","guaifnesin":"guaifenesin",
    "cefalixin":"cephalexin","amocixillin":"amoxicillin","valprote":"valproate",
    "lopramide":"loperamide","methyprednisonlone":"methylprednisolone","losertan":"losartan",
    "candestan":"candesartan","ondansteron":"ondansetron","mebeverine hcl":"mebeverine",
    "omeprazole s":"omeprazole","cefotaxime for":"cefotaxime","glimepride":"glimepiride",
    "gapapentin":"gabapentin","norethisteron":"norethisterone","clotrimazol":"clotrimazole",
    "metronidazol":"metronidazole","acetylsalisalic":"acetylsalicylic",
    "benzyl penicillin":"penicillin","lidocaine hcl":"lidocaine","sodium fusidate":"fusidic acid",
    "sudium":"sodium","aspirin":"acetylsalicylic acid",
}
OTC_CAT = [
    "vitamin","multivitamin","multivit","mineral","supplement","omega","calcium","zinc","biotin",
    "selenium","probiotic","herbal","soap","shampoo","lotion","cream","ointment","lozenge",
    "sweetener","plaster","dressing","condom","diaper","napkin","mask","syring","syringe","cannula",
    "infusion set","oil","cod liver","liver oil","honey","boric acid","glycerin","sodium bicarbonate",
    "hydrogen peroxide","spirit","clove","whitfield","salicylic acid","ketoconazole","miconazole",
    "clotrimazole","permethrin","benzyl benzoate","sunscreen","face wash","cleanser","deodorant",
    "sanitizer","mouth wash","massage","expectorant","antitussive","cough","folic acid","ferrous",
    "iron","ascorbic","glucosamine","dextrose","normal saline","saline","paraffin","charcoal",
    "antacid","anti acid","anti-flatulent","flatulent","anti gas","distilled water","water for inj",
    "disinfectant","antiseptic","olive oil","castor oil","arachis oil","nasal","anti diarrhea",
    "rehydration","sodium chloride","cimetidine","lactulose","bisacodyl","simeticone","simethicone",
]
RX_CAT = [
    "amoxicillin","clavulanate","clavulanic","ampicillin","cloxacillin","cephalexin","cefixime",
    "cefpodoxime","cefotaxime","ceftriaxone","ceftazidime","cefuroxime","cefepime","meropenem",
    "azithromycin","clarithromycin","erythromycin","doxycycline","ciprofloxacin","levofloxacin",
    "norfloxacin","moxifloxacin","metronidazole","linezolid","tobramycin","amlodipine","lisinopril",
    "losartan","valsartan","candesartan","bisoprolol","propranolol","metoprolol","carvedilol",
    "ramipril","enalapril","captopril","hydrochlorothiazide","furosemide","torsemide",
    "spironolactone","nifedipine","diltiazem","verapamil","irbesartan","telmisartan","atorvastatin",
    "rosuvastatin","simvastatin","fenofibrate","ezetimibe","metformin","glimepiride","gliclazide",
    "sitagliptin","vildagliptin","empagliflozin","dapagliflozin","insulin","pioglitazone","acarbose",
    "repaglinide","carbamazepine","valproate","valproic","levetiracetam","lamotrigine","phenytoin",
    "gabapentin","pregabalin","clonazepam","diazepam","lorazepam","sertraline","fluoxetine",
    "escitalopram","citalopram","paroxetine","venlafaxine","duloxetine","quetiapine","olanzapine",
    "risperidone","aripiprazole","clozapine","warfarin","rivaroxaban","apixaban","dabigatran",
    "clopidogrel","diclofenac","ibuprofen","naproxen","meloxicam","celecoxib","etoricoxib",
    "indomethacin","ketoprofen","mefenamic","piroxicam","omeprazole","esomeprazole","pantoprazole",
    "lansoprazole","rabeprazole","famotidine","ranitidine","domperidone","metoclopramide",
    "ondansetron","loperamide","salbutamol","formoterol","budesonide","fluticasone",
    "beclomethasone","montelukast","levothyroxine","carbimazole","prednisolone","prednisone",
    "dexamethasone","methylprednisolone","hydrocortisone","betamethasone","mometasone","clobetasol",
    "fluocinolone","triamcinolone","allopurinol","febuxostat","colchicine","tadalafil","sildenafil",
    "tamsulosin","finasteride","solifenacin","oxybutynin","mirabegron","betahistine","isotretinoin",
    "tretinoin","adapalene","clindamycin","benzoyl peroxide","fusidic","mupirocin",
    "silver sulphadiazine","mebendazole","albendazole","ivermectin","artemether","lumefantrine",
    "artesunate","chloroquine","hydroxychloroquine","alendronate","levodopa","carbidopa",
    "mebeverine","hyoscine","butylscopolamine","tiemonium","drotaverine","tranexamic",
    "norethisterone","levonorgestrel","medroxyprogesterone","clomifene","clomiphene","letrozole",
    "tamoxifen","tramadol","codeine","morphine","fentanyl","amiodarone","digoxin","isosorbide",
    "methotrexate","azathioprine","cyclosporine","tacrolimus","mycophenolate","sulfasalazine",
    "aciclovir","valaciclovir","ganciclovir","oseltamivir","lamivudine","tenofovir","amphotericin",
    "fluconazole","itraconazole","voriconazole","nystatin","terbinafine","isoniazid","rifampicin",
    "pyrazinamide","ethambutol","thyroxine","propylthiouracil","latanoprost","travoprost","timolol",
    "dorzolamide","brimonidine","acetazolamide","cyclopentolate","nepafenac","tizanidine",
    "baclofen","methocarbamol","orphenadrine","ambroxol","bromhexine","acetylcysteine",
    "carbocisteine","dextromethorphan","guaifenesin","cetirizine","levocetirizine","loratadine",
    "desloratadine","fexofenadine","chlorpheniramine","chlorphenamine","promethazine",
    "diphenhydramine","hydroxyzine","ketotifen","paracetamol","acetaminophen","phenylephrine",
    "pseudoephedrine","nimesulide","secnidazole","ketorolac","diphenoxylate","cinnarizine",
    "flunarizine","prochlorperazine","granisetron","dicyclomine","lithium","topiramate","zonisamide",
    "amitriptyline","nortriptyline","imipramine","donepezil","memantine","rivastigmine",
]

def detect_form(s):
    s = s.lower()
    for pat, norm in FORM_RE:
        if re.search(pat, s):
            return norm
    return None

def strip_mfr(item):
    for m in sorted(MFR_WORDS, key=len, reverse=True):
        pat = re.compile(r"\s+" + re.escape(m) + r"\s*$", re.IGNORECASE)
        item2 = pat.sub("", item)
        if item2 != item:
            return item2.strip(), m
    return item.strip(), None

def fix(s):
    s2 = " ".join(s.lower().split())
    s2 = re.sub(r"\b(\d+)(mg|mcg|g|ml)\b", r"\1 \2", s2)
    for k, v in FIX.items():
        s2 = re.sub(r"\b" + re.escape(k) + r"\b", v, s2, flags=re.IGNORECASE)
    return s2.strip()

def classify(canon, brand):
    text = (canon + " " + (brand or "")).lower()
    for o in OTC_CAT:
        if o in text:
            return "otc"
    for rx in RX_CAT:
        if rx in text:
            return "prescription"
    return "unknown"

def esc(s):
    if s is None:
        return "NULL"
    return "'" + s.replace("'", "''") + "'"

ARABIC = re.compile(r"[\u0600-\u06FF]+")
TRAILING = ["tablet","tablets","tab","tabs","capsule","capsules","cap","caps","syrup","syrups",
    "suspension","susp","injection","inj","ampoule","amp","cream","ointment","oint","gel","drops",
    "drop","lotion","soap","shampoo","sachet","powder","suppository","supp","vial","vials","spray",
    "inhaler","solution","effervescent","eff","lozenge","lozenges","plaster","dressing","infusion",
    "drip","foam","wash","tonic","oil","device"]

# ---- extract tables ----
rows = []
with pdfplumber.open(src) as pdf:
    for i, page in enumerate(pdf.pages):
        for t in page.extract_tables():
            for row in t:
                cells = [(c or "").strip().replace("\n", " ") for c in row]
                if any(cells):
                    rows.append(cells)

# ---- parse raw ----
raw = []
for cells in rows:
    n = len(cells)
    if n == 5:
        item, desc, unit, price = cells[0], cells[1], cells[2], cells[3]
    elif n == 7:
        item, desc, unit, price = cells[0], cells[2], cells[4], cells[5]
    else:
        continue
    item, desc = (item or "").strip(), (desc or "").strip()
    if not item or item.upper() in HEADERS or not desc:
        continue
    raw.append({"item": item, "desc": desc, "unit": (unit or "").strip(), "price": (price or "").strip()})

# ---- normalize ----
products = []
for r in raw:
    item, desc = r["item"], r["desc"]
    m = STRENGTH_RE.search(desc)
    strength = None
    if m:
        strength = f"{m.group(1)} {m.group(2).lower()}"
        if m.group(3):
            strength += f"/{m.group(3)} ml"
    form = detect_form(desc) or detect_form(item)
    canon = STRENGTH_RE.sub(" ", desc)
    canon = re.sub(r"\b(?:coated|film)\b", "", canon, flags=re.IGNORECASE)
    canon = re.sub(r"\s*\([^)]*\)", "", canon)
    canon = re.sub(r"[،,؛;]", " ", canon)
    canon = re.sub(r"\s+", " ", canon).strip(" -/")
    brand, mfr = strip_mfr(item)
    brand = re.sub(r"\s*\([^)]*\)", "", brand)
    if strength:
        brand = re.sub(re.escape(strength), " ", brand, flags=re.IGNORECASE)
    brand = re.sub(r"\s+", " ", brand).strip(" -/")
    f = detect_form(canon)
    if f:
        canon = re.sub(re.escape(f), "", canon, flags=re.IGNORECASE).strip(" -/")
    if not canon or canon.lower() in ("desc", "anti", "for"):
        canon = brand
    # cleanup
    for _ in range(3):
        for t in TRAILING:
            pat = re.compile(r"\s+" + re.escape(t) + r"\s*$", re.IGNORECASE)
            s2 = pat.sub("", canon)
            if s2 != canon:
                canon = s2.strip(" -/")
    if not re.search(r"[A-Za-z]", canon):
        canon = brand
    canon = ARABIC.sub(" ", canon)
    canon = re.sub(r"\s+", " ", canon).strip(" -/")
    if not re.search(r"[A-Za-z]", canon):
        continue
    canon = fix(canon)
    canon = re.sub(r"\s+", " ", canon).strip(" -/")
    if not canon:
        continue
    brand = (brand or "").strip() or None
    cls = classify(canon, brand)
    products.append((canon, brand, strength, form, cls))

seen = set()
uniq = []
for p in products:
    k = (p[0].lower(), (p[1] or "").lower(), (p[2] or "").lower(), (p[3] or "").lower())
    if k in seen:
        continue
    seen.add(k)
    uniq.append(p)

lines = ["-- Shifa product catalog import",
         "insert into public.products (canonical_name, brand_name, strength, dosage_form, prescription_classification, is_demo, verification_status) values"]
vals = [f"  ({esc(c)}, {esc(b)}, {esc(s)}, {esc(f)}, {esc(cl)}, false, 'verified')" for (c, b, s, f, cl) in uniq]
lines.append(",\n".join(vals) + ";")
open(out, "w", encoding="utf-8").write("\n".join(lines))

from collections import Counter
print("products:", len(uniq))
print("class:", dict(Counter(p[4] for p in uniq)))
print("SQL ->", out)
