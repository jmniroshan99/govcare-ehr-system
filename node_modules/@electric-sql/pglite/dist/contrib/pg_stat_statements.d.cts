import { d as PGliteInterface } from '../pglite-BdeXTuy6.cjs';

declare const pg_stat_statements: {
    name: string;
    setup: (_pg: PGliteInterface, _emscriptenOpts: any) => Promise<{
        bundlePath: URL;
        sharedPreloadLibraries: string[];
    }>;
};

export { pg_stat_statements };
