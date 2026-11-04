// --- VARIABLES GLOBALES ---
let carrito = [];
let listaProductosGlobal = []; // Guardamos los productos aquí para buscarlos rápido

// --- NAVEGACIÓN ---
function showTab(tabId, btn) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  btn.classList.add("active");

  if (tabId === "ventas") cargarProductosSelect();
  if (tabId === "inventario") cargarInventario();
  if (tabId === "fiados") cargarFiados();
  if (tabId === "historial") cargarHistorialVentas();
  if (tabId === "caja") cargarCaja(); // <-- AÑADE ESTA LÍNEA
}

// --- UTILIDADES ---
// Función para quitar tildes y pasar a minúsculas
function normalizarTexto(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// --- LÓGICA DE VENTAS (CARRITO) ---
async function cargarProductosSelect() {
  const productos = await window.api.getProductos();
  listaProductosGlobal = productos.filter((p) => p.stock > 0); // Solo los que tienen stock

  const select = document.getElementById("venta-producto");
  select.innerHTML = '<option value="">Seleccione un producto...</option>';

  listaProductosGlobal.forEach((p) => {
    select.innerHTML += `<option value="${p.id}" data-precio="${p.precio}" data-nombre="${p.nombre}" data-stock="${p.stock}">
            ${p.nombre} (Stock: ${p.stock}) - $${p.precio}
        </option>`;
  });
}

async function agregarFiado() {
  const cliente = document.getElementById("fiado-cliente").value.trim();
  const montoInput = document.getElementById("fiado-monto").value;
  const monto = parseFloat(montoInput);

  // Validación estricta
  if (!cliente || isNaN(monto) || monto <= 0) {
    return alert(
      "⚠️ Por favor, ingrese un nombre válido y un monto mayor a 0.",
    );
  }

  try {
    // Intentar guardar en la base de datos
    await window.api.addFiado({ cliente, monto });

    // Si funciona, limpiamos y recargamos
    alert("✅ Fiado registrado correctamente.");
    document.getElementById("fiado-cliente").value = "";
    document.getElementById("fiado-monto").value = "";
    cargarFiados();
  } catch (error) {
    // Si falla, mostramos el error en pantalla
    console.error("Error al guardar fiado:", error);
    alert("❌ Error al guardar el fiado: " + error.message);
  }
}

function agregarAlCarrito() {
  const select = document.getElementById("venta-producto");
  const cantidadInput = document.getElementById("venta-cantidad");

  if (select.value === "") return alert("Seleccione un producto primero.");

  const cantidad = parseInt(cantidadInput.value);
  if (cantidad <= 0) return alert("La cantidad debe ser mayor a 0");

  const option = select.options[select.selectedIndex];
  const id = select.value;
  const nombre = option.getAttribute("data-nombre");
  const precio = parseFloat(option.getAttribute("data-precio"));
  const stockDisponible = parseInt(option.getAttribute("data-stock"));

  if (cantidad > stockDisponible) {
    return alert(
      `No hay suficiente stock. Solo quedan ${stockDisponible} unidades.`,
    );
  }

  const itemExistente = carrito.find((item) => item.id === id);
  if (itemExistente) {
    if (itemExistente.cantidad + cantidad > stockDisponible) {
      return alert("Supera el stock disponible en tienda.");
    }
    itemExistente.cantidad += cantidad;
  } else {
    carrito.push({ id, nombre, precio, cantidad, stockDisponible });
  }

  cantidadInput.value = 1;
  actualizarTablaCarrito();

  // Devolver el select a la opción por defecto
  select.value = "";
}

function actualizarTablaCarrito() {
  const tbody = document.querySelector("#tabla-carrito tbody");
  tbody.innerHTML = "";
  let total = 0;

  carrito.forEach((item, index) => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;
    tbody.innerHTML += `<tr>
            <td>${item.nombre}</td>
            <td>${item.cantidad}</td>
            <td>$${item.precio}</td>
            <td>$${subtotal}</td>
            <td><button class="btn-eliminar" onclick="quitarDelCarrito(${index})">X</button></td>
        </tr>`;
  });

  document.getElementById("total-venta").innerText = `Total: $${total}`;
}

function quitarDelCarrito(index) {
  carrito.splice(index, 1);
  actualizarTablaCarrito();
}

async function finalizarVenta() {
  if (carrito.length === 0)
    return alert("El carrito está vacío. Agregue productos primero.");

  const metodo = document.getElementById("venta-metodo").value;
  const total = carrito.reduce(
    (sum, item) => sum + item.precio * item.cantidad,
    0,
  );

  const ventaData = {
    total: total,
    metodo_pago: metodo,
    items: carrito,
  };

  const respuesta = await window.api.procesarVenta(ventaData);

  if (respuesta.success) {
    alert("✅ Venta registrada y stock descontado exitosamente.");
    carrito = [];
    actualizarTablaCarrito();
    cargarProductosSelect();
  } else {
    alert("❌ Error al registrar la venta: " + respuesta.error);
  }
}

// --- BÚSQUEDA POR VOZ ---
function buscarProductoPorVoz() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert(
      "El reconocimiento de voz no está disponible en este equipo. Use el buscador manual.",
    );
    return;
  }

  const btn = document.getElementById("btn-voz-busqueda");
  const recognition = new SpeechRecognition();
  recognition.lang = "es-CO";
  recognition.interimResults = false;

  // Cambiar apariencia del botón
  btn.innerText = "🎤 Escuchando...";
  btn.classList.add("escuchando");

  recognition.start();

  recognition.onresult = (event) => {
    const textoDictado = event.results[0][0].transcript;
    const textoNormalizado = normalizarTexto(textoDictado);

    btn.innerText = "🎤 Buscar por voz";
    btn.classList.remove("escuchando");

    // Buscar coincidencias en la lista de productos
    const coincidencias = listaProductosGlobal.filter((p) =>
      normalizarTexto(p.nombre).includes(textoNormalizado),
    );

    const select = document.getElementById("venta-producto");

    if (coincidencias.length === 1) {
      // Si hay exactamente 1 coincidencia, lo seleccionamos automáticamente
      select.value = coincidencias[0].id;
      alert(
        `Producto encontrado: ${coincidencias[0].nombre}. Ahora ingrese la cantidad.`,
      );
      document.getElementById("venta-cantidad").focus();
    } else if (coincidencias.length > 1) {
      // Si hay varias, avisamos para que elija manual
      alert(
        `Se encontraron varios productos que suenan como "${textoDictado}". Por favor, elíjalo en la lista manualmente.`,
      );
      // Opcional: Podríamos filtrar el select aquí, pero para no confundir al tendero, es mejor solo avisar.
    } else {
      alert(
        `No se encontró ningún producto llamado "${textoDictado}". Intente dictar solo el nombre base (Ej: "Leche").`,
      );
    }
  };

  recognition.onerror = (event) => {
    btn.innerText = "🎤 Buscar por voz";
    btn.classList.remove("escuchando");
    if (event.error === "not-allowed") {
      alert(
        "Permiso de micrófono denegado. Habilítelo en la configuración de su equipo.",
      );
    } else if (event.error === "network") {
      alert(
        "Sin conexión a internet. El buscador por voz de Chromium requiere internet. Use el menú manual.",
      );
    } else {
      alert("Error al escuchar. Intente de nuevo.");
    }
  };

  recognition.onend = () => {
    btn.innerText = "🎤 Buscar por voz";
    btn.classList.remove("escuchando");
  };
}

// --- LÓGICA INVENTARIO ---
async function agregarProducto() {
  const nombre = document.getElementById("prod-nombre").value;
  const precio = parseFloat(document.getElementById("prod-precio").value);
  const stock = parseInt(document.getElementById("prod-stock").value);
  const fecha = document.getElementById("prod-fecha").value;

  if (!nombre || !precio || !stock)
    return alert("Por favor, llene todos los campos obligatorios.");

  await window.api.addProducto({
    nombre,
    precio,
    stock,
    fecha_vencimiento: fecha || "Sin fecha",
  });
  alert("✅ Producto añadido al inventario");

  document.getElementById("prod-nombre").value = "";
  document.getElementById("prod-precio").value = "";
  document.getElementById("prod-stock").value = "";
  document.getElementById("prod-fecha").value = "";

  cargarInventario();
  cargarProductosSelect();
}

async function cargarInventario() {
  const productos = await window.api.getProductos();
  const tbody = document.querySelector("#tabla-inventario tbody");
  tbody.innerHTML = "";

  productos.forEach((p) => {
    let stockStyle = p.stock <= 5 ? 'style="color:red; font-weight:bold;"' : "";
    tbody.innerHTML += `<tr>
            <td>${p.nombre}</td>
            <td>$${p.precio}</td>
            <td ${stockStyle}>${p.stock}</td>
            <td>${p.fecha_vencimiento}</td>
        </tr>`;
  });
}

// --- LÓGICA FIADOS ---
async function cargarFiados() {
  const fiados = await window.api.getFiados();
  const tbody = document.querySelector("#tabla-fiados tbody");
  tbody.innerHTML = "";

  if (fiados.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" style="text-align:center;">No hay deudas pendientes. ¡Todo al día!</td></tr>';
    return;
  }

  fiados.forEach((f) => {
    tbody.innerHTML += `<tr>
            <td>${f.cliente}</td>
            <td>$${f.monto}</td>
            <td>${f.fecha}</td>
            <td class="col-acciones">
                <button class="btn-accion btn-sumar" onclick="modificarFiado(${f.id}, ${f.monto}, 'sumar')" title="Aumentar deuda">➕</button>
                <button class="btn-accion btn-restar" onclick="modificarFiado(${f.id}, ${f.monto}, 'restar')" title="Abonar a la deuda">➖</button>
                <button class="btn-accion btn-eliminar" onclick="eliminarFiado(${f.id})" title="Eliminar (Ya pagó o se perdió)">🗑️</button>
            </td>
        </tr>`;
  });
}

async function modificarFiado(id, montoActual, accion) {
  let mensaje =
    accion === "sumar"
      ? "¿Cuánto desea SUMAR a la deuda?"
      : "¿Cuánto ABONÓ el cliente? (Se restará de la deuda)";

  let valor = prompt(mensaje, "0");
  if (valor === null) return; // Si el tendero presiona "Cancelar"

  let monto = parseFloat(valor);
  if (isNaN(monto) || monto <= 0) {
    return alert("Por favor, ingrese un número válido mayor a 0.");
  }

  let nuevoMonto =
    accion === "sumar" ? montoActual + monto : montoActual - monto;

  if (nuevoMonto < 0) {
    return alert("❌ El abono no puede ser mayor al monto de la deuda actual.");
  }

  if (nuevoMonto === 0) {
    if (
      confirm("✅ La deuda ha llegado a $0. ¿Desea eliminarla de la lista?")
    ) {
      await window.api.deleteFiado(id);
      cargarFiados();
    }
    return;
  }

  // Actualizar en la base de datos
  await window.api.updateFiado({ id: id, monto: nuevoMonto });
  cargarFiados();
}

async function eliminarFiado(id) {
  if (
    confirm(
      "⚠️ ¿Está seguro de eliminar este fiado de la lista? (Ya sea porque pagó o porque se da por perdido)",
    )
  ) {
    await window.api.deleteFiado(id);
    cargarFiados();
  }
}

async function modificarFiado(id, montoActual, accion) {
  let mensaje =
    accion === "sumar"
      ? "¿Cuánto desea SUMAR a la deuda?"
      : "¿Cuánto ABONÓ el cliente? (Se restará de la deuda)";

  let valor = prompt(mensaje, "0");
  if (valor === null) return; // Si el tendero presiona "Cancelar"

  let monto = parseFloat(valor);
  if (isNaN(monto) || monto <= 0) {
    return alert("Por favor, ingrese un número válido mayor a 0.");
  }

  let nuevoMonto =
    accion === "sumar" ? montoActual + monto : montoActual - monto;

  if (nuevoMonto < 0) {
    return alert("❌ El abono no puede ser mayor al monto de la deuda actual.");
  }

  if (nuevoMonto === 0) {
    if (
      confirm("✅ La deuda ha llegado a $0. ¿Desea eliminarla de la lista?")
    ) {
      await window.api.deleteFiado(id);
      cargarFiados();
    }
    return;
  }

  // Actualizar en la base de datos
  await window.api.updateFiado({ id: id, monto: nuevoMonto });
  cargarFiados();
}

async function eliminarFiado(id) {
  if (
    confirm(
      "⚠️ ¿Está seguro de eliminar este fiado de la lista? (Ya sea porque pagó o porque se da por perdido)",
    )
  ) {
    await window.api.deleteFiado(id);
    cargarFiados();
  }
}

// --- LÓGICA CAJA ---
// --- LÓGICA CAJA ---
async function agregarCaja() {
  const tipo = document.getElementById("caja-tipo").value;
  const desc = document.getElementById("caja-desc").value;
  const monto = parseFloat(document.getElementById("caja-monto").value);
  const metodo = document.getElementById("caja-metodo").value;

  if (!desc || !monto || !metodo) return alert("Llene todos los campos");

  await window.api.addMovimientoCaja({
    descripcion: desc,
    tipo,
    monto,
    metodo,
  });
  alert("✅ Movimiento guardado.");

  document.getElementById("caja-desc").value = "";
  document.getElementById("caja-monto").value = "";
  document.getElementById("caja-metodo").value = "";

  cargarCaja(); // Refrescar la tabla automáticamente
}

async function cargarCaja() {
  cajaGlobal = await window.api.getCaja();
  renderCaja();
}

function renderCaja() {
  const tbody = document.querySelector("#tabla-caja tbody");
  tbody.innerHTML = "";

  const filtroTipo = document.getElementById("filtro-tipo-caja").value;
  const filtroMetodo = document.getElementById("filtro-metodo-caja").value;
  const ordenFecha = document.getElementById("orden-fecha-caja").value;

  let movimientos = [...cajaGlobal];

  // 1. Filtrar por Tipo
  if (filtroTipo !== "Todos") {
    movimientos = movimientos.filter((m) => m.tipo === filtroTipo);
  }

  // 2. Filtrar por Método
  if (filtroMetodo !== "Todos") {
    movimientos = movimientos.filter((m) => m.metodo === filtroMetodo);
  }

  // 3. Ordenar por Fecha
  movimientos.sort((a, b) => {
    let fechaA = new Date(a.fecha + "Z");
    let fechaB = new Date(b.fecha + "Z");
    return ordenFecha === "desc" ? fechaB - fechaA : fechaA - fechaB;
  });

  if (movimientos.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;">No hay movimientos que coincidan con los filtros.</td></tr>';
    return;
  }

  // 4. Dibujar la tabla
  movimientos.forEach((m) => {
    const fechaObj = new Date(m.fecha + "Z");
    const fechaFormateada = fechaObj.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Asignar colores y signos según el tipo
    const esIngreso = m.tipo === "Ingreso";
    const badgeTipo = esIngreso
      ? '<span class="badge-ingreso">Ingreso</span>'
      : '<span class="badge-perdida">Pérdida</span>';

    const colorMonto = esIngreso
      ? "color: var(--success); font-weight: bold;"
      : "color: var(--danger); font-weight: bold;";
    const signo = esIngreso ? "+" : "-";

    tbody.innerHTML += `<tr>
            <td>${fechaFormateada}</td>
            <td>${m.descripcion}</td>
            <td>${badgeTipo}</td>
            <td><span class="badge-pago">${m.metodo}</span></td>
            <td style="${colorMonto}">${signo}$${m.monto}</td>
        </tr>`;
  });
}

// --- LÓGICA HISTORIAL DE VENTAS ---
async function cargarHistorialVentas() {
  const historial = await window.api.getHistorialVentas();
  const tbody = document.querySelector("#tabla-historial tbody");
  tbody.innerHTML = "";

  if (historial.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;">No hay ventas registradas aún.</td></tr>';
    return;
  }

  historial.forEach((v) => {
    // Formatear la fecha (SQLite la guarda en UTC, la pasamos a hora local de Colombia)
    const fechaObj = new Date(v.fecha + "Z");
    const fechaFormateada = fechaObj.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    tbody.innerHTML += `<tr>
            <td><strong>#${v.venta_id}</strong></td>
            <td>${fechaFormateada}</td>
            <td>${v.productos_vendidos || "Sin detalle"}</td>
            <td><span class="badge-pago">${v.metodo_pago}</span></td>
            <td>$${v.total}</td>
        </tr>`;
  });
}

// Variables globales para guardar los datos y no tener que consultar la BD cada vez
let inventarioGlobal = [];
let historialGlobal = [];

// ... (el resto de tu código de ventas, fiados, etc. se mantiene igual) ...

// --- LÓGICA INVENTARIO ---
async function cargarInventario() {
  // Traemos los datos de la BD y los guardamos
  inventarioGlobal = await window.api.getProductos();
  renderInventario(); // Llamamos a la función que dibuja la tabla
}

// 1. Actualizar la función renderInventario
function renderInventario() {
  const tbody = document.querySelector("#tabla-inventario tbody");
  tbody.innerHTML = "";

  const criterio = document.getElementById("orden-inventario").value;
  let productosAMostrar = [...inventarioGlobal];

  if (criterio === "fifo") {
    productosAMostrar.sort((a, b) => {
      if (a.fecha_vencimiento === "Sin fecha") return 1;
      if (b.fecha_vencimiento === "Sin fecha") return -1;
      return new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento);
    });
  } else if (criterio === "nombre") {
    productosAMostrar.sort((a, b) => a.nombre.localeCompare(b.nombre));
  } else if (criterio === "stock-asc") {
    productosAMostrar.sort((a, b) => a.stock - b.stock);
  } else if (criterio === "stock-desc") {
    productosAMostrar.sort((a, b) => b.stock - a.stock);
  }

  productosAMostrar.forEach((p) => {
    let stockStyle = p.stock <= 5 ? 'style="color:red; font-weight:bold;"' : "";

    // Añadimos los botones a la derecha
    tbody.innerHTML += `<tr>
            <td>${p.nombre}</td>
            <td>$${p.precio}</td>
            <td ${stockStyle}>${p.stock}</td>
            <td>${p.fecha_vencimiento}</td>
            <td class="col-acciones">
                <button class="btn-accion btn-editar" onclick="abrirModalProducto(${p.id})" title="Editar">✏️</button>
                <button class="btn-accion btn-eliminar" onclick="eliminarProducto(${p.id})" title="Eliminar">🗑️</button>
            </td>
        </tr>`;
  });
}

// --- LÓGICA HISTORIAL DE VENTAS ---
async function cargarHistorialVentas() {
  // Traemos los datos de la BD y los guardamos
  historialGlobal = await window.api.getHistorialVentas();
  renderHistorial(); // Llamamos a la función que dibuja la tabla
}

function renderHistorial() {
  const tbody = document.querySelector("#tabla-historial tbody");
  tbody.innerHTML = "";

  const filtroMetodo = document.getElementById("filtro-metodo").value;
  const ordenFecha = document.getElementById("orden-fecha").value;
  const fechaDesdeVal = document.getElementById("filtro-fecha-desde").value;
  const fechaHastaVal = document.getElementById("filtro-fecha-hasta").value;

  let ventasAMostrar = [...historialGlobal];

  // 1. Filtrar por Método de Pago
  if (filtroMetodo !== "Todos") {
    ventasAMostrar = ventasAMostrar.filter(
      (v) => v.metodo_pago === filtroMetodo,
    );
  }

  // 2. Filtrar por Rango de Fechas
  if (fechaDesdeVal) {
    const fechaDesde = new Date(fechaDesdeVal + "T00:00:00"); // Inicio del día
    ventasAMostrar = ventasAMostrar.filter(
      (v) => new Date(v.fecha + "Z") >= fechaDesde,
    );
  }
  if (fechaHastaVal) {
    const fechaHasta = new Date(fechaHastaVal + "T23:59:59"); // Fin del día
    ventasAMostrar = ventasAMostrar.filter(
      (v) => new Date(v.fecha + "Z") <= fechaHasta,
    );
  }

  // 3. Ordenar por Fecha (Ascendente o Descendente)
  ventasAMostrar.sort((a, b) => {
    let fechaA = new Date(a.fecha + "Z");
    let fechaB = new Date(b.fecha + "Z");
    return ordenFecha === "desc" ? fechaB - fechaA : fechaA - fechaB;
  });

  // 4. Dibujar la tabla
  if (ventasAMostrar.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;">No hay ventas que coincidan con los filtros seleccionados.</td></tr>';
    return;
  }

  ventasAMostrar.forEach((v) => {
    const fechaObj = new Date(v.fecha + "Z");
    const fechaFormateada = fechaObj.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    tbody.innerHTML += `<tr onclick="abrirDetalleVenta(${v.venta_id}, '${v.fecha}', '${v.metodo_pago}', ${v.total})">
            <td><strong>#${v.venta_id}</strong></td>
            <td>${fechaFormateada}</td>
            <td>${v.productos_vendidos || "Sin detalle"}</td>
            <td><span class="badge-pago">${v.metodo_pago}</span></td>
            <td>$${v.total}</td>
        </tr>`;
  });
}

// Variables para saber qué fiado estamos modificando
let fiadoActualId = null;
let fiadoActualMonto = 0;
let fiadoAccion = "";

// --- LÓGICA DEL MODAL DE FIADOS ---
function modificarFiado(id, montoActual, accion) {
  fiadoActualId = id;
  fiadoActualMonto = montoActual;
  fiadoAccion = accion;

  const titulo = document.getElementById("modal-titulo");
  const subtitulo = document.getElementById("modal-subtitulo");
  const input = document.getElementById("modal-input-monto");

  if (accion === "sumar") {
    titulo.innerText = "➕ Aumentar Deuda";
    subtitulo.innerText = `Deuda actual: $${montoActual}. ¿Cuánto desea sumar?`;
  } else {
    titulo.innerText = "➖ Abonar a la Deuda";
    subtitulo.innerText = `Deuda actual: $${montoActual}. ¿Cuánto abonó el cliente?`;
  }

  input.value = ""; // Limpiar el campo
  document.getElementById("modal-fiado").classList.add("active");
  setTimeout(() => input.focus(), 100); // Poner el cursor en el input
}

function cerrarModal() {
  document.getElementById("modal-fiado").classList.remove("active");
  fiadoActualId = null;
}

async function confirmarModificacionFiado() {
  const inputValor = document.getElementById("modal-input-monto").value;
  let monto = parseFloat(inputValor);

  if (isNaN(monto) || monto <= 0) {
    return alert("Por favor, ingrese un número válido mayor a 0.");
  }

  let nuevoMonto =
    fiadoAccion === "sumar"
      ? fiadoActualMonto + monto
      : fiadoActualMonto - monto;

  if (nuevoMonto < 0) {
    return alert("❌ El abono no puede ser mayor al monto de la deuda actual.");
  }

  if (nuevoMonto === 0) {
    if (
      confirm("✅ La deuda ha llegado a $0. ¿Desea eliminarla de la lista?")
    ) {
      await window.api.deleteFiado(fiadoActualId);
      cerrarModal();
      cargarFiados();
    }
    return;
  }

  // Actualizar en la base de datos
  await window.api.updateFiado({ id: fiadoActualId, monto: nuevoMonto });
  cerrarModal();
  cargarFiados();
}

// --- ASEGÚRATE DE QUE ESTA FUNCIÓN ESTÉ ASÍ ---
async function cargarFiados() {
  const fiados = await window.api.getFiados();
  const tbody = document.querySelector("#tabla-fiados tbody");
  tbody.innerHTML = "";

  if (fiados.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" style="text-align:center;">No hay deudas pendientes. ¡Todo al día!</td></tr>';
    return;
  }

  fiados.forEach((f) => {
    tbody.innerHTML += `<tr>
            <td>${f.cliente}</td>
            <td>$${f.monto}</td>
            <td>${f.fecha}</td>
            <td class="col-acciones">
                <button class="btn-accion btn-sumar" onclick="modificarFiado(${f.id}, ${f.monto}, 'sumar')" title="Aumentar deuda">➕</button>
                <button class="btn-accion btn-restar" onclick="modificarFiado(${f.id}, ${f.monto}, 'restar')" title="Abonar a la deuda">➖</button>
                <button class="btn-accion btn-eliminar" onclick="eliminarFiado(${f.id})" title="Eliminar (Ya pagó o se perdió)">🗑️</button>
            </td>
        </tr>`;
  });
}

// 1. Cargar los productos en el Datalist (Buscador)
// 1. Modificamos la carga inicial (ya no llena un datalist, solo prepara los datos)
async function cargarProductosSelect() {
  const productos = await window.api.getProductos();
  listaProductosGlobal = productos.filter((p) => p.stock > 0);
}

// 2. Nueva función para buscar y renderizar la lista
function renderizarBuscador(texto) {
  const listaHtml = document.getElementById("lista-resultados");
  listaHtml.innerHTML = ""; // Limpiar resultados anteriores

  if (texto.trim() === "") {
    listaHtml.classList.add("lista-resultados-oculta");
    return;
  }

  const textoNormalizado = normalizarTexto(texto);

  // Filtrar productos que coincidan
  const coincidencias = listaProductosGlobal.filter((p) =>
    normalizarTexto(p.nombre).includes(textoNormalizado),
  );

  if (coincidencias.length === 0) {
    listaHtml.innerHTML = `<li style="justify-content: center; color: #7f8c8d; cursor: default;">No se encontraron productos</li>`;
    listaHtml.classList.remove("lista-resultados-oculta");
    return;
  }

  // Crear los elementos de la lista
  coincidencias.forEach((p) => {
    const li = document.createElement("li");

    // Resaltar stock bajo
    const claseStock = p.stock <= 5 ? "res-stock res-stock-bajo" : "res-stock";

    li.innerHTML = `
            <span class="res-nombre">${p.nombre}</span>
            <div class="res-info">
                <span class="res-precio">$${p.precio}</span>
                <span class="${claseStock}">Stock: ${p.stock}</span>
            </div>
        `;

    // Evento al hacer clic en un producto
    li.onclick = () => {
      document.getElementById("venta-producto-input").value = p.nombre;
      listaHtml.classList.add("lista-resultados-oculta");
      document.getElementById("venta-cantidad").focus(); // Saltar directo a cantidad
    };

    listaHtml.appendChild(li);
  });

  listaHtml.classList.remove("lista-resultados-oculta");
}

// 3. Configurar los eventos del buscador (esto se ejecuta al cargar el script)
document.addEventListener("DOMContentLoaded", () => {
  const inputBuscar = document.getElementById("venta-producto-input");
  const listaResultados = document.getElementById("lista-resultados");

  // Escuchar cuando el tendero escribe
  inputBuscar.addEventListener("input", (e) => {
    renderizarBuscador(e.target.value);
  });

  // Ocultar la lista si hace clic fuera del buscador
  document.addEventListener("click", (e) => {
    if (
      !inputBuscar.contains(e.target) &&
      !listaResultados.contains(e.target)
    ) {
      listaResultados.classList.add("lista-resultados-oculta");
    }
  });

  // Mostrar la lista si vuelve a hacer clic en el input (y hay texto)
  inputBuscar.addEventListener("focus", (e) => {
    if (e.target.value.trim() !== "") {
      renderizarBuscador(e.target.value);
    }
  });
});

// 2. Agregar al carrito leyendo el texto escrito
function agregarAlCarrito() {
  const inputNombre = document
    .getElementById("venta-producto-input")
    .value.trim();
  const cantidadInput = document.getElementById("venta-cantidad");

  if (inputNombre === "") return alert("Escriba o seleccione un producto.");

  const cantidad = parseInt(cantidadInput.value);
  if (cantidad <= 0) return alert("La cantidad debe ser mayor a 0");

  // Buscar el producto exacto que el tendero escribió
  const productoEncontrado = listaProductosGlobal.find(
    (p) => normalizarTexto(p.nombre) === normalizarTexto(inputNombre),
  );

  if (!productoEncontrado) {
    return alert(
      `El producto "${inputNombre}" no existe en el inventario o no tiene stock.`,
    );
  }

  const { id, nombre, precio, stock: stockDisponible } = productoEncontrado;

  if (cantidad > stockDisponible) {
    return alert(
      `No hay suficiente stock de ${nombre}. Solo quedan ${stockDisponible} unidades.`,
    );
  }

  const itemExistente = carrito.find((item) => item.id === id);
  if (itemExistente) {
    if (itemExistente.cantidad + cantidad > stockDisponible) {
      return alert("Supera el stock disponible en tienda.");
    }
    itemExistente.cantidad += cantidad;
  } else {
    carrito.push({ id, nombre, precio, cantidad, stockDisponible });
  }

  cantidadInput.value = 1;
  document.getElementById("venta-producto-input").value = ""; // Limpiar buscador
  actualizarTablaCarrito();

  // Volver a enfocar el buscador para la próxima venta
  document.getElementById("venta-producto-input").focus();
}

// 3. Actualizar la búsqueda por voz para que llene el nuevo input
function buscarProductoPorVoz() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert(
      "El reconocimiento de voz no está disponible en este equipo. Use el buscador manual.",
    );
    return;
  }

  const btn = document.getElementById("btn-voz-busqueda");
  const recognition = new SpeechRecognition();
  recognition.lang = "es-CO";
  recognition.interimResults = false;

  btn.innerText = "🎤 Escuchando...";
  btn.classList.add("escuchando");
  recognition.start();

  recognition.onresult = (event) => {
    const textoDictado = event.results[0][0].transcript;
    const textoNormalizado = normalizarTexto(textoDictado);

    btn.innerText = "🎤 Buscar por voz";
    btn.classList.remove("escuchando");

    const coincidencias = listaProductosGlobal.filter((p) =>
      normalizarTexto(p.nombre).includes(textoNormalizado),
    );

    const input = document.getElementById("venta-producto-input");

    if (coincidencias.length === 1) {
      // Llenar el input con el nombre exacto del producto
      input.value = coincidencias[0].nombre;
      document.getElementById("venta-cantidad").focus();
    } else if (coincidencias.length > 1) {
      // Si hay varios, llenamos el input con lo que dijo para que el datalist le muestre las opciones
      input.value = textoDictado;
      alert(
        `Hay varios productos que suenan como "${textoDictado}". Por favor, seleccione el correcto en la lista.`,
      );
      input.focus();
    } else {
      alert(`No se encontró ningún producto con "${textoDictado}".`);
    }
  };

  recognition.onerror = (event) => {
    btn.innerText = "🎤 Buscar por voz";
    btn.classList.remove("escuchando");
    alert("Error al escuchar. Intente de nuevo o use el menú manual.");
  };

  recognition.onend = () => {
    btn.innerText = "🎤 Buscar por voz";
    btn.classList.remove("escuchando");
  };
}

// 1. Actualizar la función renderInventario
function renderInventario() {
  const tbody = document.querySelector("#tabla-inventario tbody");
  tbody.innerHTML = "";

  const criterio = document.getElementById("orden-inventario").value;
  let productosAMostrar = [...inventarioGlobal];

  if (criterio === "fifo") {
    productosAMostrar.sort((a, b) => {
      if (a.fecha_vencimiento === "Sin fecha") return 1;
      if (b.fecha_vencimiento === "Sin fecha") return -1;
      return new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento);
    });
  } else if (criterio === "nombre") {
    productosAMostrar.sort((a, b) => a.nombre.localeCompare(b.nombre));
  } else if (criterio === "stock-asc") {
    productosAMostrar.sort((a, b) => a.stock - b.stock);
  } else if (criterio === "stock-desc") {
    productosAMostrar.sort((a, b) => b.stock - a.stock);
  }

  productosAMostrar.forEach((p) => {
    let stockStyle = p.stock <= 5 ? 'style="color:red; font-weight:bold;"' : "";

    // Añadimos los botones a la derecha
    tbody.innerHTML += `<tr>
            <td>${p.nombre}</td>
            <td>$${p.precio}</td>
            <td ${stockStyle}>${p.stock}</td>
            <td>${p.fecha_vencimiento}</td>
            <td class="col-acciones">
                <button class="btn-accion btn-editar" onclick="abrirModalProducto(${p.id})" title="Editar">Editar</button>
                <button class="btn-accion btn-eliminar" onclick="eliminarProducto(${p.id})" title="Eliminar">Eliminar</button>
            </td>
        </tr>`;
  });
}

// 2. Variables y lógica para el Modal de Producto
let productoEditandoId = null;

function abrirModalProducto(id) {
  const prod = inventarioGlobal.find((p) => p.id === id);
  if (!prod) return;

  productoEditandoId = id;
  document.getElementById("edit-prod-nombre").value = prod.nombre;
  document.getElementById("edit-prod-precio").value = prod.precio;
  document.getElementById("edit-prod-stock").value = prod.stock;
  // Si la fecha es "Sin fecha", dejamos el campo en blanco
  document.getElementById("edit-prod-fecha").value =
    prod.fecha_vencimiento === "Sin fecha" ? "" : prod.fecha_vencimiento;

  document.getElementById("modal-producto").classList.add("active");
}

function cerrarModalProducto() {
  document.getElementById("modal-producto").classList.remove("active");
  productoEditandoId = null;
}

async function guardarEdicionProducto() {
  const nombre = document.getElementById("edit-prod-nombre").value.trim();
  const precio = parseFloat(document.getElementById("edit-prod-precio").value);
  const stock = parseInt(document.getElementById("edit-prod-stock").value);
  const fecha = document.getElementById("edit-prod-fecha").value;

  if (!nombre || isNaN(precio) || isNaN(stock)) {
    return alert(
      "Por favor, llene todos los campos obligatorios correctamente.",
    );
  }

  await window.api.updateProducto({
    id: productoEditandoId,
    nombre: nombre,
    precio: precio,
    stock: stock,
    fecha_vencimiento: fecha || "Sin fecha",
  });

  cerrarModalProducto();

  // Recargar datos en pantalla
  const productos = await window.api.getProductos();
  inventarioGlobal = productos;
  renderInventario();
  cargarProductosSelect(); // Actualizar también el buscador de ventas
  alert("✅ Producto actualizado correctamente.");
}

// 3. Lógica para Eliminar Producto
async function eliminarProducto(id) {
  if (
    confirm(
      "⚠️ ¿Está seguro de eliminar este producto del inventario?\n\n(Nota: Las ventas pasadas de este producto seguirán apareciendo en el historial).",
    )
  ) {
    await window.api.deleteProducto(id);

    // Recargar datos en pantalla
    const productos = await window.api.getProductos();
    inventarioGlobal = productos;
    renderInventario();
    cargarProductosSelect();
  }
}

// --- LÓGICA DEL MODAL DE DETALLE DE VENTA ---
async function abrirDetalleVenta(ventaId, fechaOriginal, metodo, total) {
  // 1. Traer los productos de esa venta desde la BD
  const detalles = await window.api.getVentaDetalle(ventaId);

  // 2. Formatear la fecha para mostrarla bonita
  const fechaObj = new Date(fechaOriginal + "Z");
  const fechaFormateada = fechaObj.toLocaleString("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // 3. Rellenar los encabezados del modal
  document.getElementById("detalle-venta-titulo").innerText =
    `Venta #${ventaId}`;
  document.getElementById("detalle-venta-fecha").innerText = fechaFormateada;
  document.getElementById("detalle-venta-metodo").innerText = metodo;
  document.getElementById("detalle-venta-total").innerText = `$${total}`;

  // 4. Llenar la tabla con los productos
  const tbody = document.querySelector("#tabla-detalle-venta tbody");
  tbody.innerHTML = "";

  detalles.forEach((d) => {
    tbody.innerHTML += `<tr>
            <td>${d.nombre}</td>
            <td style="text-align: center;">${d.cantidad}</td>
            <td>$${d.precio_unitario}</td>
            <td>$${d.subtotal}</td>
        </tr>`;
  });

  // 5. Mostrar el modal
  document.getElementById("modal-detalle-venta").classList.add("active");
}

function cerrarModalDetalleVenta() {
  document.getElementById("modal-detalle-venta").classList.remove("active");
}

// Inicializar
cargarProductosSelect();
