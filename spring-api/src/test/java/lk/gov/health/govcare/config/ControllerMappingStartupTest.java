package lk.gov.health.govcare.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import lk.gov.health.govcare.ai.PredictiveIntelligenceController;
import lk.gov.health.govcare.ai.PredictiveIntelligenceService;
import lk.gov.health.govcare.ai.RenalClinicalModuleController;
import lk.gov.health.govcare.ai.RenalClinicalModuleService;
import lk.gov.health.govcare.common.GlobalExceptionHandler;
import lk.gov.health.govcare.security.CurrentUser;
import lk.gov.health.govcare.security.GovCarePrincipal;
import lk.gov.health.govcare.security.JwtAuthenticationFilter;
import lk.gov.health.govcare.security.JwtService;
import lk.gov.health.govcare.security.UserSecurityService;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.core.env.MapPropertySource;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Initializes real production MVC mappings and security, without opening a database or ML connection. */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ControllerMappingStartupTest {
    private static final UUID PATIENT = UUID.fromString("00000000-0000-4000-8000-000000000001");
    private static final String BASE = "/api/ai-cdss/ckd/patients/" + PATIENT;
    private final GovCarePrincipal actor = new GovCarePrincipal(UUID.randomUUID(), UUID.randomUUID(),
            UUID.randomUUID(), null, "mvc-test@example.invalid", "MVC test clinician", "doctor",
            Set.of("PATIENT_VIEW_CLINICAL", "CONSULTATION_UPDATE"), true, false, 1);
    private AnnotationConfigWebApplicationContext context;
    private MockMvc mvc;
    private ObjectMapper mapper;
    private RenalClinicalModuleService renal;
    private PredictiveIntelligenceService clinical;
    private List<Class<?>> controllers;

    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    static class WebConfiguration {}

    @BeforeAll
    void startAllControllerMappings() throws Exception {
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Controller.class));
        controllers = scanner.findCandidateComponents("lk.gov.health.govcare").stream().<Class<?>>map(bean -> {
            try { return Class.forName(bean.getBeanClassName()); }
            catch (ClassNotFoundException e) { throw new IllegalStateException(e); }
        }).toList();
        assertTrue(controllers.contains(RenalClinicalModuleController.class));
        assertTrue(controllers.contains(PredictiveIntelligenceController.class));

        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("mvc-test",
                Map.of("govcare.cors.allowed-origins", "http://127.0.0.1:5300")));
        context.register(WebConfiguration.class, SecurityConfig.class, GlobalExceptionHandler.class);
        context.register(controllers.toArray(Class<?>[]::new));

        // Only service/repository boundaries are mocks. Controllers, Spring's registry,
        // current-user lookup, JWT filter, and the production security chain are real.
        Map<Class<?>, Object> boundaries = new HashMap<>();
        mapper = new ObjectMapper().findAndRegisterModules();
        boundaries.put(ObjectMapper.class, mapper);
        boundaries.put(CurrentUser.class, new CurrentUser());
        for (Class<?> controller : controllers) {
            for (var constructor : controller.getConstructors()) {
                for (Class<?> type : constructor.getParameterTypes()) {
                    if (type != PasswordEncoder.class) boundaries.computeIfAbsent(type, key -> mock(key));
                }
            }
        }
        context.addBeanFactoryPostProcessor(beanFactory -> {
            for (var boundary : boundaries.entrySet()) {
                beanFactory.registerSingleton("boundary:" + boundary.getKey().getName(), boundary.getValue());
            }
            beanFactory.registerSingleton("jwtAuthenticationFilter", new JwtAuthenticationFilter(
                    (JwtService) boundaries.get(JwtService.class), (UserSecurityService) boundaries.get(UserSecurityService.class)));
        });
        context.refresh(); // Duplicate URL/method mappings fail here, as they do in a real Spring startup.
        renal = context.getBean(RenalClinicalModuleService.class);
        clinical = context.getBean(PredictiveIntelligenceService.class);
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @BeforeEach
    void resetServiceBoundaries() { reset(renal, clinical); }

    @AfterAll
    void stopContext() { if (context != null) context.close(); }

    @Test
    void everyProductionControllerRegistersAndEachOverviewHasOneOwner() {
        assertEquals(controllers.size(), context.getBeansWithAnnotation(Controller.class).size());
        assertRouteOwner("/api/ai-cdss/ckd/patients/{patientId}/predictive-intelligence", RequestMethod.GET,
                RenalClinicalModuleController.class);
        assertRouteOwner("/api/ai-cdss/ckd/patients/{patientId}/intelligence", RequestMethod.GET,
                PredictiveIntelligenceController.class);
        assertRouteOwner("/api/ai-cdss/ckd/patients/{patientId}/predictive-intelligence/reviews", RequestMethod.POST,
                RenalClinicalModuleController.class);
        System.out.println("Registered all " + controllers.size() + " production controllers without ambiguous mappings.");
    }

    @Test
    void sixModuleGetUsesRenalContractAndPreservesExplicitNulls() throws Exception {
        var response = mapper.createObjectNode().put("patientId", PATIENT.toString());
        response.putArray("moduleOrder").add("renalTrajectory");
        response.putObject("renalTrajectory").putNull("researchRiskScore");
        when(renal.overview(actor, PATIENT)).thenReturn(response);
        mvc.perform(get(BASE + "/predictive-intelligence").with(user(actor)))
                .andExpect(status().isOk()).andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.patientId").value(PATIENT.toString()))
                .andExpect(content().json(response.toString()));
        verify(renal).overview(actor, PATIENT);
        verifyNoInteractions(clinical);
    }

    @Test
    void existingIntelligenceGetKeepsItsClinicalOverviewContract() throws Exception {
        var response = new PredictiveIntelligenceService.Overview(Map.of("id", PATIENT.toString()),
                null, List.of(), List.of(), List.of(), false, false, "No reconciled medication context", null);
        when(clinical.overview(actor, PATIENT)).thenReturn(response);
        mvc.perform(get(BASE + "/intelligence").with(user(actor)))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.patient.id").value(PATIENT.toString()))
                .andExpect(jsonPath("$.recommendations").isArray())
                .andExpect(jsonPath("$.timeline").isArray());
        verify(clinical).overview(actor, PATIENT);
        verifyNoInteractions(renal);
    }

    @Test
    void renalReviewPostStillUsesPatientScopedReviewContract() throws Exception {
        var request = new RenalClinicalModuleService.ReviewRequest(UUID.randomUUID(), UUID.randomUUID(),
                "renalTrajectory", 0, "DEFER", "Await source verification", null, null);
        when(renal.review(actor, PATIENT, request)).thenReturn(Map.of("saved", true));
        mvc.perform(post(BASE + "/predictive-intelligence/reviews").with(user(actor))
                        .contentType("application/json").content(mapper.writeValueAsString(request)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.saved").value(true));
        verify(renal).review(actor, PATIENT, request);
        verifyNoInteractions(clinical);
    }

    @Test
    void anonymousClinicalReadsAndReviewsAreDeniedBeforeServices() throws Exception {
        mvc.perform(get(BASE + "/predictive-intelligence")).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE + "/intelligence")).andExpect(status().isUnauthorized());
        mvc.perform(post(BASE + "/predictive-intelligence/reviews").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(renal, clinical);
    }

    private void assertRouteOwner(String path, RequestMethod verb, Class<?> owner) {
        var matches = context.getBean(RequestMappingHandlerMapping.class).getHandlerMethods().entrySet().stream()
                .filter(entry -> entry.getKey().getPatternValues().contains(path)
                        && entry.getKey().getMethodsCondition().getMethods().contains(verb)).toList();
        assertEquals(1, matches.size(), verb + " " + path + " must have exactly one handler");
        assertEquals(owner, matches.getFirst().getValue().getBeanType());
    }
}
