const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
]);
const port = Number(process.env.PORT) || 8000;

http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const file = files.get(pathname);
  if (!file || !["GET", "HEAD"].includes(request.method)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  fs.readFile(path.join(__dirname, file[0]), (error, contents) => {
    if (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Unable to read the requested file.");
      return;
    }
    response.writeHead(200, {
      "Content-Type": file[1],
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`Sunshine is ready at http://localhost:${port}`);
});
