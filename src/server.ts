import { join } from 'path';

const server = Bun.serve({
  port: 3030,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Serve the test page
    if (pathname === '/') {
      return new Response(Bun.file(join(import.meta.dir, '..', '/demo/test.html')));
    }

    // Intercept the request for the SDK and compile it on the fly
    if (pathname === '/dist/index.js') {
      console.log('Bundling src/index.ts for development...');
      
      const build = await Bun.build({
        entrypoints: [join(import.meta.dir, 'index.ts')],
        target: 'browser',
        sourcemap: 'inline', // Good for debugging
      });

      if (!build.success) {
        console.error("Build failed:");
        for (const message of build.logs) {
          console.error(message);
        }
        return new Response('Build failed', { status: 500 });
      }

      // Serve the first build artifact (the JS file)
      return new Response(build.outputs[0], {
        headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
  error(error) {
    console.error(error);
    return new Response('Internal Server Error', { status: 500 });
  },
});

console.log(`Listening on http://localhost:${server.port}`);
