import { useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

// Diccionario para convertir números hablados a dígitos
const numerosPalabras = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  veinte: 20,
};

export default function Inventario() {
  const [nuevoProd, setNuevoProd] = useState({
    nombre: "",
    precio: "",
    stock: "",
    fecha_vencimiento: "",
  });
  const [orden, setOrden] = useState("fifo");
  const [editando, setEditando] = useState(null);

  // --- ESTADOS PARA EL MODAL DE CARGA MASIVA ---
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkItems, setBulkItems] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");

  const productos = useLiveQuery(() => db.productos.toArray()) || [];

  const guardarProducto = async () => {
    if (!nuevoProd.nombre || !nuevoProd.precio || !nuevoProd.stock)
      return alert("Llene los campos");
    await db.productos.add({
      nombre: nuevoProd.nombre,
      precio: parseFloat(nuevoProd.precio),
      stock: parseInt(nuevoProd.stock),
      fecha_vencimiento: nuevoProd.fecha_vencimiento || "Sin fecha",
    });
    setNuevoProd({ nombre: "", precio: "", stock: "", fecha_vencimiento: "" });
  };

  const eliminarProducto = async (id) => {
    if (window.confirm("¿Eliminar producto del inventario?")) {
      await db.productos.delete(id);
    }
  };

  const guardarEdicion = async () => {
    await db.productos.update(editando.id, editando);
    setEditando(null);
  };

  // --- PARSER INTELIGENTE DE TEXTO ---
  const procesarDictado = (texto) => {
    if (!texto) return;

    let textoLimpio = texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.,]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    Object.keys(numerosPalabras).forEach((palabra) => {
      const regex = new RegExp(`\\b${palabra}\\b`, "g");
      textoLimpio = textoLimpio.replace(regex, numerosPalabras[palabra]);
    });

    const partes = textoLimpio.split(/(\d+)/);
    const nuevosItems = [];

    for (let i = 1; i < partes.length; i += 2) {
      const cantidad = parseInt(partes[i]);
      let nombreProducto = partes[i + 1] ? partes[i + 1].trim() : "";

      nombreProducto = nombreProducto
        .replace(
          /\b(quiero|agrega|anade|dame|por|favor|de|del|la|el|los|las|y|e|mas)\b/g,
          "",
        )
        .replace(/\s+/g, " ")
        .trim();

      if (nombreProducto.length > 2) {
        nuevosItems.push({
          nombre:
            nombreProducto.charAt(0).toUpperCase() + nombreProducto.slice(1),
          cantidad: cantidad,
          precio: "",
          fecha_vencimiento: "", // <-- NUEVO CAMPO AÑADIDO AQUÍ
        });
      }
    }

    if (nuevosItems.length > 0) {
      setBulkItems((prev) => [...prev, ...nuevosItems]);
    } else {
      alert(
        "No se entendió ningún producto. Intenta decir: '5 panes, 2 leches'.",
      );
    }
  };

  const iniciarDictadoMasivo = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Reconocimiento de voz no soportado.");

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-CO";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript("");
      transcriptRef.current = "";
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (final) transcriptRef.current += final;
      setTranscript(transcriptRef.current + interim);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (transcriptRef.current.trim()) {
        procesarDictado(transcriptRef.current);
        setTranscript("");
        transcriptRef.current = "";
      }
    };

    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  // --- MANEJO DE LA TABLA DE PENDIENTES ---
  const actualizarCampo = (index, campo, valor) => {
    const nuevos = [...bulkItems];
    nuevos[index][campo] = valor;
    setBulkItems(nuevos);
  };

  const eliminarItemPendiente = (index) => {
    setBulkItems(bulkItems.filter((_, i) => i !== index));
  };

  const totalFactura = bulkItems.reduce(
    (acc, item) => acc + (parseFloat(item.precio) || 0) * item.cantidad,
    0,
  );

  const aprobarFactura = async () => {
    if (bulkItems.length === 0) return alert("No hay productos en la lista.");
    if (
      bulkItems.some((item) => !item.precio || parseFloat(item.precio) <= 0)
    ) {
      return alert(
        "Por favor, asigne un precio válido a todos los productos antes de aprobar.",
      );
    }

    try {
      await db.transaction(
        "rw",
        [db.productos, db.facturas_ingreso, db.detalle_facturas],
        async () => {
          const facturaId = await db.facturas_ingreso.add({
            fecha: new Date().toISOString(),
            total: totalFactura,
          });

          for (const item of bulkItems) {
            await db.detalle_facturas.add({
              factura_id: facturaId,
              nombre_producto: item.nombre,
              cantidad: item.cantidad,
              precio_unitario: parseFloat(item.precio),
            });

            const prodExistente = await db.productos
              .where("nombre")
              .equalsIgnoreCase(item.nombre)
              .first();

            if (prodExistente) {
              // Si el producto existe, sumamos stock y actualizamos fecha si se proporcionó una nueva
              const nuevaFecha = item.fecha_vencimiento
                ? item.fecha_vencimiento
                : prodExistente.fecha_vencimiento;
              await db.productos.update(prodExistente.id, {
                stock: prodExistente.stock + item.cantidad,
                fecha_vencimiento: nuevaFecha,
              });
            } else {
              // Si no existe, lo creamos con la fecha proporcionada
              await db.productos.add({
                nombre: item.nombre,
                precio: parseFloat(item.precio),
                stock: item.cantidad,
                fecha_vencimiento: item.fecha_vencimiento || "Sin fecha",
              });
            }
          }
        },
      );

      alert("✅ Factura de ingreso registrada y stock actualizado.");
      setBulkItems([]);
      setShowBulkModal(false);
    } catch (error) {
      console.error(error);
      alert("❌ Error al registrar la factura de ingreso.");
    }
  };

  let prodsMostrar = [...productos];
  if (orden === "fifo")
    prodsMostrar.sort((a, b) =>
      a.fecha_vencimiento === "Sin fecha"
        ? 1
        : new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento),
    );
  if (orden === "nombre")
    prodsMostrar.sort((a, b) => a.nombre.localeCompare(b.nombre));
  if (orden === "stock-asc") prodsMostrar.sort((a, b) => a.stock - b.stock);
  if (orden === "stock-desc") prodsMostrar.sort((a, b) => b.stock - a.stock);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h2>Inventario Actual</h2>
        <button
          className="btn-primario"
          style={{ backgroundColor: "#8e44ad" }}
          onClick={() => setShowBulkModal(true)}
        >
          📦 Factura de Ingreso
        </button>
      </div>

      <div className="card">
        <h3>Añadir Producto Individual</h3>
        <div className="form-grid">
          <input
            type="text"
            placeholder="Nombre"
            value={nuevoProd.nombre}
            onChange={(e) =>
              setNuevoProd({ ...nuevoProd, nombre: e.target.value })
            }
          />
          <input
            type="number"
            placeholder="Precio Venta"
            value={nuevoProd.precio}
            onChange={(e) =>
              setNuevoProd({ ...nuevoProd, precio: e.target.value })
            }
          />
          <input
            type="number"
            placeholder="Stock"
            value={nuevoProd.stock}
            onChange={(e) =>
              setNuevoProd({ ...nuevoProd, stock: e.target.value })
            }
          />
          <input
            type="date"
            value={nuevoProd.fecha_vencimiento}
            onChange={(e) =>
              setNuevoProd({ ...nuevoProd, fecha_vencimiento: e.target.value })
            }
          />
        </div>
        <button className="btn-primario" onClick={guardarProducto}>
          Guardar Producto
        </button>
      </div>

      <div className="barra-filtros">
        <label>Organizar por: </label>
        <select value={orden} onChange={(e) => setOrden(e.target.value)}>
          <option value="fifo">Vencimiento (FIFO)</option>
          <option value="nombre">Nombre (A-Z)</option>
          <option value="stock-asc">Menor Stock</option>
          <option value="stock-desc">Mayor Stock</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Vence</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {prodsMostrar.map((p) => (
            <tr key={p.id}>
              <td>{p.nombre}</td>
              <td>${p.precio}</td>
              <td
                style={{
                  color: p.stock <= 5 ? "red" : "inherit",
                  fontWeight: p.stock <= 5 ? "bold" : "normal",
                }}
              >
                {p.stock}
              </td>
              <td>{p.fecha_vencimiento}</td>
              <td>
                <button
                  className="btn-accion btn-editar"
                  onClick={() => setEditando(p)}
                >
                  ✏️
                </button>
                <button
                  className="btn-accion btn-eliminar"
                  onClick={() => eliminarProducto(p.id)}
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* MODAL DE EDICIÓN INDIVIDUAL */}
      {editando && (
        <div className="modal-overlay active">
          <div className="modal-contenido">
            <h3>Editar Producto</h3>
            <input
              type="text"
              value={editando.nombre}
              onChange={(e) =>
                setEditando({ ...editando, nombre: e.target.value })
              }
            />
            <input
              type="number"
              value={editando.precio}
              onChange={(e) =>
                setEditando({ ...editando, precio: parseFloat(e.target.value) })
              }
            />
            <input
              type="number"
              value={editando.stock}
              onChange={(e) =>
                setEditando({ ...editando, stock: parseInt(e.target.value) })
              }
            />
            <input
              type="date"
              value={
                editando.fecha_vencimiento !== "Sin fecha"
                  ? editando.fecha_vencimiento
                  : ""
              }
              onChange={(e) =>
                setEditando({ ...editando, fecha_vencimiento: e.target.value })
              }
            />
            <div className="modal-botones">
              <button
                className="btn-cancelar"
                onClick={() => setEditando(null)}
              >
                Cancelar
              </button>
              <button className="btn-primario" onClick={guardarEdicion}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CARGA MASIVA (FACTURA DE INGRESO) */}
      {showBulkModal && (
        <div className="modal-overlay active">
          {/* Aumenté el maxWidth a 950px para que quepa bien la nueva columna */}
          <div
            className="modal-contenido"
            style={{ width: "95%", maxWidth: "950px", textAlign: "left" }}
          >
            <h2 style={{ textAlign: "center", color: "#8e44ad" }}>
              📦 Factura de Ingreso (Carga Masiva)
            </h2>

            <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
              <button
                className={`btn-voz-busqueda ${isListening ? "escuchando" : ""}`}
                style={{
                  backgroundColor: isListening ? "#e74c3c" : "#8e44ad",
                  flex: 1,
                }}
                onClick={iniciarDictadoMasivo}
              >
                {isListening
                  ? "🔴 Escuchando... (Hable ahora y espere)"
                  : "🎤 Dictar Productos y Cantidades"}
              </button>
            </div>

            {transcript && (
              <div
                style={{
                  padding: "10px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "5px",
                  marginBottom: "15px",
                  fontStyle: "italic",
                  color: "#555",
                }}
              >
                Escuchando: "{transcript}"
              </div>
            )}

            {bulkItems.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ marginTop: "0", minWidth: "800px" }}>
                  <thead>
                    <tr>
                      <th>Producto (Dictado)</th>
                      <th style={{ width: "80px", textAlign: "center" }}>
                        Cant.
                      </th>
                      <th style={{ width: "120px" }}>Precio Unit. ($)</th>
                      <th style={{ width: "150px" }}>Vencimiento</th>
                      <th style={{ width: "100px" }}>Subtotal</th>
                      <th style={{ width: "60px", textAlign: "center" }}>
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkItems.map((item, index) => (
                      <tr key={index}>
                        <td>
                          <input
                            type="text"
                            value={item.nombre}
                            onChange={(e) =>
                              actualizarCampo(index, "nombre", e.target.value)
                            }
                            style={{ padding: "8px", width: "100%" }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) =>
                              actualizarCampo(
                                index,
                                "cantidad",
                                parseInt(e.target.value) || 1,
                              )
                            }
                            min="1"
                            style={{
                              padding: "8px",
                              textAlign: "center",
                              width: "100%",
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={item.precio}
                            onChange={(e) =>
                              actualizarCampo(index, "precio", e.target.value)
                            }
                            placeholder="0.00"
                            style={{ padding: "8px", width: "100%" }}
                          />
                        </td>
                        <td>
                          {/* NUEVO INPUT DE FECHA */}
                          <input
                            type="date"
                            value={item.fecha_vencimiento}
                            onChange={(e) =>
                              actualizarCampo(
                                index,
                                "fecha_vencimiento",
                                e.target.value,
                              )
                            }
                            style={{ padding: "8px", width: "100%" }}
                          />
                        </td>
                        <td>
                          $
                          {(
                            (parseFloat(item.precio) || 0) * item.cantidad
                          ).toFixed(2)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            className="btn-accion btn-eliminar"
                            onClick={() => eliminarItemPendiente(index)}
                          >
                            ❌
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                style={{ textAlign: "center", padding: "20px", color: "#888" }}
              >
                No hay productos en la lista. Usa el botón de dictado o añade
                manualmente.
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "20px",
                borderTop: "2px solid #eee",
                paddingTop: "15px",
              }}
            >
              <h3 style={{ margin: 0 }}>
                Total Factura:{" "}
                <span style={{ color: "#27ae60" }}>
                  ${totalFactura.toFixed(2)}
                </span>
              </h3>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="btn-cancelar"
                  onClick={() => {
                    setShowBulkModal(false);
                    setBulkItems([]);
                  }}
                >
                  Rechazar / Cerrar
                </button>
                <button
                  className="btn-primario"
                  onClick={aprobarFactura}
                  style={{ backgroundColor: "#27ae60" }}
                >
                  ✅ Aprobar e Ingresar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
