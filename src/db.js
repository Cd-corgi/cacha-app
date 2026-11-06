import Dexie from "dexie";

export const db = new Dexie("CachaAppDB");

db.version(1).stores({
  productos: "++id, nombre, fecha_vencimiento",
  ventas: "++id, fecha, metodo_pago",
  detalle_ventas: "++id, venta_id, producto_id",
  fiados: "++id, cliente",
  caja: "++id, fecha, tipo, metodo",
});

// Agregamos las tablas para las facturas de ingreso
db.version(2).stores({
  facturas_ingreso: "++id, fecha",
  detalle_facturas: "++id, factura_id",
});
