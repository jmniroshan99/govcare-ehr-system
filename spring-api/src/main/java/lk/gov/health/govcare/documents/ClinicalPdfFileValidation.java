package lk.gov.health.govcare.documents;
import lk.gov.health.govcare.common.ApiException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.*;
import java.io.IOException;
import java.util.*;

/** Validates actual content independently of filename, clinical labels and extracted values. */
public final class ClinicalPdfFileValidation {
 private ClinicalPdfFileValidation(){}
 public static boolean signature(byte[] bytes){return bytes!=null&&bytes.length>=5&&bytes[0]=='%'&&bytes[1]=='P'&&bytes[2]=='D'&&bytes[3]=='F'&&bytes[4]=='-';}
 public static void validate(byte[] bytes)throws IOException{
  if(!signature(bytes))throw ApiException.badRequest("The file content is not a PDF.");
  try(var document=Loader.loadPDF(bytes)){
   if(document.isEncrypted())throw ApiException.badRequest("Encrypted PDFs require an unlocked copy.");
   if(document.getNumberOfPages()<1||document.getNumberOfPages()>200)throw ApiException.badRequest("PDFs must contain between 1 and 200 pages.");
   var seen=Collections.newSetFromMap(new IdentityHashMap<COSBase,Boolean>());var pending=new ArrayDeque<COSBase>();pending.add(document.getDocumentCatalog().getCOSObject());
   while(!pending.isEmpty()){
    var value=pending.removeFirst();if(!seen.add(value))continue;if(seen.size()>100000)throw ApiException.badRequest("The PDF structure exceeds the processing limit.");
    if(value instanceof COSObject reference){if(reference.getObject()!=null)pending.add(reference.getObject());}
    else if(value instanceof COSDictionary dictionary){
     if(dictionary.containsKey(COSName.getPDFName("JS"))||dictionary.containsKey(COSName.getPDFName("JavaScript"))||dictionary.containsKey(COSName.getPDFName("EmbeddedFiles"))||dictionary.containsKey(COSName.getPDFName("RichMediaContent"))||Set.of("JavaScript","Launch","SubmitForm","ImportData","GoToR").contains(dictionary.getNameAsString(COSName.S,"")))throw ApiException.badRequest("PDF active scripts, embedded files and external executable actions are not supported.");
     for(var item:dictionary.entrySet())if(item.getValue()!=null)pending.add(item.getValue());
    }else if(value instanceof COSArray array)for(COSBase item:array)if(item!=null)pending.add(item);
   }
  }catch(org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException locked){throw ApiException.badRequest("Encrypted PDFs require an unlocked copy.");}
   catch(IOException invalid){throw ApiException.badRequest("The file could not be parsed as a valid PDF.");}
 }
}
