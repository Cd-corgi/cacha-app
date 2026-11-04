// const db = new Database(path.join(__dirname, "/userData/cacha_app.db"));
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const Database = require("better-sqlite3");

const db = new Database(path.join(app.getPath("userData"), "cacha_app.db"));

// Crear tablas (incluyendo detalle_ventas para el carrito)
// Crear tablas
db.exec(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, precio REAL NOT NULL, stock INTEGER NOT NULL, fecha_vencimiento TEXT
    );
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT DEFAULT CURRENT_TIMESTAMP, total REAL NOT NULL, metodo_pago TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS fiados (
      id INTEGER PRIMARY KEY AUTOINCREMENT, cliente TEXT NOT NULL, monto REAL NOT NULL, fecha TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT DEFAULT CURRENT_TIMESTAMP, descripcion TEXT NOT NULL, tipo TEXT NOT NULL, monto REAL NOT NULL, metodo TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS detalle_ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT, venta_id INTEGER, producto_id INTEGER, nombre_producto TEXT, cantidad INTEGER, precio_unitario REAL
    );
  `);

// --- MIGRACIÓN AUTOMÁTICA ---
// Si la tabla detalle_ventas ya existía sin la columna 'nombre_producto', se la agregamos
try {
  db.exec("ALTER TABLE detalle_ventas ADD COLUMN nombre_producto TEXT");
  // Actualizar las ventas viejas que no tengan el nombre guardado
  db.exec(`
      UPDATE detalle_ventas 
      SET nombre_producto = (SELECT nombre FROM productos WHERE productos.id = detalle_ventas.producto_id)
      WHERE nombre_producto IS NULL
    `);
} catch (error) {
  // Si la columna ya existe, ignorará el error (es normal)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // ESTA LÍNEA ES LA SOLUCIÓN: Hace que Electron se haga pasar por Google Chrome
  win.webContents.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  );

  win.loadFile("index.html");
}
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// --- IPC MANEJADORES ---
ipcMain.handle("get-productos", () =>
  db.prepare("SELECT * FROM productos ORDER BY fecha_vencimiento ASC").all(),
);

ipcMain.handle("add-producto", (e, prod) => {
  const stmt = db.prepare(
    "INSERT INTO productos (nombre, precio, stock, fecha_vencimiento) VALUES (?, ?, ?, ?)",
  );
  return stmt.run(prod.nombre, prod.precio, prod.stock, prod.fecha_vencimiento);
});

// TRANSACCIÓN DE VENTA: Guarda venta, detalles y resta stock
ipcMain.handle("procesar-venta", (e, ventaData) => {
  // Agregamos 'nombre_producto' al INSERT
  const insertVenta = db.prepare(
    "INSERT INTO ventas (total, metodo_pago) VALUES (?, ?)",
  );
  const insertDetalle = db.prepare(
    "INSERT INTO detalle_ventas (venta_id, producto_id, nombre_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?)",
  );
  const updateStock = db.prepare(
    "UPDATE productos SET stock = stock - ? WHERE id = ?",
  );

  const ejecutarVenta = db.transaction((datos) => {
    const infoVenta = insertVenta.run(datos.total, datos.metodo_pago);
    const ventaId = infoVenta.lastInsertRowid;

    for (const item of datos.items) {
      // Guardamos item.id, item.nombre (que viene del carrito), etc.
      insertDetalle.run(
        ventaId,
        item.id,
        item.nombre,
        item.cantidad,
        item.precio,
      );
      updateStock.run(item.cantidad, item.id);
    }
  });

  try {
    ejecutarVenta(ventaData);
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-fiados", () =>
  db.prepare("SELECT * FROM fiados ORDER BY fecha DESC").all(),
);
ipcMain.handle("add-fiado", (e, fiado) => {
  try {
    const stmt = db.prepare(
      "INSERT INTO fiados (cliente, monto) VALUES (?, ?)",
    );
    return stmt.run(fiado.cliente, fiado.monto);
  } catch (error) {
    console.error("Error en DB fiados:", error);
    throw error; // Esto enviará el error al frontend
  }
});

ipcMain.handle("get-caja", () =>
  db.prepare("SELECT * FROM caja ORDER BY fecha DESC").all(),
);
ipcMain.handle("add-movimiento-caja", (e, mov) => {
  const stmt = db.prepare(
    "INSERT INTO caja (descripcion, tipo, monto, metodo) VALUES (?, ?, ?, ?)",
  );
  return stmt.run(mov.descripcion, mov.tipo, mov.monto, mov.metodo);
});

// ACTUALIZAR ESTA FUNCIÓN EXISTENTE (Para que el historial no falle si se borra un producto)
ipcMain.handle("get-historial-ventas", () => {
  const query = `
    SELECT v.id as venta_id, v.fecha, v.total, v.metodo_pago, 
           GROUP_CONCAT(dv.nombre_producto || ' (x' || dv.cantidad || ')', ', ') as productos_vendidos
    FROM ventas v
    LEFT JOIN detalle_ventas dv ON v.id = dv.venta_id
    GROUP BY v.id
    ORDER BY v.fecha DESC
  `;
  return db.prepare(query).all();
});

// Actualizar el monto de un fiado
ipcMain.handle("update-fiado", (e, data) => {
  const stmt = db.prepare("UPDATE fiados SET monto = ? WHERE id = ?");
  return stmt.run(data.monto, data.id);
});

// Eliminar un fiado (cuando ya pagó o se dio por perdido)
ipcMain.handle("delete-fiado", (e, id) => {
  const stmt = db.prepare("DELETE FROM fiados WHERE id = ?");
  return stmt.run(id);
});

// Actualizar un producto existente
ipcMain.handle("update-producto", (e, prod) => {
  const stmt = db.prepare(
    "UPDATE productos SET nombre = ?, precio = ?, stock = ?, fecha_vencimiento = ? WHERE id = ?",
  );
  return stmt.run(
    prod.nombre,
    prod.precio,
    prod.stock,
    prod.fecha_vencimiento,
    prod.id,
  );
});

// Eliminar un producto
ipcMain.handle("delete-producto", (e, id) => {
  try {
    // Desvincular el ID para que SQLite no bloquee el borrado,
    // pero el nombre ya está a salvo en detalle_ventas.
    db.prepare(
      "UPDATE detalle_ventas SET producto_id = NULL WHERE producto_id = ?",
    ).run(id);

    // Eliminar producto
    const stmt = db.prepare("DELETE FROM productos WHERE id = ?");
    return stmt.run(id);
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    throw error;
  }
});

// Obtener el detalle exacto de una venta
ipcMain.handle("get-venta-detalle", (e, ventaId) => {
  const query = `
    SELECT nombre_producto as nombre, cantidad, precio_unitario, (cantidad * precio_unitario) as subtotal
    FROM detalle_ventas
    WHERE venta_id = ?
  `;
  return db.prepare(query).all(ventaId);
});
