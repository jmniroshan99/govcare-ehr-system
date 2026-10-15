package lk.gov.health.govcare.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

/** Reads reviewed artifact metadata and the same serving gate used by Django. Never executes a pickle or inference. */
@Component
public class RenalModelMetadata {
    private final Path training;
    private static final ObjectMapper MAPPER=new ObjectMapper();
    public RenalModelMetadata(@Value("${govcare.renal-training.directory:}") String directory) {
        training=directory!=null&&!directory.isBlank()?Path.of(directory):
                Files.isDirectory(Path.of("ml-training/artifacts"))?Path.of("ml-training"):Path.of("../ml-training");
    }
    public List<Map<String,Object>> enrich(List<Map<String,Object>> registry) {
        List<Map<String,Object>> out=new ArrayList<>();
        for(var entry:registry) {
            Map<String,Object> row=new LinkedHashMap<>(entry);String key=Objects.toString(entry.get("model_key"),"");
            try {
                String folder=switch(key){case "hb"->"hb-risk";case "urr"->"urr-risk";case "hyperkalemia"->"hyperkalemia-risk";default->throw new IllegalArgumentException();};
                Path dir=training.resolve("artifacts").resolve(folder);
                JsonNode meta=MAPPER.readTree(Files.readString(dir.resolve("metadata.json")));
                JsonNode contract=MAPPER.readTree(Files.readString(training.resolve("serving_input_contract.json")));
                if(!SriLankanRenalMlClient.modelId(key).equals(meta.path("model").asText())
                        ||!SriLankanRenalMlClient.MODEL_VERSION.equals(meta.path("model_version").asText())
                        ||!meta.path("feature_names").isArray()||!meta.path("required_measurements").isArray()
                        ||!contract.path("predictors").isArray()||contract.path("minimumObservations").asInt()!=2
                        ||contract.path("minimumCurrentPredictors").asInt()<=0)throw new IllegalArgumentException();
                Set<String> names=new HashSet<>();meta.path("feature_names").forEach(x->names.add(x.asText()));
                for(JsonNode predictor:contract.path("predictors"))if(!names.contains(predictor.asText()))throw new IllegalArgumentException();
                String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(dir.resolve("model.joblib"))));
                if(!hash.equals(meta.path("artifact_sha256").asText()))throw new IllegalArgumentException();
                row.put("artifact_metadata",meta);row.put("serving_contract",contract);row.put("artifact_status","INSTALLED");
            } catch(Exception unavailable) {
                row.put("artifact_status","NOT_INSTALLED");
                row.put("artifact_reason","Reviewed model metadata, serving contract or artifact is missing or incompatible. Ask an administrator to restore the reviewed package.");
            }
            out.add(row);
        }
        return out;
    }
}
