package lk.gov.health.govcare.ai;

import lk.gov.health.govcare.documents.LocalPdfExtractionService;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.font.*;
import org.junit.jupiter.api.Test;
import java.io.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class ClinicalPdfPipelineTest {
 private byte[] pdf(String... lines)throws Exception{
  try(var document=new PDDocument();var out=new ByteArrayOutputStream()){
   var page=new PDPage();document.addPage(page);
   try(var content=new PDPageContentStream(document,page)){content.beginText();content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA),11);content.newLineAtOffset(40,740);for(String line:lines){content.showText(line);content.newLineAtOffset(0,-18);}content.endText();}
   document.save(out);return out.toByteArray();
  }
 }
 private Map<String,Object> extract(String... lines)throws Exception{return new ClinicalPdfExtractionService(new LocalPdfExtractionService()).extract(pdf(lines),"UPLOADED_PDF");}
 @Test void explicitAliasesAreReadUsingRealPdfBoxWithoutCrossMapping()throws Exception{
  var out=extract("SCr 1.4 mg/dL","Estimated GFR 54 mL/min/1.73 m2","UACR 5 mg/mmol","Hb 130 g/L","Glycated Hemoglobin 7.2 %","SBP 146 mmHg","Diastolic BP 92 mmHg","BUN 26 mg/dL","K+ 4.6 mmol/L","Body Mass Index 27.4 kg/m2");
  var values=(Map<String,Map<String,Object>>)out.get("extractedValues");assertEquals(10,values.size());
  assertEquals(1.4,((Number)values.get("SerumCreatinine").get("value")).doubleValue(),.001);assertEquals(44.2,((Number)values.get("ACR").get("value")).doubleValue(),.001);
  assertEquals(13,((Number)values.get("HemoglobinLevels").get("value")).doubleValue(),.001);assertEquals("MULTIPLY_BY_8.84",values.get("ACR").get("conversionMethod"));assertEquals(false,values.get("ACR").get("sourceVerified"));assertEquals(1,values.get("ACR").get("sourcePage"));
 }
 @Test void creatinineSerumVariantRetainsOriginalAndConversion()throws Exception{
  var out=extract("Creatinine, Serum 159.12 umol/L");var value=(Map<?,?>)((Map<?,?>)out.get("extractedValues")).get("SerumCreatinine");
  assertEquals(1.8,((Number)value.get("value")).doubleValue(),.001);assertEquals(159.12,((Number)value.get("originalValue")).doubleValue(),.001);assertEquals("DIVIDE_BY_88.4",value.get("conversionMethod"));
 }
 @Test void competingResultsWithinOnePdfNeverSilentlyChooseTheFirstOrLast()throws Exception{
  var out=extract("Serum Creatinine 1.4 mg/dL","Creatinine, Serum 2.1 mg/dL");
  assertEquals("PARTIAL",out.get("status"));assertTrue(((Map<?,?>)out.get("extractedValues")).isEmpty());assertEquals(1,((List<?>)out.get("conflicts")).size());assertEquals(2,((List<?>)((Map<?,?>)out.get("measurementCandidates")).get("SerumCreatinine")).size());
 }
 @Test void serumAlbuminBloodUreaAndUrineCreatinineAreNotWronglyMapped()throws Exception{
  var out=extract("Serum Albumin 42 g/L","Blood Urea 8 mmol/L","Urine Creatinine 1.4 mg/dL");assertEquals(2,out.get("detectedCount"));assertEquals(1,((List<?>)out.get("unrecognizedResults")).size());
  var values=(Map<?,?>)out.get("extractedValues");assertTrue(values.containsKey("SerumAlbumin"));assertTrue(values.containsKey("BloodUrea"));assertFalse(values.containsKey("ACR"));assertFalse(values.containsKey("BUNLevels"));assertFalse(values.containsKey("SerumCreatinine"));
 }
 @Test void historicalSectionAndPrefixDoNotBecomeCurrentMeasurements()throws Exception{
  var out=extract("Previous Serum Creatinine 3.2 mg/dL","Previous results:","Serum Creatinine 3.1 mg/dL","Current results:","Serum Creatinine 1.4 mg/dL");
  assertEquals(1,out.get("detectedCount"));assertEquals(2,((List<?>)out.get("unrecognizedResults")).size());
 }
 @Test void qualificationMissingUnitsAndReferenceTextCannotSupplyAnExactResult()throws Exception{
  var out=extract("eGFR >=60 mL/min/1.73 m2","Serum Creatinine 1.4","Hemoglobin pending Reference 12 g/dL");assertEquals(0,out.get("detectedCount"));
 }
 @Test void datedRowIsNotRelabeledWithTheReportsCurrentCollectionTime()throws Exception{
  var out=extract("Collection: 2026-10-20T08:30:00+05:30","Serum Creatinine 3.2 mg/dL 2025-01-01","SCr 1.4 mg/dL");
  assertEquals(1,out.get("detectedCount"));assertEquals(1,((List<?>)out.get("unrecognizedResults")).size());
 }
 @Test void unknownLaboratoryRowsArePreservedWithoutTreatingFootnotesAsMeasurements()throws Exception{
  var out=extract("SCr 1.4 mg/dL","TSH 3.2 mIU/L","renal results. Select case 01 as the previous saved source and enter a review reason. Keep","version 1 and its original values. This is not clinical verification.");
  var unknown=(List<Map<String,Object>>)out.get("unrecognizedResults");assertEquals(1,unknown.size());assertEquals("TSH 3.2 mIU/L",unknown.getFirst().get("text"));
 }
 @Test void multipleCollectionTimesAreNotInventedAsOneDate()throws Exception{
  var out=extract("Collection: 2026-10-20T08:30:00+05:30","Collection: 2026-10-19T08:30:00+05:30","SCr 1.4 mg/dL");
  assertFalse(((Map<?,?>)out.get("reportDates")).containsKey("specimenCollectionTime"));assertTrue(out.get("warnings").toString().contains("Multiple collection"));
 }
 @Test void scanWithoutConfiguredOcrReturnsOcrRequired()throws Exception{
  var out=new ClinicalPdfExtractionService(new LocalPdfExtractionService()).extract(pdf(),"UPLOADED_PDF");assertEquals("OCR_REQUIRED",out.get("status"));assertEquals(false,out.get("success"));assertEquals(0,out.get("detectedCount"));assertEquals("NOT_CONFIGURED",out.get("ocrStatus"));
 }
 @Test void ocrConfidenceIsPreservedAndLowConfidenceIsWithheld()throws Exception{
  var ocr=mock(ClinicalPdfOcrService.class);when(ocr.extract(any())).thenReturn(new ClinicalPdfOcrService.Result(List.of(new ClinicalPdfOcrService.Line("SCr 1.4 mg/dL",1,.98),new ClinicalPdfOcrService.Line("Hb 13 g/dL",1,.45)),"COMPLETED","OCR review required"));
  var out=new ClinicalPdfExtractionService(new LocalPdfExtractionService(),ocr).extract(pdf(),"UPLOADED_PDF");var values=(Map<String,Map<String,Object>>)out.get("extractedValues");assertEquals(1,values.size());assertEquals(.98,values.get("SerumCreatinine").get("confidence"));assertFalse(values.containsKey("HemoglobinLevels"));assertEquals("PARTIAL",out.get("status"));assertEquals(false,values.get("SerumCreatinine").get("sourceVerified"));
 }
 @Test void tsvUsesLowestWordConfidenceAndNeverTreatsStructuralRowsAsResults(){
  String tsv="level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t0\t0\t1\t1\t95\tSCr\n5\t1\t1\t1\t1\t2\t0\t0\t1\t1\t30\t1.4\n5\t1\t1\t1\t1\t3\t0\t0\t1\t1\t99\tmg/dL\n";
  var lines=ClinicalPdfOcrService.parseTsv(tsv,2);assertEquals(1,lines.size());assertEquals("SCr 1.4 mg/dL",lines.getFirst().text());assertEquals(.30,lines.getFirst().confidence());assertEquals(2,lines.getFirst().page());
 }
 @Test void conversionFactorsAndMeasurementTypesRemainExplicit(){
  assertEquals(1.0,ClinicalFeatureNormalizer.convert("creatinine",88.4,"\u00b5mol/L"),.0001);assertEquals(13.0,ClinicalFeatureNormalizer.convert("hemoglobin",130,"g/L"),.0001);assertEquals(44.2,ClinicalFeatureNormalizer.convert("acr",5,"mg/mmol"),.0001);assertEquals(4.6,ClinicalFeatureNormalizer.convert("potassium",4.6,"mmol/L"),.0001);
  assertNull(ClinicalFeatureNormalizer.convert("creatinine",1.4,""));assertNull(ClinicalFeatureNormalizer.convert("acr",42,"g/L"));
  assertNull(ClinicalFeatureNormalizer.convert("proteinuria",42,"mmol/L"));
 }
}
