package lk.gov.health.govcare.ai.predictive;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class KfreFourVariableEquationTest {
    @Test void agreesWithIndependentAuthorsCalculatorForBothHorizons() {
        // Expected values executed from the authors' published JavaScript, not
        // recomputed by this Java implementation. Provenance is in V54 docs.
        double[][] cases = {{65,1,25,300,.09011469495037816,.30627437347101205},
            {45,0,45,30,.004366566051095977,.016802516319022964},
            {70,1,15,1000,.35809252027149474,.8203227801893902},
            {18,0,59,1,.0003597140970682533,.0013921688073675886},
            {80,0,10,5000,.6329567467873181,.9793702405233475}};
        for (double[] c : cases) {
            var r = KfreFourVariableEquation.calculate((int)c[0], c[1] == 1 ? "MALE" : "FEMALE", c[2], c[3], "mg/g");
            assertEquals(c[4], r.twoYearRisk(), 1e-12);
            assertEquals(c[5], r.fiveYearRisk(), 1e-12);
            assertTrue(r.twoYearRisk() >= 0 && r.fiveYearRisk() <= 1 && r.fiveYearRisk() >= r.twoYearRisk());
        }
    }
    @Test void acrUnitConversionPreservesRisk() {
        var mg = KfreFourVariableEquation.calculate(65,"MALE",25,300,"mg/g");
        var si = KfreFourVariableEquation.calculate(65,"MALE",25,300/8.84,"mg/mmol");
        assertEquals(mg,si);
    }
    @Test void invalidOrOutOfPopulationInputsFailWithoutImputation() {
        for (double value : new double[]{0,-1,Double.NaN,Double.POSITIVE_INFINITY,100001})
            assertThrows(IllegalArgumentException.class, () -> KfreFourVariableEquation.calculate(65,"MALE",25,value,"mg/g"));
        for (double value : new double[]{0,-1,60,Double.NaN})
            assertThrows(IllegalArgumentException.class, () -> KfreFourVariableEquation.calculate(65,"MALE",value,300,"mg/g"));
        assertThrows(IllegalArgumentException.class, () -> KfreFourVariableEquation.calculate(17,"MALE",25,300,"mg/g"));
        assertThrows(IllegalArgumentException.class, () -> KfreFourVariableEquation.calculate(65,"UNKNOWN",25,300,"mg/g"));
        assertThrows(IllegalArgumentException.class, () -> KfreFourVariableEquation.calculate(65,"FEMALE",25,300,"g/L"));
    }
}
