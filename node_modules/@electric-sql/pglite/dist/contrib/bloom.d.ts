import { d as PGliteInterface } from '../pglite-BdeXTuy6.js';

declare const bloom: {
    name: string;
    setup: (_pg: PGliteInterface, _emscriptenOpts: any) => Promise<{
        bundlePath: URL;
    }>;
};

export { bloom };
