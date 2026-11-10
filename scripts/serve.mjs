import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "dist");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8"
};

function fileFor(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const full = resolve(root, `.${pathname}`);
  if (full !== root && !full.startsWith(root + sep)) return null;
  return full;
}

const server = createServer(async (request, response) => {
  const full = fileFor(request.url || "/");
  if (!full) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  const candidates = [full, join(full, "index.html")];
  for (const candidate of candidates) {
    try {
      const details = await stat(candidate);
      if (!details.isFile()) continue;
      const content = await readFile(candidate);
      response.writeHead(200, {
        "Content-Type": types[extname(candidate)] || "application/octet-stream",
        "Cache-Control": "no-cache"
      });
      response.end(content);
      return;
    } catch {
      // try the next candidate
    }
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

server.listen(port, host, () => {
  console.log(`Northline accessibility lab running at http://127.0.0.1:${port}`);
});
