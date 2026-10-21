package lk.gov.health.govcare.ai;

import lk.gov.health.govcare.common.ApiException;
import lk.gov.health.govcare.security.*;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CkdReportDownloadTest {
    @Test void crossOriginPdfRetainsReviewedCorsHeadersAndRejectsOtherOrigins() throws Exception {
        var reports=mock(CkdAssessmentReportService.class);var current=mock(CurrentUser.class);var id=UUID.randomUUID();
        byte[] bytes="%PDF-SYNTHETIC-SOFTWARE-TEST".getBytes(StandardCharsets.US_ASCII);
        when(reports.content(null,id)).thenReturn(new CkdAssessmentReportService.StoredReport(new ByteArrayResource(bytes),"synthetic.pdf"));
        var cors=new org.springframework.web.cors.CorsConfiguration();cors.setAllowedOrigins(List.of("http://127.0.0.1:5300"));cors.setAllowedMethods(List.of("GET"));
        var source=new org.springframework.web.cors.UrlBasedCorsConfigurationSource();source.registerCorsConfiguration("/**",cors);
        var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(new CkdAssessmentReportController(reports,mock(CkdPredictionService.class),current))
            .addFilter(new org.springframework.web.filter.CorsFilter(source)).build();
        mvc.perform(get("/api/ai-cdss/ckd/assessments/reports/"+id+"/download").header("Origin","http://127.0.0.1:5300"))
            .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin","http://127.0.0.1:5300"))
            .andExpect(content().contentType(MediaType.APPLICATION_PDF)).andExpect(content().bytes(bytes));
        clearInvocations(reports);
        mvc.perform(get("/api/ai-cdss/ckd/assessments/reports/"+id+"/download").header("Origin","https://unapproved.example.invalid"))
            .andExpect(status().isForbidden());verifyNoInteractions(reports);
    }
    @Test void returnsOneCompletePdfAfterTheExistingAuthorizedLookup() throws Exception {
        var reports=mock(CkdAssessmentReportService.class);var current=mock(CurrentUser.class);
        var actor=new GovCarePrincipal(UUID.randomUUID(),UUID.randomUUID(),null,null,"qa@example.invalid","Synthetic QA","doctor",Set.of("CONSULTATION_UPDATE"),true,false,1);
        var id=UUID.randomUUID();byte[] bytes="%PDF-SYNTHETIC-SOFTWARE-TEST".getBytes(StandardCharsets.US_ASCII);
        when(current.get()).thenReturn(actor);when(reports.content(actor,id)).thenReturn(new CkdAssessmentReportService.StoredReport(new ByteArrayResource(bytes),"synthetic.pdf"));
        var controller=new CkdAssessmentReportController(reports,mock(CkdPredictionService.class),current);
        var response=controller.download(id);
        assertArrayEquals(bytes,response.getBody());assertEquals(MediaType.APPLICATION_PDF,response.getHeaders().getContentType());
        assertEquals(bytes.length,response.getHeaders().getContentLength());assertTrue(response.getHeaders().getCacheControl().contains("no-store"));
        verify(reports).content(actor,id);verifyNoMoreInteractions(reports);
    }
    @Test void doesNotExposeBytesWhenPatientOrTenantLookupIsDenied() throws Exception {
        var reports=mock(CkdAssessmentReportService.class);var current=mock(CurrentUser.class);var id=UUID.randomUUID();
        when(reports.content(null,id)).thenThrow(ApiException.notFound("Report not found"));
        var controller=new CkdAssessmentReportController(reports,mock(CkdPredictionService.class),current);
        assertThrows(ApiException.class,()->controller.download(id));
    }
}
