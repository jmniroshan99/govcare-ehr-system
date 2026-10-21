"""Reproducible synthetic clinical fixtures served by the authorized test library."""
from pathlib import Path
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw, ImageFont
import shutil, json

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'spring-api/src/main/resources/clinical-test-documents'
OUT=ROOT/'output/pdf/GovCare_Clinical_Test_Library'
PANELS={
'comprehensive':('Comprehensive CKD laboratory report',[
 'Collection: 2026-10-20T08:30:00+05:30','BMI 27.4 kg/m2','Systolic BP 146 mmHg','Diastolic BP 92 mmHg','Fasting Blood Sugar 126 mg/dL','HbA1c 7.2 %','Serum Creatinine 1.4 mg/dL','BUN 26 mg/dL','eGFR 54 mL/min/1.73 m2','Protein in Urine 30 mg/dL','Urine ACR 42 mg/g','Serum Potassium 4.6 mmol/L','Hemoglobin 12.8 g/dL']),
'renal':('Renal function report',['Collection: 2026-10-20T08:30:00+05:30','Serum Creatinine 124 umol/L','Blood Urea 8 mmol/L','eGFR 54 mL/min/1.73 m2','Serum Albumin 4 g/dL']),
'cbc':('Complete blood count',['Collection: 2026-10-20T08:30:00+05:30','Hemoglobin 10.8 g/dL','PCV 32 %','RBC 3.9 10^12/L','WBC 6.5 10^9/L','Platelets 180 10^9/L']),
'electrolytes':('Electrolyte report',['Collection: 2026-10-20T08:30:00+05:30','Serum Potassium 5.2 mmol/L','Sodium 140 mmol/L','Calcium 9.2 mg/dL']),
'hemodialysis':('Hemodialysis session laboratory report',['Patient: Synthetic source identity','Patient ID: LIBRARY-SOURCE-ONLY','Pre-HD Urea 20 mmol/L','Post-HD Urea 7 mmol/L','Pre sample: 2026-10-20T08:30:00+05:30','Post sample: 2026-10-20T12:30:00+05:30','Session: SYNTHETIC-HD-01','Verify separate sampling times before confirming a session.']),
'urine-acr':('Urine albumin creatinine ratio',['Collection: 2026-10-20T08:30:00+05:30','Urine ACR 4.75 mg/mmol','Protein in Urine 30 mg/dL']),
'multipage':('Multi-page laboratory report',['Collection: 2026-10-20T08:30:00+05:30','Hemoglobin 10.8 g/dL','WBC 6.5 10^9/L','PAGE_BREAK','Serum Creatinine 3.4 mg/dL','Sodium 140 mmol/L','Serum Albumin 4 g/dL']),
'scanned':('Scanned laboratory report',['Hemoglobin 10.8 g/dL','Serum Creatinine 3.4 mg/dL','Serum Potassium 5.2 mmol/L','Collection date absent: verify it before saving.'])}

def header(c,title,page):
 c.setFillColorRGB(.035,.14,.25);c.setFont('Helvetica-Bold',19);c.drawString(40,790,'GOVCARE - CLINICAL TEST LIBRARY')
 c.setFillColorRGB(.0,.42,.4);c.setFont('Helvetica-Bold',13);c.drawString(40,759,title)
 c.setFillColorRGB(.65,.15,.15);c.setFont('Helvetica-Bold',10);c.drawString(40,732,'SYNTHETIC SOFTWARE TEST - NOT FOR PATIENT CARE')
 c.setFillColorRGB(.25,.3,.35);c.setFont('Helvetica',9);c.drawString(40,710,'Reusable fixture. No real patient identity. Confirm selected testing-patient association.')
 c.drawString(40,40,f'Clinical data are synthetic. Dates and units require explicit source review. | Page {page}')

def main():
 DEST.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
 for key,(title,lines) in PANELS.items():
  path=DEST/(key+'.pdf');c=canvas.Canvas(str(path),pagesize=A4,invariant=1);c.setTitle(title+' - SYNTHETIC TEST')
  if key=='scanned':
   image=Image.new('RGB',(1240,1754),'white');d=ImageDraw.Draw(image)
   font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',28);bold=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',32)
   d.text((65,65),'GOVCARE SYNTHETIC SCANNED TEST',fill='#112C47',font=bold)
   d.text((65,125),'NOT FOR PATIENT CARE - manual source review',fill='#A02828',font=font)
   for i,line in enumerate(lines):d.text((65,240+i*85),line,fill='#112C47',font=font)
   c.drawImage(ImageReader(image),0,0,width=A4[0],height=A4[1])
  else:
   page=1;header(c,title,page);y=669
   for line in lines:
    if line=='PAGE_BREAK':c.showPage();page+=1;header(c,title+' - continued',page);y=669;continue
    c.setFillColorRGB(.08,.16,.22);c.setFont('Helvetica',11);c.drawString(45,y,line);y-=28
  c.save();shutil.copyfile(path,OUT/path.name)
 (OUT/'README.txt').write_text('Eight synthetic fixtures for the authorized Clinical Test Document Library.\nUse only with designated synthetic patients; review values, units and actual fixture collection dates.\nScanned fixture has no text layer and no collection date; it must remain accepted for OCR/manual entry.\nHemodialysis values require explicit separate collection times and session verification.\n',encoding='utf-8')
 print(json.dumps({'fixtures':len(PANELS),'resourceDirectory':str(DEST),'artifactDirectory':str(OUT)}))
if __name__=='__main__':main()
