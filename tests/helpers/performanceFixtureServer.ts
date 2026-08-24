import { createServer, type Server } from "node:http";

export type PerformanceFixtureServer = {
  url: string;
  close: () => Promise<void>;
};

export async function startPerformanceFixtureServer(): Promise<PerformanceFixtureServer> {
  const scriptPadding = "/* fixture padding */".repeat(32_000);
  const script = `
    const root = document.querySelector('#large-dom');
    for (let index = 0; index < 1600; index += 1) {
      const node = document.createElement('span');
      node.textContent = String(index);
      root.appendChild(node);
    }
    ${scriptPadding}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1600"><rect width="2400" height="1600" fill="#4466aa"/><text x="100" y="200" font-size="80" fill="white">Performance fixture</text><!--${"x".repeat(1_100_000)}--></svg>`;
  const html = `<!doctype html>
    <html lang="en"><head><meta charset="utf-8"><title>Performance Fixture</title>
    <link rel="stylesheet" href="/styles.css"></head><body>
    <main><h1>Performance fixture</h1><img src="/heavy.svg" width="1200" height="800" alt="Fixture hero"><div id="large-dom"></div></main>
    <a href="/second">Second page</a><script src="/heavy.js"></script></body></html>`;
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (path === "/heavy.js") {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(script);
      return;
    }
    if (path === "/heavy.svg") {
      response.writeHead(200, { "content-type": "image/svg+xml" });
      response.end(svg);
      return;
    }
    if (path === "/styles.css") {
      response.writeHead(200, { "content-type": "text/css" });
      response.end(
        "body{margin:0;font-family:system-ui}img{max-width:100%;height:auto}",
      );
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Performance fixture server did not bind to a TCP port");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server),
  };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
