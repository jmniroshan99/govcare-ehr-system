package lk.gov.health.govcare.transfer;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lk.gov.health.govcare.security.GovCarePrincipal;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@Service
public class TransferPdfService {
    private final InterHospitalTransferService transfers;
    public TransferPdfService(InterHospitalTransferService transfers){this.transfers=transfers;}

    public byte[] packagePdf(GovCarePrincipal actor, java.util.UUID transferId){
        Map<String,Object> t=transfers.detail(actor,transferId);
        ByteArrayOutputStream out=new ByteArrayOutputStream();
        Document doc=new Document(PageSize.A4,36,36,36,36);
        PdfWriter.getInstance(doc,out);doc.open();
        Font title=new Font(Font.HELVETICA,18,Font.BOLD);Font heading=new Font(Font.HELVETICA,11,Font.BOLD);Font normal=new Font(Font.HELVETICA,9,0);
        doc.add(new Paragraph("GovCare EHR Inter-Hospital Transfer Package",title));
        doc.add(new Paragraph("Generated: "+OffsetDateTime.now(),normal));doc.add(Chunk.NEWLINE);
        PdfPTable table=new PdfPTable(2);table.setWidthPercentage(100);
        add(table,"Transfer ID",t.get("transferNumber"),heading,normal);add(table,"Status",t.get("status"),heading,normal);
        add(table,"Patient",t.get("patientName")+" ("+t.get("patientNumber")+")",heading,normal);add(table,"Priority",t.get("priority"),heading,normal);
        add(table,"Sending hospital",t.get("sourceHospitalName"),heading,normal);add(table,"Receiving hospital",t.get("destinationHospitalName"),heading,normal);
        add(table,"Transfer reason",t.get("transferReason"),heading,normal);add(table,"Current diagnosis",t.get("currentDiagnosis"),heading,normal);
        add(table,"Clinical summary",t.get("clinicalSummary"),heading,normal);add(table,"Current condition",t.get("currentCondition"),heading,normal);
        add(table,"Allergies",t.get("allergies"),heading,normal);add(table,"Current medication",t.get("currentMedication"),heading,normal);
        add(table,"Infection status",t.get("infectionStatus"),heading,normal);add(table,"Isolation required",t.get("isolationRequired"),heading,normal);
        add(table,"Oxygen required",t.get("oxygenRequired"),heading,normal);add(table,"Ventilator required",t.get("ventilatorRequired"),heading,normal);
        add(table,"Transport",t.get("transportType"),heading,normal);add(table,"Vehicle",t.get("vehicleNumber"),heading,normal);
        add(table,"Estimated departure",t.get("estimatedDeparture"),heading,normal);add(table,"Estimated arrival",t.get("estimatedArrival"),heading,normal);
        doc.add(table);doc.add(Chunk.NEWLINE);doc.add(new Paragraph("Attached verified documents",heading));
        @SuppressWarnings("unchecked") List<Map<String,Object>> documents=(List<Map<String,Object>>)t.getOrDefault("documents",List.of());
        if(documents.isEmpty())doc.add(new Paragraph("No verified documents attached.",normal));
        else for(Map<String,Object> d:documents)doc.add(new Paragraph("• "+d.get("title")+" — "+d.get("documentType"),normal));
        doc.add(Chunk.NEWLINE);doc.add(new Paragraph("This package contains minimum-necessary clinical information and must be handled according to GovCare access-control and audit policies.",normal));
        doc.close();return out.toByteArray();
    }
    private void add(PdfPTable table,String label,Object value,Font heading,Font normal){table.addCell(new Phrase(label,heading));table.addCell(new Phrase(value==null?"—":String.valueOf(value),normal));}
}
