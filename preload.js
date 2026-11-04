const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getProductos: () => ipcRenderer.invoke("get-productos"),
  addProducto: (prod) => ipcRenderer.invoke("add-producto", prod),
  procesarVenta: (venta) => ipcRenderer.invoke("procesar-venta", venta),
  getFiados: () => ipcRenderer.invoke("get-fiados"),
  addFiado: (fiado) => ipcRenderer.invoke("add-fiado", fiado),
  getCaja: () => ipcRenderer.invoke("get-caja"),
  addMovimientoCaja: (mov) => ipcRenderer.invoke("add-movimiento-caja", mov),
  getHistorialVentas: () => ipcRenderer.invoke("get-historial-ventas"),
  updateFiado: (data) => ipcRenderer.invoke("update-fiado", data),
  deleteFiado: (id) => ipcRenderer.invoke("delete-fiado", id),
  updateProducto: (prod) => ipcRenderer.invoke("update-producto", prod),
  deleteProducto: (id) => ipcRenderer.invoke("delete-producto", id),
  getVentaDetalle: (id) => ipcRenderer.invoke("get-venta-detalle", id),
});
