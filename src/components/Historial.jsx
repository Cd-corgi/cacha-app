import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

export default function Historial() {
  const [filtros, setFiltros] = useState({
    orden: "desc",
    desde: "",
    hasta: "",
    tipo: "Todos",
  });
  const [detalle, setDetalle] = useState(null);

  // Cargar Ventas y Facturas
  const ventas = useLiveQuery(() => db.ventas.toArray()) || [];
  const detallesVentas = useLiveQuery(() => db.detalle_ventas.toArray()) || [];
  const facturas = useLiveQuery(() => db.facturas_ingreso.toArray()) || [];
  const detallesFacturas =
    useLiveQuery(() => db.detalle_facturas.toArray()) || [];

  // Unificar historial
  let historialUnificado = [
    ...ventas.map((v) => ({ ...v, tipoRegistro: "Venta" })),
    ...facturas.map((f) => ({ ...f, tipoRegistro: "Ingreso" })),
  ];

  // Filtrar por tipo
  if (filtros.tipo !== "Todos") {
    historialUnificado = historialUnificado.filter(
      (h) => h.tipoRegistro === filtros.tipo,
    );
  }

  // Filtrar por fechas
  if (filtros.desde)
    historialUnificado = historialUnificado.filter(
      (h) => new Date(h.fecha) >= new Date(filtros.desde + "T00:00:00"),
    );
  if (filtros.hasta)
    historialUnificado = historialUnificado.filter(
      (h) => new Date(h.fecha) <= new Date(filtros.hasta + "T23:59:59"),
    );

  // Ordenar
  historialUnificado.sort((a, b) =>
    filtros.orden === "desc"
      ? new Date(b.fecha) - new Date(a.fecha)
      : new Date(a.fecha) - new Date(b.fecha),
  );

  const abrirDetalle = (registro) => {
    if (registro.tipoRegistro === "Venta") {
      const items = detallesVentas.filter((d) => d.venta_id === registro.id);
      setDetalle({ ...registro, items });
    } else {
      const items = detallesFacturas.filter(
        (d) => d.factura_id === registro.id,
      );
      setDetalle({ ...registro, items });
    }
  };

  return (
    <div>
      <div className="barra-filtros">
        <select
          value={filtros.tipo}
          onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
        >
          <option value="Todos">Todos los registros</option>
          <option value="Venta">Solo Ventas</option>
          <option value="Ingreso">Solo Facturas de Ingreso</option>
        </select>
        <select
          value={filtros.orden}
          onChange={(e) => setFiltros({ ...filtros, orden: e.target.value })}
        >
          <option value="desc">Más recientes</option>
          <option value="asc">Más antiguos</option>
        </select>
        <input
          type="date"
          value={filtros.desde}
          onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
        />
        <input
          type="date"
          value={filtros.hasta}
          onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
        />
      </div>

      <table>
        <thead>
          <tr>
            <th>N°</th>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {historialUnificado.map((h) => {
            const esIngreso = h.tipoRegistro === "Ingreso";
            return (
              <tr
                key={`${h.tipoRegistro}-${h.id}`}
                onClick={() => abrirDetalle(h)}
                style={{ cursor: "pointer" }}
              >
                <td>#{h.id}</td>
                <td>{new Date(h.fecha).toLocaleString()}</td>
                <td>
                  <span
                    className={esIngreso ? "badge-ingreso" : "badge-pago"}
                    style={
                      esIngreso
                        ? { backgroundColor: "#d1c4e9", color: "#4a148c" }
                        : {}
                    }
                  >
                    {esIngreso ? "FACTURA DE INGRESO" : "VENTA"}
                  </span>
                </td>
                <td
                  style={{
                    color: esIngreso ? "#8e44ad" : "var(--success)",
                    fontWeight: "bold",
                  }}
                >
                  ${h.total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {detalle && (
        <div className="modal-overlay active">
          <div className="modal-contenido">
            <h3>
              {detalle.tipoRegistro === "Ingreso"
                ? "Factura de Ingreso"
                : "Venta"}{" "}
              #{detalle.id}
            </h3>
            <p>{new Date(detalle.fecha).toLocaleString()}</p>

            <table style={{ marginTop: "10px", marginBottom: "20px" }}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cant</th>
                  <th>Precio U.</th>
                </tr>
              </thead>
              <tbody>
                {detalle.items.map((d, i) => (
                  <tr key={i}>
                    <td>{d.nombre_producto}</td>
                    <td>{d.cantidad}</td>
                    <td>${d.precio_unitario}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3
              style={{
                color:
                  detalle.tipoRegistro === "Ingreso"
                    ? "#8e44ad"
                    : "var(--success)",
              }}
            >
              Total: ${detalle.total}
            </h3>

            <div className="modal-botones">
              <button className="btn-primario" onClick={() => setDetalle(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
