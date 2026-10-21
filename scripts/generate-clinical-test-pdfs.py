"""Create ten clearly synthetic PDF fixtures and verify their rendered output."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import textwrap
import zipfile

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageOps, ImageDraw
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
UNIVERSAL = '--universal' in sys.argv
OUT = ROOT / ('output/pdf/GovCare_Clinical_PDF_Universal_Test_Pack_10' if UNIVERSAL else 'output/pdf/GovCare_Clinical_PDF_Test_Pack_10')
TMP = ROOT / ('tmp/pdfs/clinical-universal-test-pack-10' if UNIVERSAL else 'tmp/pdfs/clinical-test-pack-10')
POPPLER = Path(os.environ['USERPROFILE']) / '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin'
W, H = A4
TEAL, INK, MUTED = '#007B69', '#173B35', '#50645F'

NUMERIC = [
    ('BMI', '27.4', 'kg/m2'),
    ('Systolic Blood Pressure', '146', 'mmHg'),
    ('Diastolic Blood Pressure', '92', 'mmHg'),
    ('Fasting Blood Sugar', '126', 'mg/dL'),
    ('HbA1c', '7.2', '%'),
    ('Serum Creatinine', '1.40', 'mg/dL'),
    ('Blood Urea Nitrogen', '26', 'mg/dL'),
    ('eGFR', '54', 'mL/min/1.73 m2'),
    ('Protein in Urine', '30', 'mg/dL'),
    ('Urine ACR', '42', 'mg/g'),
    ('Serum Potassium', '4.6', 'mmol/L'),
    ('Hemoglobin', '12.8', 'g/dL'),
]
BASE_EXPECTED = dict(zip(
    ['BMI', 'SystolicBP', 'DiastolicBP', 'FastingBloodSugar', 'HbA1c', 'SerumCreatinine', 'BUNLevels', 'GFR', 'ProteinInUrine', 'ACR', 'SerumElectrolytesPotassium', 'HemoglobinLevels'],
    [27.4, 146, 92, 126, 7.2, 1.4, 26, 54, 30, 42, 4.6, 12.8]))

CASES = [
    dict(file='01_comprehensive_numeric_report.pdf', title='Comprehensive numeric report',
         tag='01 / BASELINE', rows=NUMERIC, expected=BASE_EXPECTED,
         collection='2026-10-20T08:30:00+05:30', history=True,
         note='Positive extraction test. Twelve supported numeric inputs are printed. Age comes from the EHR; clinical history requires manual verification. This is a synthetic software fixture.'),
    dict(file='02_partial_renal_panel.pdf', title='Partial renal panel', tag='02 / PARTIAL INPUTS',
         rows=[('Serum Creatinine', '1.15', 'mg/dL'), ('eGFR', '73', 'mL/min/1.73 m2'), ('Blood Urea Nitrogen', '19', 'mg/dL'), ('Serum Potassium', '4.2', 'mmol/L'), ('Urine ACR', '16', 'mg/g')],
         expected={'SerumCreatinine':1.15,'GFR':73,'BUNLevels':19,'SerumElectrolytesPotassium':4.2,'ACR':16},
         report_date='2026-10-19', collection='2026-10-19T09:15:00+05:30',
         note='Partial-data test. Every measurement not printed in this panel must remain missing. Do not fill missing history with No or replace existing manual values during a read.'),
    dict(file='03_alternative_units_conversion.pdf', title='Alternative units', tag='03 / UNIT CONVERSION',
         rows=[('Serum Creatinine','159.12','umol/L'),('Hemoglobin','130','g/L'),('Fasting Blood Sugar','6.5','mmol/L'),('HbA1c','53','mmol/mol'),('Blood Urea Nitrogen','8','mmol/L'),('Urine ACR','5','mg/mmol'),('Protein in Urine','0.25','g/L'),('Serum Potassium','4.6','mEq/L')],
         expected={'SerumCreatinine':1.8,'HemoglobinLevels':13,'FastingBloodSugar':117.118,'HbA1c':6.998,'BUNLevels':22.408,'ACR':44.2,'ProteinInUrine':25,'SerumElectrolytesPotassium':4.6},
         note='Conversion test. Preserve the printed original values and units alongside normalized values. Collection time is deliberately absent and must not be invented.'),
    dict(file='04_same_time_conflicting_results.pdf', title='Competing source results', tag='04 / CONFLICT REVIEW',
         rows=[('Serum Creatinine','2.10','mg/dL'),('eGFR','36','mL/min/1.73 m2'),('Urine ACR','110','mg/g'),('HbA1c','8.1','%'),('Serum Potassium','5.1','mmol/L')],
         expected={'SerumCreatinine':2.1,'GFR':36,'ACR':110,'HbA1c':8.1,'SerumElectrolytesPotassium':5.1},
         collection='2026-10-20T08:30:00+05:30',
         note='Competing-source test. The recorded collection time is identical to case 01. These differing values require explicit source selection; do not silently select the last file or treat them as a chronological trend.'),
    dict(file='05_unsupported_parameters_only.pdf', title='Unsupported laboratory panel', tag='05 / NO SUPPORTED INPUTS',
         rows=[('C-Reactive Protein','8.2','mg/L'),('ALT','31','U/L'),('Platelet Count','255','10^9/L')], expected={},
         note='Unsupported-parameter test. None of the printed parameters is a configured CKD assessment input. Preserve unsupported results for review; the assessment form must remain unchanged.'),
    dict(file='06_image_only_scanned_report.pdf', title='Image-only renal report', tag='06 / SCAN - OCR REQUIRED',
         rows=[('Serum Creatinine','1.62','mg/dL'),('eGFR','47','mL/min/1.73 m2'),('Hemoglobin','11.9','g/dL')], expected={}, scanned=True,
         note='Image-only scan test. This page is intentionally rasterized with no searchable text. Without configured OCR, return OCR_REQUIRED and leave the clinical form unchanged.'),
    dict(file='07_patient_mismatch_block.pdf', title='Patient identity mismatch', tag='07 / WRONG PATIENT',
         patient='TEST-PAT-999', name='OTHER TEST PATIENT', dob='1980-05-15',
         rows=[('Serum Creatinine','1.35','mg/dL'),('eGFR','58','mL/min/1.73 m2'),('Urine ACR','38','mg/g')], expected={}, mismatch=True,
         note='Intentional identity mismatch. When TEST-PAT-001 is selected in the EHR, this report must be blocked from association and autofill, even after a confirmation checkbox is selected.'),
    dict(file='08_qualified_invalid_and_missing_units.pdf', title='Values requiring manual review', tag='08 / VALIDATION GUARDS',
         rows=[('Serum Creatinine','1.50','Not stated'),('eGFR','>=60','mL/min/1.73 m2'),('Blood Urea Nitrogen','-5','mg/dL'),('Serum Potassium','25','mmol/L'),('HbA1c','7.4','%')], expected={'HbA1c':7.4},
         note='Guardrail test. Only the percentage result is suitable for normalization. A missing unit, a qualified result, a negative measurement and an out-of-range measurement require manual review; none should become an exact model input.'),
    dict(file='09_exact_duplicate_of_01.pdf', duplicate_of='01_comprehensive_numeric_report.pdf', expected=BASE_EXPECTED, collection='2026-10-20T08:30:00+05:30'),
    dict(file='10_reviewed_correction_version_2.pdf', title='Reviewed source correction', tag='10 / SOURCE VERSION 2',
         rows=[(label, '1.32' if label=='Serum Creatinine' else '59' if label=='eGFR' else value, unit) for label,value,unit in NUMERIC],
         expected={**BASE_EXPECTED,'SerumCreatinine':1.32,'GFR':59}, history=True,
         collection='2026-10-20T08:30:00+05:30',
         note='Software-fixture correction of GC-QA-01. Reason: synthetic transcription correction of two renal results. Select case 01 as the previous saved source and enter a review reason. Keep version 1 and its original values. This is not clinical verification.'),
]

if UNIVERSAL:
    CASES[6] = dict(
        file='07_identity_free_review.pdf', title='Identity-free source for review',
        tag='07 / IDENTITY CONFIRMATION', rows=CASES[6]['rows'],
        expected={'SerumCreatinine': 1.35, 'GFR': 58, 'ACR': 38},
        note='Identity confirmation test. No patient identity is printed. Preview three numeric values for any selected software test patient, then explicitly confirm the source before applying values. These invented results do not verify that patient\'s clinical condition.')

def text(c,x,y,value,size=10,bold=False,color=INK):
    c.setFillColor(HexColor(color)); c.setFont('Helvetica-Bold' if bold else 'Helvetica',size); c.drawString(x,y,str(value))

def paragraph(c,value,x,y,width=96,size=9,color=MUTED):
    for line in textwrap.wrap(value,width=width):
        text(c,x,y,line,size,color=color); y-=13
    return y

def report(path,case,index):
    c=canvas.Canvas(str(path),pagesize=A4,invariant=1,pageCompression=1)
    c.setTitle(f'SYNTHETIC SOFTWARE QA - {case["title"]}')
    c.setAuthor('GovCare Software QA - fictional test laboratory')
    c.setSubject('Synthetic PDF importer fixture. Not a patient record or a verified laboratory report.')
    c.setFillColor(HexColor('#FFFFFF'));c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(HexColor('#FFF1D6'));c.roundRect(36,H-57,W-72,25,5,fill=1,stroke=0)
    text(c,48,H-48,'SYNTHETIC SOFTWARE TEST - NOT FOR CLINICAL USE',9,True,'#8B4200')
    text(c,36,H-85,'GovCare | Fictional QA Laboratory',16,True,TEAL)
    c.setFont('Helvetica-Bold',8);c.setFillColor(HexColor(MUTED));c.drawRightString(W-36,H-83,case['tag'])
    text(c,36,H-117,case['title'],20,True)
    text(c,36,H-134,'Clinical PDF import validation | '+('Patient-neutral, invented measurements' if UNIVERSAL else 'All identities and measurements are invented'),8.5,color=MUTED)
    y=H-210
    c.setFillColor(HexColor('#F0F6F3'));c.roundRect(36,y-24,W-72,84,8,fill=1,stroke=0)
    if UNIVERSAL:
        text(c,48,y+43,'Fixture: Patient-neutral sample',10,True)
        text(c,48,y+25,'Identity: Not included',10)
        text(c,48,y+7,'Demographics: Selected in EHR',9,color=MUTED)
    else:
        text(c,48,y+43,'Patient: '+case.get('name','TEST PATIENT'),10,True)
        text(c,48,y+25,'Patient ID: '+case.get('patient','TEST-PAT-001'),10)
        text(c,48,y+7,'Date of Birth: '+case.get('dob','1970-01-01'),9,color=MUTED)
    text(c,315,y+43,f'Report ID: GC-QA-{index:02d}',9,True)
    text(c,315,y+25,'Report Date: '+case.get('report_date','2026-10-20'),9)
    text(c,315,y+7,'Collection: '+case.get('collection','Not recorded'),7.8,color=MUTED)
    text(c,36,y-51,'PRINTED SOURCE MEASUREMENTS',10,True,TEAL)
    top=y-67; row_h=24; xs=[48,323,408]
    c.setFillColor(HexColor(TEAL));c.roundRect(36,top-27,W-72,27,4,fill=1,stroke=0)
    for x,label in zip(xs,['Parameter','Result','Printed unit']): text(c,x,top-18,label,9,True,'#FFFFFF')
    y=top-27
    for n,(label,value,unit) in enumerate(case['rows']):
        if n%2==0:c.setFillColor(HexColor('#F1F7F4'));c.rect(36,y-row_h,W-72,row_h,fill=1,stroke=0)
        text(c,xs[0],y-16,label,9.3);text(c,xs[1],y-16,value,10,True);text(c,xs[2],y-16,unit,8.8)
        c.setStrokeColor(HexColor('#DCE8E2'));c.line(36,y-row_h,W-36,y-row_h);y-=row_h
    y-=27
    text(c,36,y,'CLINICAL HISTORY - MANUAL VERIFICATION',9,True,TEAL);y-=19
    if case.get('history'):
        for left,right in [('Edema: No','Family history of kidney disease: Yes'),('Previous acute kidney injury: No','NSAID use: No')]:
            text(c,36,y,left,8.7);text(c,290,y,right,8.7);y-=17
        text(c,36,y-2,'Age is calculated from the selected EHR patient, not imported from this page.',8,color=MUTED)
    else:
        paragraph(c,'History was not supplied in this report. Missing fields remain unknown and require manual completion.',36,y,98,8.5)
    c.setFillColor(HexColor('#F4F7F6'));c.roundRect(36,83,W-72,81,7,fill=1,stroke=0)
    text(c,48,147,'SOFTWARE TEST PURPOSE',9,True,TEAL)
    paragraph(c,case['note'],48,130,95,8.5)
    c.setStrokeColor(HexColor('#BBD3C9'));c.line(36,64,W-36,64)
    text(c,36,48,'Fictional QA laboratory | No clinical verification, signature or medical interpretation',8,color=MUTED)
    text(c,36,34,'Synthetic software fixture only. Never use for diagnosis, treatment or patient care.',8,True,'#8B4200')
    c.setFont('Helvetica',8);c.drawRightString(W-36,34,'Page 1 of 1')
    c.showPage();c.save()

def main():
    OUT.mkdir(parents=True,exist_ok=True);TMP.mkdir(parents=True,exist_ok=True)
    expected=[]
    for index,case in enumerate(CASES,1):
        final=OUT/case['file']
        if case.get('duplicate_of'):
            shutil.copyfile(OUT/case['duplicate_of'],final)
        elif case.get('scanned'):
            source=TMP/'06_searchable_source.pdf';report(source,case,index)
            prefix=TMP/'06_scan_source'
            subprocess.run([str(POPPLER/'pdftoppm.exe'),'-r','160','-singlefile','-png',str(source),str(prefix)],check=True,capture_output=True)
            c=canvas.Canvas(str(final),pagesize=A4,invariant=1,pageCompression=1)
            c.setTitle('SYNTHETIC SOFTWARE QA - image-only scan');c.setAuthor('GovCare Software QA')
            c.drawImage(str(prefix)+'.png',0,0,width=W,height=H);c.showPage();c.save()
        else:report(final,case,index)
        reader=PdfReader(final);raw='\n'.join(page.extract_text() or '' for page in reader.pages)
        if case.get('scanned'):assert not raw.strip(),'Scanned fixture must not contain an embedded text layer'
        else:assert 'SYNTHETIC SOFTWARE TEST' in raw and 'NOT FOR CLINICAL USE' in raw
        if UNIVERSAL:
            assert not re.search(r'(?im)^\s*(?:patient(?:\s*(?:id|name|number|no\.?))?|nic|date of birth)\s*[:=]', raw), 'Patient identity must be absent'
            assert 'TEST-PAT-' not in raw and 'TEST PATIENT' not in raw
        assert len(reader.pages)==1
        preview=TMP/f'{index:02d}'
        subprocess.run([str(POPPLER/'pdftoppm.exe'),'-r','85','-singlefile','-png',str(final),str(preview)],check=True,capture_output=True)
        expected.append({'file':case['file'],'sha256':hashlib.sha256(final.read_bytes()).hexdigest(),'bytes':final.stat().st_size,'pages':1,'embeddedText':not case.get('scanned',False),'patientId':case.get('patient','TEST-PAT-001'),'patientName':case.get('name','TEST PATIENT'),'expectedStatus':'OCR_REQUIRED' if case.get('scanned') else 'PATIENT_MISMATCH' if case.get('mismatch') else 'NO_SUPPORTED_MEASUREMENTS' if not case['expected'] else 'PARTIAL' if index==8 else 'COMPLETED','expectedNormalizedValues':case['expected'],'expectedDetectedCount':len(case['expected']),'duplicateOf':case.get('duplicate_of'),'requiresExplicitSaveForDuplicateFlag':bool(case.get('duplicate_of')),'specimenCollectionTime':case.get('collection') if not case.get('scanned') else None})
    assert expected[0]['sha256']==expected[8]['sha256']
    assert expected[0]['sha256']!=expected[9]['sha256']
    assert len(list(OUT.glob('*.pdf')))==10
    if UNIVERSAL:
        for item in expected:
            item['patientId'] = None
            item['patientName'] = None
            item['expectedIdentityStatus'] = 'UNVERIFIED'
    scope = ('Patient-neutral synthetic software fixtures; any authorized selected test patient; explicit source confirmation required' if UNIVERSAL else 'Synthetic software test fixtures only; selected EHR patient TEST-PAT-001 / TEST PATIENT')
    (OUT/'expected_results.json').write_text(json.dumps({'scope':scope,'cases':expected},indent=2),encoding='utf-8')
    guide='''GovCare Clinical PDF Test Pack - 10 synthetic PDF files

SOFTWARE TESTING ONLY. All patients, laboratory identities and measurements are invented.
Do not associate these documents with real patients or use them for medical decisions.

SETUP
Select the authorized synthetic EHR patient with patient number TEST-PAT-001 and exact name TEST PATIENT.
For the suggested full-assessment case, its synthetic date of birth is 1970-01-01.
The separate mismatch file uses TEST-PAT-999 / OTHER TEST PATIENT deliberately.
No real NIC, telephone number, email address, signature or external laboratory identity is used.

FILES AND EXPECTED RESULTS
01: Twelve supported numeric fields. Four clinical-history answers are printed for manual verification.
02: Five renal measurements; all other values remain missing.
03: Eight alternative-unit measurements. Original and normalized values must remain visible.
04: Five competing results with the exact same collection time as 01. Require explicit source review.
05: CRP, ALT and platelets only. Expected: no supported CKD measurements.
06: Image-only PDF, with NO embedded text layer. Expected: OCR_REQUIRED without configured OCR.
07: Wrong patient. Expected: PATIENT_MISMATCH with no applied values or saved association.
08: Four rejected values (missing unit, qualification, negative value, out-of-range value) plus one valid percentage.
09: A byte-for-byte duplicate of 01 under a different filename. Its visible report content is intentionally identical.
10: Corrected source for 01, with two changed renal results. Expected: reviewed revision, with history retained.

RECOMMENDED WORKFLOW
1. Read 01. Preview alone must not save a clinical report, observations, FHIR Observations or a prediction.
2. Confirm the synthetic identity and explicitly save 01 once. Read 01 and 09 repeatedly. Both must reuse the same saved report reference.
   The duplicate flag refers to already SAVED content: merely reading two identical files need not mark either as saved.
3. Read 01-05 together. Preview all results before approving fields. Do not silently select the last file's value.
4. Manually edit one approved value twice, then re-read. Preserve the manual override and original PDF value.
5. Read 06, 07 and 08 with a valid source. An OCR requirement, identity mismatch or rejected field must not discard healthy results.
6. Apply only approved values. Missing model inputs remain editable and mandatory. Unknown history must not become No.
7. Use 01 for a full synthetic assessment: approve its twelve numeric results, obtain age from the EHR, and manually verify the four printed history answers.
8. Save 10 as a reviewed correction linked to the previously saved 01, with reason "Synthetic transcription correction".
   Preserve version 1 and its measurements. Repeating this save must reuse version 2.
9. To test different content sharing a filename, copy 10 to a separate folder and rename that copy to the filename of 01.
   Its different SHA-256 must prevent a false duplicate classification based on filename.
10. Save a partial draft, reload, and restore. Values and source/manual-override provenance must survive.

DATA AND DATES
The report date is not the collection time. Missing collection times are deliberate.
Successful parsing and identity confirmation do not verify laboratory measurements.
The machine-readable expected_results.json lists exact normalized values, file hashes and test statuses.
Case 09 has the same hash as 01; 10 has a different hash. None of these files is a signed clinical report.
'''
    if UNIVERSAL:
        guide = '''GovCare Universal Clinical PDF Test Pack - 10 patient-neutral synthetic PDFs

SOFTWARE TESTING ONLY. All measurements and laboratory branding are invented.
These files contain no patient name, patient number, NIC or date of birth.
They can be previewed with any authorized selected patient without a printed-identity mismatch.
Use synthetic test patients when testing saves or assessments; these are not actual patient results.
The original fixed-identity pack is unchanged. Use the PDFs in THIS new pack.

HOW TO USE
1. Select an authorized patient in GovCare, then browse or drop these PDFs into Upload clinical reports.
2. Added files are read automatically. Preview extracted values; reading alone does not apply or save them.
3. With no printed identity, identity status is UNVERIFIED. Explicitly confirm the selected source and
   approve values before applying them. Patient authorization and genuine mismatch protections remain active.
4. Age comes from the selected EHR patient. Manually verify all required history fields and review units.
5. Explicit saving, duplicate detection and corrected versions should be tested on synthetic patients only.
   Previewing identical files alone does not make them already-saved duplicates.

FILES AND EXPECTED RESULTS
01: Twelve supported numeric fields; four history answers for manual verification.
02: Five renal measurements; unprinted inputs stay missing.
03: Eight measurements in alternative units; check normalized values and preserved originals.
04: Five competing results at the same collection time as 01; choose the source explicitly.
05: Unsupported parameters only; NO_SUPPORTED_MEASUREMENTS and no form changes are expected.
06: Image-only scan with no embedded text; OCR_REQUIRED is expected without configured OCR.
07: Identity-free source with three renal values; explicit identity confirmation is still required.
08: One valid percentage plus four rejected values; PARTIAL status and manual review are expected.
09: Exact byte-for-byte duplicate of 01. Duplicate reuse is scoped to the selected patient and saved content.
10: Corrected version of 01 with two changed renal values; preserve prior source history when saving a revision.

READING IS NOT CLINICAL VERIFICATION
An OCR-required, unsupported or rejected-value case is an intentional negative test, not a broken upload.
None of these PDFs guarantees a complete assessment: missing inputs remain editable and required.
Report dates are synthetic. Only explicit collection timestamps may be used as specimen dates.
expected_results.json lists normalized values, statuses, identity expectations and SHA-256 fingerprints.
SHA256SUMS.txt verifies the files. Case 09 equals 01; case 10 has a different fingerprint.
'''
    (OUT/'README.txt').write_text(guide,encoding='utf-8')
    (OUT/'SHA256SUMS.txt').write_text(''.join(f"{row['sha256']}  {row['file']}\n" for row in expected),encoding='utf-8')
    # Contact sheet is a QA preview, not an additional PDF deliverable.
    sheet=Image.new('RGB',(1200,5*450),'#EAF1ED');draw=ImageDraw.Draw(sheet)
    for i,row in enumerate(expected):
        img=Image.open(TMP/f'{i+1:02d}.png').convert('RGB');img.thumbnail((570,408))
        x=(i%2)*600+(600-img.width)//2;y=(i//2)*450+30
        sheet.paste(img,(x,y));draw.text(((i%2)*600+16,(i//2)*450+8),row['file'],fill='#173B35')
    sheet.save(OUT/'preview.png')
    print(json.dumps({'directory':str(OUT),'pdfCount':10,'scannedTextLayer':'absent as intended','duplicateHashVerified':True,'renderedPages':10}))

if __name__=='__main__':main()
