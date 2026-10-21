package lk.gov.health.govcare.documents;

import lk.gov.health.govcare.security.CurrentUser;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PatientPdfViewTest {
 @Test void authorizedPdfRetainsCorsAndNoStoreHeadersWithoutResourceRangeConversion()throws Exception{
  var documents=mock(PatientDocumentService.class);var current=mock(CurrentUser.class);var patient=UUID.randomUUID();var document=UUID.randomUUID();
  byte[] pdf="%PDF-SYNTHETIC-SOFTWARE-QA".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
  when(documents.content(null,patient,document,false,false)).thenReturn(new PatientDocumentService.DocumentContent(Map.of("mimeType","application/pdf","originalFileName","synthetic.pdf"),new ByteArrayResource(pdf)));
  var cors=new org.springframework.web.cors.CorsConfiguration();cors.setAllowedOrigins(List.of("http://127.0.0.1:5300"));cors.setAllowedMethods(List.of("GET"));var source=new org.springframework.web.cors.UrlBasedCorsConfigurationSource();source.registerCorsConfiguration("/**",cors);
  var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(new PatientDocumentController(documents,mock(DepartmentSharingService.class),current,new LocalPdfExtractionService())).addFilter(new org.springframework.web.filter.CorsFilter(source)).build();
  mvc.perform(get("/api/patients/"+patient+"/documents/"+document+"/content").header("Origin","http://127.0.0.1:5300")).andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin","http://127.0.0.1:5300")).andExpect(header().string("Cache-Control","no-store")).andExpect(content().bytes(pdf));
  clearInvocations(documents);mvc.perform(get("/api/patients/"+patient+"/documents/"+document+"/content").header("Origin","https://unapproved.example.invalid")).andExpect(status().isForbidden());verifyNoInteractions(documents);
 }
}
