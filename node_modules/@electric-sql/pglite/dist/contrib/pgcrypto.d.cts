import { d as PGliteInterface } from '../pglite-BdeXTuy6.cjs';

declare const pgcrypto: {
    name: string;
    setup: (_pg: PGliteInterface, _emscriptenOpts: any) => Promise<{
        bundlePath: URL;
    }>;
};

export { pgcrypto };
