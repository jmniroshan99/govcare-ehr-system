package lk.gov.health.govcare.ai;
import lk.gov.health.govcare.security.*;
import lk.gov.health.govcare.common.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
class ClinicalTestLibraryAccessTest {
 static GovCarePrincipal actor(){return new GovCarePrincipal(UUID.randomUUID(),UUID.randomUUID(),null,null,"qa@example.invalid","Synthetic QA","super_admin",Set.of("*"),true,false,1);}
 @Test void superAdminStillRequiresClinicalAccessBeforeLibraryLookup(){var actor=actor();var patient=UUID.randomUUID();var access=mock(ClinicalPatientAccess.class);var sql=mock(SqlSupport.class);var imports=mock(ClinicalPdfImportService.class);when(access.clinicalScope(actor,patient,false)).thenThrow(ApiException.forbidden("denied"));var library=new ClinicalTestDocumentLibrary(access,sql,imports);assertThrows(ApiException.class,()->library.list(actor,patient));verifyNoInteractions(sql,imports);}
 @Test void storedSyntheticDesignationIsRequiredEvenWithWildcardPermissions(){var actor=actor();var patient=UUID.randomUUID();var access=mock(ClinicalPatientAccess.class);var sql=mock(SqlSupport.class);var imports=mock(ClinicalPdfImportService.class);when(access.clinicalScope(actor,patient,true)).thenReturn(actor);var library=new ClinicalTestDocumentLibrary(access,sql,imports);assertThrows(ApiException.class,()->library.use(actor,patient,"comprehensive"));verifyNoInteractions(imports);}
 @Test void authorizedFixtureKeysAreExplicitAndCannotTraverseResources()throws Exception{var actor=actor();var patient=UUID.randomUUID();var access=mock(ClinicalPatientAccess.class);var sql=mock(SqlSupport.class);when(access.clinicalScope(actor,patient,false)).thenReturn(actor);when(sql.one(contains("risk_flags @>"),anyMap())).thenReturn(Optional.of(Map.of("synthetic",true)));var library=new ClinicalTestDocumentLibrary(access,sql,mock(ClinicalPdfImportService.class));assertEquals(8,((List<?>)library.list(actor,patient).get("items")).size());assertThrows(ApiException.class,()->library.content(actor,patient,"../../application.yml"));}
}
