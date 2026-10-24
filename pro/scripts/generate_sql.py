import json, re

base = r"C:\Users\FKDMA\AppData\Local\hermes\cache\scratch"
final = json.load(open(base + r"\wefam-final.json", encoding="utf-8"))

FIX = {
    "amilodipine": "amlodipine", "glemipride": "glimepiride", "propanolol": "propranolol",
    "esmoprazole": "esomeprazole", "trtinoin": "tretinoin", "domperidne": "domperidone",
    "cefodoxime": "cefpodoxime", "metfomin": "metformin", "guaifnesin": "guaifenesin",
    "cefalixin": "cephalexin", "amocixillin": "amoxicillin", "valprote": "valproate",
    "lopramide": "loperamide", "methyprednisonlone": "methylprednisolone", "losertan": "losartan",
    "candestan": "candesartan", "ondansteron": "ondansetron",
    "mebeverine hcl": "mebeverine", "omeprazole s": "omeprazole", "cefotaxime for": "cefotaxime",
    "sitagliptin50": "sitagliptin", "metformin1": "metformin", "amoxicillin400mg": "amoxicillin",
    "clavul anate": "clavulanate", "paracetamol400mg": "paracetamol",
    "glimepride": "glimepiride", "gapapentin": "gabapentin", "norethisteron": "norethisterone",
    "clotrimazol": "clotrimazole", "metronidazol": "metronidazole",
    "acetylsalisalic": "acetylsalicylic", "benzyl penicillin": "penicillin",
    "lidocaine hcl": "lidocaine", "sodium fusidate": "fusidic acid", "sudium": "sodium",
    "aspirin": "acetylsalicylic acid", "amocixillin": "amoxicillin",
}

OTC_CAT = [
    "vitamin","multivitamin","multivit","mineral","supplement","omega","calcium","zinc",
    "biotin","selenium","probiotic","herbal","soap","shampoo","lotion","cream","ointment",
    "lozenge","sweetener","plaster","dressing","condom","diaper","napkin","mask","syring",
    "syringe","cannula","infusion set","oil","cod liver","liver oil","honey","boric acid",
    "glycerin","sodium bicarbonate","hydrogen peroxide","spirit","clove","whitfield",
    "salicylic acid","ketoconazole","miconazole","clotrimazole","permethrin","benzyl benzoate",
    "sunscreen","face wash","cleanser","deodorant","sanitizer","mouth wash","massage","expectorant",
    "antitussive","cough","folic acid","ferrous","iron","ascorbic","glucosamine","dextrose",
    "normal saline","saline","paraffin","charcoal","antacid","anti acid","anti-flatulent","flatulent",
    "anti gas","sweetener","distilled water","water for inj","disinfectant","antiseptic",
    "cod liver","olive oil","castor oil","arachis oil","nasal","anti diarrhea","rehydration",
    "sodium chloride","sodium bicarbonate","cimetidine","lactulose","bisacodyl","simeticone","simethicone",
]

RX_CAT = [
    "amoxicillin","clavulanate","clavulanic","ampicillin","cloxacillin","cephalexin","cefixime",
    "cefpodoxime","cefotaxime","ceftriaxone","ceftazidime","cefuroxime","cefepime","meropenem",
    "azithromycin","clarithromycin","erythromycin","doxycycline","ciprofloxacin","levofloxacin",
    "norfloxacin","moxifloxacin","metronidazole","linezolid","tobramycin","amlodipine","lisinopril",
    "losartan","valsartan","candesartan","bisoprolol","propranolol","metoprolol","carvedilol",
    "ramipril","enalapril","captopril","hydrochlorothiazide","furosemide","torsemide","spironolactone",
    "nifedipine","diltiazem","verapamil","irbesartan","telmisartan","atorvastatin","rosuvastatin",
    "simvastatin","fenofibrate","ezetimibe","metformin","glimepiride","gliclazide","sitagliptin",
    "vildagliptin","empagliflozin","dapagliflozin","insulin","pioglitazone","acarbose","repaglinide",
    "carbamazepine","valproate","valproic","levetiracetam","lamotrigine","phenytoin","gabapentin",
    "pregabalin","clonazepam","diazepam","lorazepam","sertraline","fluoxetine","escitalopram",
    "citalopram","paroxetine","venlafaxine","duloxetine","quetiapine","olanzapine","risperidone",
    "aripiprazole","clozapine","warfarin","rivaroxaban","apixaban","dabigatran","clopidogrel",
    "diclofenac","ibuprofen","naproxen","meloxicam","celecoxib","etoricoxib","indomethacin",
    "ketoprofen","mefenamic","piroxicam","omeprazole","esomeprazole","pantoprazole","lansoprazole",
    "rabeprazole","famotidine","ranitidine","domperidone","metoclopramide","ondansetron","loperamide",
    "salbutamol","formoterol","budesonide","fluticasone","beclomethasone","montelukast","levothyroxine",
    "carbimazole","prednisolone","prednisone","dexamethasone","methylprednisolone","hydrocortisone",
    "betamethasone","mometasone","clobetasol","fluocinolone","triamcinolone","allopurinol","febuxostat",
    "colchicine","tadalafil","sildenafil","tamsulosin","finasteride","solifenacin","oxybutynin",
    "mirabegron","betahistine","isotretinoin","tretinoin","adapalene","clindamycin","benzoyl peroxide",
    "fusidic","mupirocin","silver sulphadiazine","mebendazole","albendazole","ivermectin","artemether",
    "lumefantrine","artesunate","chloroquine","hydroxychloroquine","alendronate","levodopa","carbidopa",
    "mebeverine","hyoscine","butylscopolamine","tiemonium","drotaverine","tranexamic","norethisterone",
    "levonorgestrel","medroxyprogesterone","clomifene","clomiphene","letrozole","tamoxifen","tramadol",
    "codeine","morphine","fentanyl","amiodarone","digoxin","isosorbide","methotrexate","azathioprine",
    "cyclosporine","tacrolimus","mycophenolate","sulfasalazine","aciclovir","valaciclovir","ganciclovir",
    "oseltamivir","lamivudine","tenofovir","amphotericin","fluconazole","itraconazole","voriconazole",
    "nystatin","terbinafine","isoniazid","rifampicin","pyrazinamide","ethambutol","thyroxine",
    "propylthiouracil","latanoprost","travoprost","timolol","dorzolamide","brimonidine","acetazolamide",
    "cyclopentolate","nepafenac","tizanidine","baclofen","methocarbamol","orphenadrine","ambroxol",
    "bromhexine","acetylcysteine","carbocisteine","dextromethorphan","guaifenesin","cetirizine",
    "levocetirizine","loratadine","desloratadine","fexofenadine","chlorpheniramine","chlorphenamine",
    "promethazine","diphenhydramine","hydroxyzine","ketotifen","paracetamol","acetaminophen",
    "phenylephrine","pseudoephedrine","nimesulide","secnidazole","ketorolac","diphenoxylate",
    "cinnarizine","flunarizine","prochlorperazine","granisetron","dicyclomine","lithium","topiramate",
    "zonisamide","amitriptyline","nortriptyline","imipramine","donepezil","memantine","rivastigmine",
]

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

rows = []
for p in final:
    canon = fix(p["canonical_name"])
    canon = re.sub(r"\s+", " ", canon).strip(" -/")
    if not canon:
        continue
    brand = (p["brand_name"] or "").strip() or None
    if brand:
        brand = re.sub(r"\s+(?:TABUK -SUDAN|TABUK-SUDAN|TABUK|C D C|RAFEF|Azal|S M|B pharma|Scott Edil|Amipharma)\s*$", "", brand, flags=re.IGNORECASE).strip() or None
    strength = p["strength"]
    form = p["dosage_form"]
    cls = classify(canon, brand)
    rows.append((canon, brand, strength, form, cls))

seen = set()
uniq = []
for r in rows:
    k = (r[0].lower(), (r[1] or "").lower(), (r[2] or "").lower(), (r[3] or "").lower())
    if k in seen:
        continue
    seen.add(k)
    uniq.append(r)

lines = ["-- Shifa product catalog imported from Wefam price list (2026-10-13)",
         "insert into public.products (canonical_name, brand_name, strength, dosage_form, prescription_classification, is_demo, verification_status) values"]
vals = [f"  ({esc(c)}, {esc(b)}, {esc(s)}, {esc(f)}, {esc(cl)}, false, 'verified')" for (c, b, s, f, cl) in uniq]
lines.append(",\n".join(vals) + ";")
open(base + r"\wefam-insert.sql", "w", encoding="utf-8").write("\n".join(lines))

from collections import Counter
print("rows:", len(uniq))
print("class:", dict(Counter(r[4] for r in uniq)))
unk = [r for r in uniq if r[4] == "unknown"]
print("--- unknown sample ---")
for r in unk[:30]:
    print(f"  {r[0][:42]:42} | {r[1]} | {r[2]} | {r[3]}")
