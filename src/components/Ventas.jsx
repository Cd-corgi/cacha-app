import { useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

// Función para quitar tildes y mayúsculas
const normalizarTexto = (texto) => {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

// Diccionario de números escritos a su valor numérico
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
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
};

// Palabras que el tendero dice pero que no son parte del nombre del producto
const palabrasRelleno = [
  "quiero",
  "quisiera",
  "necesito",
  "agregar",
  "agrega",
  "agregame",
  "anadir",
  "anade",
  "dame",
  "deme",
  "regalame",
  "por",
  "favor",
  "de",
  "del",
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "x",
  "veces",
  "unidades",
  "cantidad",
  "y",
];

// Extrae la cantidad y el nombre limpio del producto
const extraerCantidadYProducto = (textoOriginal) => {
  const textoNorm = normalizarTexto(textoOriginal);
  let palabras = textoNorm.split(" ");
  let cantidad = 1; // Por defecto, 1 unidad
  let indexNumero = -1;

  // 1. Buscar un número (ya sea "2" o "dos") en cualquier posición
  for (let i = 0; i < palabras.length; i++) {
    const palabra = palabras[i];
    if (/^\d+$/.test(palabra)) {
      cantidad = parseInt(palabra, 10);
      indexNumero = i;
      break;
    } else if (numerosPalabras[palabra]) {
      cantidad = numerosPalabras[palabra];
      indexNumero = i;
      break;
    }
  }

  // 2. Si se encontró un número, eliminarlo de la lista de palabras
  if (indexNumero !== -1) {
    palabras.splice(indexNumero, 1);
  }

  // 3. Eliminar las palabras de relleno y palabras muy cortas
  palabras = palabras.filter(
    (p) => !palabrasRelleno.includes(p) && p.length > 1,
  );

  return { cantidad, textoLimpio: palabras.join(" ") };
};

export default function Ventas() {
  const [carrito, setCarrito] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [escuchando, setEscuchando] = useState(false);
  const [mostrarLista, setMostrarLista] = useState(false);

  const recognitionRef = useRef(null);
  const cantidadInputRef = useRef(null);

  const productos = useLiveQuery(() => db.productos.toArray()) || [];

  // --- LÓGICA DE VOZ MEJORADA ---
  const iniciarVoz = async () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Reconocimiento de voz no soportado.");

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      return alert("⚠️ Permite el acceso al micrófono.");
    }

    if (escuchando && recognitionRef.current) {
      recognitionRef.current.stop();
      setEscuchando(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-CO";
    recognition.interimResults = false;

    recognition.onstart = () => setEscuchando(true);

    recognition.onresult = (event) => {
      const textoOriginal = event.results[0][0].transcript;
      console.log("Voz detectada:", textoOriginal);

      // Extraer cantidad y nombre del producto
      const { cantidad: cantidadDictada, textoLimpio } =
        extraerCantidadYProducto(textoOriginal);
      const textoNorm = normalizarTexto(textoLimpio);

      if (!textoNorm) {
        return alert(
          "No se entendió el nombre del producto. Intenta de nuevo.",
        );
      }

      // Función interna para buscar productos (estricta y laxa)
      const buscarProductos = (estricto = true) => {
        return productos.filter((p) => {
          if (p.stock <= 0) return false;
          const nombreNorm = normalizarTexto(p.nombre);

          if (estricto) {
            if (nombreNorm.includes(textoNorm)) return true;
            const palabrasClave = textoNorm
              .split(" ")
              .filter((p) => p.length > 2);
            if (
              palabrasClave.length > 0 &&
              palabrasClave.every((palabra) => nombreNorm.includes(palabra))
            )
              return true;
          } else {
            const palabrasClave = textoNorm
              .split(" ")
              .filter((p) => p.length > 2);
            if (palabrasClave.some((palabra) => nombreNorm.includes(palabra)))
              return true;
            if (textoNorm.includes(nombreNorm)) return true;
          }
          return false;
        });
      };

      // Buscar estricto, si falla, buscar laxo
      let coincidencias = buscarProductos(true);
      if (coincidencias.length === 0) coincidencias = buscarProductos(false);

      if (coincidencias.length === 1) {
        const prod = coincidencias[0];

        // Verificar que haya stock suficiente para la cantidad dictada
        if (cantidadDictada > prod.stock) {
          return alert(
            `No hay suficiente stock de ${prod.nombre}. Solo quedan ${prod.stock} unidades.`,
          );
        }

        // Agregar al carrito con la cantidad dictada
        const existe = carrito.find((item) => item.id === prod.id);
        if (existe) {
          const nuevaCantidad = existe.cantidad + cantidadDictada;
          if (nuevaCantidad > prod.stock) {
            return alert(
              `No hay suficiente stock. Ya tienes ${existe.cantidad} en el carrito y el stock es ${prod.stock}.`,
            );
          }
          setCarrito(
            carrito.map((item) =>
              item.id === prod.id ? { ...item, cantidad: nuevaCantidad } : item,
            ),
          );
        } else {
          setCarrito([...carrito, { ...prod, cantidad: cantidadDictada }]);
        }

        // Feedback visual y de voz
        setBusqueda("");
        setMostrarLista(false);

        if ("speechSynthesis" in window) {
          const msg = new SpeechSynthesisUtterance(
            `${cantidadDictada} ${prod.nombre} agregado${cantidadDictada > 1 ? "s" : ""}.`,
          );
          msg.lang = "es-CO";
          window.speechSynthesis.speak(msg);
        } else {
          alert(`✅ ${cantidadDictada} ${prod.nombre} agregado(s) al carrito.`);
        }
      } else if (coincidencias.length > 1) {
        setBusqueda(textoLimpio);
        setMostrarLista(true);
        alert(
          `Se encontraron varios productos que coinciden. Por favor, selecciona uno de la lista.`,
        );
      } else {
        alert(`❌ No se encontró ningún producto con "${textoLimpio}".`);
      }
    };

    recognition.onerror = () => setEscuchando(false);
    recognition.onend = () => setEscuchando(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  // --- LÓGICA DEL CARRITO (AGREGAR MANUAL) ---
  const agregarAlCarrito = () => {
    const prod = productos.find((p) => p.nombre === busqueda);
    if (!prod) return alert("Seleccione un producto válido de la lista");
    if (cantidad > prod.stock)
      return alert(`No hay suficiente stock. Solo quedan ${prod.stock}.`);

    const existe = carrito.find((item) => item.id === prod.id);
    if (existe) {
      const nuevaCantidad = existe.cantidad + cantidad;
      if (nuevaCantidad > prod.stock)
        return alert(
          `No hay suficiente stock. Ya tienes ${existe.cantidad} en el carrito y el stock es ${prod.stock}.`,
        );
      setCarrito(
        carrito.map((item) =>
          item.id === prod.id ? { ...item, cantidad: nuevaCantidad } : item,
        ),
      );
    } else {
      setCarrito([...carrito, { ...prod, cantidad }]);
    }

    setBusqueda("");
    setCantidad(1);
    setMostrarLista(false);
    setTimeout(() => document.getElementById("input-busqueda")?.focus(), 50);
  };

  const finalizarVenta = async () => {
    if (carrito.length === 0) return alert("El carrito está vacío");
    const total = carrito.reduce(
      (acc, item) => acc + item.precio * item.cantidad,
      0,
    );

    try {
      await db.transaction(
        "rw",
        [db.ventas, db.detalle_ventas, db.productos],
        async () => {
          const ventaId = await db.ventas.add({
            fecha: new Date().toISOString(),
            total,
            metodo_pago: metodoPago,
          });

          for (const item of carrito) {
            await db.detalle_ventas.add({
              venta_id: ventaId,
              producto_id: item.id,
              nombre_producto: item.nombre,
              cantidad: item.cantidad,
              precio_unitario: item.precio,
            });
            await db.productos.update(item.id, {
              stock: item.stock - item.cantidad,
            });
          }
        },
      );

      alert("✅ Venta registrada exitosamente");
      setCarrito([]);
    } catch (error) {
      console.error(error);
      alert("❌ Error al registrar venta");
    }
  };

  const productosFiltrados = productos.filter(
    (p) =>
      p.stock > 0 &&
      normalizarTexto(p.nombre).includes(normalizarTexto(busqueda)),
  );

  const totalVenta = carrito.reduce(
    (acc, item) => acc + item.precio * item.cantidad,
    0,
  );

  return (
    <div className="tab-content">
      <div className="panel-venta">
        <div className="form-venta">
          <h2>Agregar Producto</h2>

          <div className="input-group buscador-container">
            <label>Producto:</label>
            <input
              id="input-busqueda"
              className="venta-producto-input"
              type="text"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setMostrarLista(true);
              }}
              onFocus={() => setMostrarLista(true)}
              onBlur={() => {
                setTimeout(() => setMostrarLista(false), 150);
              }}
              placeholder="Escriba o dicte: 'Quiero 2 panes'"
              autoComplete="off"
            />

            {mostrarLista && busqueda && productosFiltrados.length > 0 && (
              <ul className="lista-resultados">
                {productosFiltrados.map((p) => (
                  <li
                    key={p.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setBusqueda(p.nombre);
                      setMostrarLista(false);
                      setTimeout(() => cantidadInputRef.current?.focus(), 50);
                    }}
                  >
                    <span className="res-nombre">{p.nombre}</span>
                    <div className="res-info">
                      <span className="res-precio">${p.precio}</span>
                      <span
                        className={`res-stock ${p.stock <= 5 ? "res-stock-bajo" : ""}`}
                      >
                        Stock: {p.stock}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="input-group">
            <label>Cantidad:</label>
            <input
              ref={cantidadInputRef}
              id="input-cantidad"
              type="number"
              value={cantidad}
              onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
              min="1"
            />
          </div>

          <div className="acciones-venta">
            <button className="btn-add" onClick={agregarAlCarrito}>
              ➕ Añadir a la lista
            </button>
            <button
              className={`btn-voz-busqueda ${escuchando ? "escuchando" : ""}`}
              onClick={iniciarVoz}
            >
              {escuchando ? "🔴 Escuchando..." : "🎤 Buscar por voz"}
            </button>
          </div>
        </div>

        <div className="carrito-container">
          <h2>Productos en esta venta</h2>
          <table className="tabla-carrito">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cant.</th>
                <th>Subtotal</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {carrito.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center" }}>
                    No hay productos aún
                  </td>
                </tr>
              ) : (
                carrito.map((item, i) => (
                  <tr key={i}>
                    <td>{item.nombre}</td>
                    <td>{item.cantidad}</td>
                    <td>${item.precio * item.cantidad}</td>
                    <td>
                      <button
                        className="btn-accion btn-eliminar"
                        onClick={() =>
                          setCarrito(carrito.filter((_, idx) => idx !== i))
                        }
                      >
                        ❌
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <h3 className="total-venta">Total: ${totalVenta}</h3>
        </div>
      </div>

      <div className="cobro-container">
        <div className="cobro-metodo">
          <label>Método de Pago:</label>
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
          >
            <option value="Efectivo">💵 Efectivo</option>
            <option value="Nequi">📱 Nequi</option>
            <option value="Daviplata">📱 Daviplata</option>
            <option value="Transferencia">🏦 Transferencia</option>
          </select>
        </div>
        <button className="btn-cobrar" onClick={finalizarVenta}>
          ✅ COBRAR Y REGISTRAR VENTA
        </button>
      </div>
    </div>
  );
}
