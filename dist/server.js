const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = 3000;
// process.cwd() usa la carpeta donde está el .exe final
const DIST_DIR = path.join(process.cwd(), "dist");

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  // Si la ruta es '/', cargamos index.html
  let filePath = path.join(DIST_DIR, req.url === "/" ? "index.html" : req.url);

  // Si la ruta no tiene extensión (ej: react-router), forzamos index.html
  if (!path.extname(filePath)) {
    filePath = path.join(DIST_DIR, "index.html");
  }

  const extname = path.extname(filePath);
  const contentType = mimeTypes[extname] || "application/octet-stream";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("Archivo no encontrado");
      } else {
        res.writeHead(500);
        res.end("Error interno del servidor: " + error.code);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Servidor corriendo en ${url}`);

  // Abre el navegador por defecto de Windows
  const startCommand = process.platform === "win32" ? "start" : "open";
  exec(`${startCommand} ${url}`);
});
