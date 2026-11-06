const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const WebSocket = require("ws"); // <-- IMPORTANTE

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
  if (!path.extname(filePath)) filePath = path.join(DIST_DIR, "index.html");
  const extname = path.extname(filePath);
  const contentType = mimeTypes[extname] || "application/octet-stream";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Archivo no encontrado");
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

const wss = new WebSocket.Server({ server });
let activeConnections = 0;
let closeTimeout = null;

wss.on("connection", (ws) => {
  activeConnections++;
  console.log(`Pestaña conectada. Total: ${activeConnections}`);

  // Si había un temporizador de cierre pendiente (por un F5), lo cancelamos
  if (closeTimeout) {
    clearTimeout(closeTimeout);
    closeTimeout = null;
  }

  ws.on("close", () => {
    activeConnections--;
    console.log(`Pestaña cerrada. Total: ${activeConnections}`);

    if (activeConnections === 0) {
      // Esperamos 5 segundos antes de cerrar. Si en ese tiempo se abre otra pestaña, se cancela.
      closeTimeout = setTimeout(() => {
        if (activeConnections === 0) {
          console.log("Nadie conectado. Apagando servidor...");
          process.exit(0); // ESTO APAGA EL PROCESO DE NODE
        }
      }, 5000);
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
