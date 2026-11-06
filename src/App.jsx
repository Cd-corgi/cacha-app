import { useEffect, useState } from "react";
import Ventas from "./components/Ventas";
import Inventario from "./components/Inventario";
import Fiados from "./components/Fiados";
import Caja from "./components/Caja";
import Historial from "./components/Historial";
import "./style.css"; // Tus estilos originales

export default function App() {
  const [tab, setTab] = useState("ventas");
  const [carrito, setCarrito] = useState([]);

  useEffect(() => {
    // Nos conectamos al servidor local
    const ws = new WebSocket(`ws://${window.location.host}`);

    ws.onopen = () => console.log("✅ Conexión con el servidor establecida");
    ws.onclose = () => console.log("❌ Conexión con el servidor cerrada");

    // Cuando React se cierra o recarga, avisa al servidor cerrando la conexión
    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="app-container">
      <header>
        <h1>🏪 Cacha App</h1>
        <p>Sistema de control para tienda de barrio</p>
      </header>

      <nav>
        <button
          className={`nav-btn ${tab === "ventas" ? "active" : ""}`}
          onClick={() => setTab("ventas")}
        >
          🛒 Registrar Venta
        </button>
        <button
          className={`nav-btn ${tab === "inventario" ? "active" : ""}`}
          onClick={() => setTab("inventario")}
        >
          📦 Inventario
        </button>
        <button
          className={`nav-btn ${tab === "fiados" ? "active" : ""}`}
          onClick={() => setTab("fiados")}
        >
          📒 Fiados
        </button>
        <button
          className={`nav-btn ${tab === "caja" ? "active" : ""}`}
          onClick={() => setTab("caja")}
        >
          💵 Caja y Pérdidas
        </button>
        <button
          className={`nav-btn ${tab === "historial" ? "active" : ""}`}
          onClick={() => setTab("historial")}
        >
          📊 Historial
        </button>
      </nav>

      <main>
        {tab === "ventas" && <Ventas />}
        {tab === "inventario" && <Inventario />}
        {tab === "fiados" && <Fiados />}
        {tab === "caja" && <Caja />}
        {tab === "historial" && <Historial />}
      </main>
    </div>
  );
}
