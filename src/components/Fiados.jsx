import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

export default function Fiados() {
  const [cliente, setCliente] = useState('');
  const [monto, setMonto] = useState('');
  const [modal, setModal] = useState(null); // { id, accion, montoActual }
  const [montoModal, setMontoModal] = useState('');

  const fiados = useLiveQuery(() => db.fiados.toArray()) || [];

  const agregarFiado = async () => {
    if (!cliente || !monto) return alert("Llene los campos");
    await db.fiados.add({ cliente, monto: parseFloat(monto), fecha: new Date().toISOString() });
    setCliente(''); setMonto('');
  };

  const modificarFiado = async () => {
    const valor = parseFloat(montoModal);
    if (isNaN(valor) || valor <= 0) return alert("Monto inválido");
    
    let nuevoMonto = modal.accion === 'sumar' ? modal.montoActual + valor : modal.montoActual - valor;
    
    if (nuevoMonto < 0) return alert("El abono supera la deuda");
    if (nuevoMonto === 0) {
      if (window.confirm("Deuda en $0. ¿Eliminar registro?")) await db.fiados.delete(modal.id);
    } else {
      await db.fiados.update(modal.id, { monto: nuevoMonto });
    }
    setModal(null);
  };

  return (
    <div>
      <div className="card">
        <h2>Registrar Nuevo Fiado</h2>
        <div className="form-grid">
          <input type="text" placeholder="Nombre del cliente" value={cliente} onChange={e => setCliente(e.target.value)} />
          <input type="number" placeholder="Monto ($)" value={monto} onChange={e => setMonto(e.target.value)} />
        </div>
        <button className="btn-primario" onClick={agregarFiado}>Anotar Fiado</button>
      </div>

      <table>
        <thead><tr><th>Cliente</th><th>Monto</th><th>Fecha</th><th>Acciones</th></tr></thead>
        <tbody>
          {fiados.map(f => (
            <tr key={f.id}>
              <td>{f.cliente}</td>
              <td>${f.monto}</td>
              <td>{new Date(f.fecha).toLocaleDateString()}</td>
              <td>
                <button className="btn-accion btn-sumar" onClick={() => { setModal({ id: f.id, accion: 'sumar', montoActual: f.monto }); setMontoModal(''); }}>➕</button>
                <button className="btn-accion btn-restar" onClick={() => { setModal({ id: f.id, accion: 'restar', montoActual: f.monto }); setMontoModal(''); }}>➖</button>
                <button className="btn-accion btn-eliminar" onClick={() => db.fiados.delete(f.id)}>🗑️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <div className="modal-overlay active">
          <div className="modal-contenido">
            <h3>{modal.accion === 'sumar' ? 'Aumentar Deuda' : 'Abonar a la Deuda'}</h3>
            <p>Deuda actual: ${modal.montoActual}</p>
            <input type="number" placeholder="Monto" value={montoModal} onChange={e => setMontoModal(e.target.value)} />
            <div className="modal-botones">
              <button className="btn-cancelar" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primario" onClick={modificarFiado}>Aceptar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}