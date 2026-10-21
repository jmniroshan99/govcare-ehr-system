package lk.gov.health.govcare.ai;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.imageio.ImageIO;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Optional, bounded local OCR. Patient documents are never sent to an external OCR service. */
@Service
public class ClinicalPdfOcrService {
 public record Line(String text,int page,Double confidence) {}
 public record Result(List<Line> lines,String status,String message) {}
 private final boolean enabled;
 private final String executable,language;
 private final int timeoutSeconds,maxPages;
 public ClinicalPdfOcrService(@Value("${govcare.pdf.ocr.enabled:false}") boolean enabled,
   @Value("${govcare.pdf.ocr.executable:tesseract}") String executable,
   @Value("${govcare.pdf.ocr.language:eng}") String language,
   @Value("${govcare.pdf.ocr.timeout-seconds:15}") int timeoutSeconds,
   @Value("${govcare.pdf.ocr.max-pages:10}") int maxPages){
  this.enabled=enabled;this.executable=executable;this.language=language;
  this.timeoutSeconds=Math.max(1,Math.min(timeoutSeconds,30));this.maxPages=Math.max(1,Math.min(maxPages,10));
 }
 public static ClinicalPdfOcrService disabled(){return new ClinicalPdfOcrService(false,"tesseract","eng",15,10);}
 public Result extract(byte[] pdf){
  if(!enabled)return new Result(List.of(),"NOT_CONFIGURED","This scan needs OCR. Local OCR is not enabled; enter measured values manually or use a text-based report.");
  Path directory=null;Process active=null;
  try(var document=Loader.loadPDF(pdf)){
   if(document.getNumberOfPages()>maxPages)return new Result(List.of(),"REVIEW_REQUIRED","This scan exceeds the configured OCR page limit. Split the report or enter values manually.");
   directory=Files.createTempDirectory("govcare-clinical-ocr-");var renderer=new PDFRenderer(document);var lines=new ArrayList<Line>();
   long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(60);
   for(int page=0;page<document.getNumberOfPages();page++){
    var box=document.getPage(page).getCropBox();double pixels=(box.getWidth()*200/72d)*(box.getHeight()*200/72d);
    if(!Double.isFinite(pixels)||pixels<=0||pixels>12000000)return new Result(List.of(),"REVIEW_REQUIRED","The scan page is too large for bounded OCR processing.");
    Path image=directory.resolve("page.png"),output=directory.resolve("output.tsv"),errors=directory.resolve("engine-errors.txt");
    ImageIO.write(renderer.renderImageWithDPI(page,200),"png",image.toFile());
    // Arguments are passed directly, never interpolated into a shell command.
    Process process=new ProcessBuilder(executable,image.toString(),"stdout","-l",language,"--psm","6","tsv")
      .redirectOutput(output.toFile()).redirectError(errors.toFile()).start();
    active=process;
    long remaining=Math.min(TimeUnit.SECONDS.toNanos(timeoutSeconds),deadline-System.nanoTime());
    if(remaining<=0||!process.waitFor(remaining,TimeUnit.NANOSECONDS)){process.destroyForcibly().waitFor();return new Result(List.of(),"TIMED_OUT","OCR took too long. Try a clearer scan or enter values manually.");}
    if(process.exitValue()!=0)return new Result(List.of(),"UNAVAILABLE","The local OCR engine could not read this scan. Check its installation and language configuration.");
    if(Files.size(output)>8*1024*1024)return new Result(List.of(),"REVIEW_REQUIRED","OCR output exceeded the processing limit.");
    lines.addAll(parseTsv(Files.readString(output),page+1));
   }
   return new Result(lines,lines.isEmpty()?"NO_TEXT":"COMPLETED",lines.isEmpty()?"No readable words were found in the scan.":"OCR text requires review against the original scan.");
  }catch(InterruptedException interrupted){Thread.currentThread().interrupt();return new Result(List.of(),"INTERRUPTED","OCR was interrupted. Re-read the source to try again.");}
   catch(Exception unavailable){return new Result(List.of(),"UNAVAILABLE","Local OCR is unavailable. Check the configured executable and language data, or use manual entry.");}
  finally{
   if(active!=null&&active.isAlive())active.destroyForcibly();
   if(directory!=null)try{List<Path> paths;try(var files=Files.list(directory)){paths=files.toList();}for(Path file:paths)Files.deleteIfExists(file);Files.deleteIfExists(directory);}catch(Exception ignored){/* No source content is logged. */}
  }
 }
 static List<Line> parseTsv(String tsv,int page){
  var words=new LinkedHashMap<String,List<String>>();var confidence=new HashMap<String,Double>();
  for(String row:tsv.lines().skip(1).toList()){
   String[] parts=row.split("\t",12);if(parts.length!=12||!"5".equals(parts[0])||parts[11].isBlank())continue;
   try{double score=Double.parseDouble(parts[10]);if(!Double.isFinite(score)||score<0||score>100)continue;
    String key=String.join("/",parts[1],parts[2],parts[3],parts[4]);words.computeIfAbsent(key,k->new ArrayList<>()).add(parts[11].trim());confidence.merge(key,score/100d,Math::min);
   }catch(NumberFormatException ignored){}
  }
  return words.entrySet().stream().map(entry->new Line(String.join(" ",entry.getValue()),page,confidence.get(entry.getKey()))).toList();
 }
}
