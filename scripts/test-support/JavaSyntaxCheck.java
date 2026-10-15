import com.sun.source.util.JavacTask;
import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public class JavaSyntaxCheck {
    public static void main(String[] args) throws Exception {
        var compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) throw new IllegalStateException("A full JDK is required.");
        var files = new ArrayList<Path>();
        for (String arg : args) {
            Path path = Path.of(arg);
            if (Files.isRegularFile(path)) files.add(path);
            else try (var paths = Files.walk(path)) {
                files.addAll(paths.filter(p -> p.toString().endsWith(".java")).sorted().toList());
            }
        }
        var diagnostics = new DiagnosticCollector<JavaFileObject>();
        try (StandardJavaFileManager manager = compiler.getStandardFileManager(diagnostics, null, null)) {
            var task = (JavacTask) compiler.getTask(null, manager, diagnostics,
                    List.of("--release", "21", "-proc:none"), null,
                    manager.getJavaFileObjectsFromPaths(files));
            for (var unit : task.parse()) { /* Parse every source with the real Java compiler. */ }
        }
        long errors = 0;
        for (var diagnostic : diagnostics.getDiagnostics()) {
            if (diagnostic.getKind() == Diagnostic.Kind.ERROR) {
                System.err.println(diagnostic);
                errors++;
            }
        }
        System.out.println("Parsed " + files.size() + " Java sources; syntax errors: " + errors);
        if (errors > 0) System.exit(1);
    }
}
