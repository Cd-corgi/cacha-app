import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

export default function Caja() {
  const [form, setForm] = useState({ tipo: 'Ingreso', descripcion: '', monto: '', metodo: 'Efectivo' });
  const [filtros, setFiltros] = useState({ tipo: 'Todos', metodo: 'Todos', orden: 'desc' });

  const movimientos = useLiveQuery(() => db.caja.toArray()) || [];

  const agregarMovimiento = async () => {
    if (!form.descripcion || !form.monto) return alert("Llene los campos");
    await db.caja.add({ ...form, monto: parseFloat(form.monto), fecha: new Date().toISOString() });
    setForm({ ...form, descripcion: '', monto: '' });
  };

  let lista = movimientos.filter(m => (filtros.tipo === 'Todos' || m.tipo === filtros.tipo) && (filtros.metodo === 'Todos' || m.metodo === filtros.metodo));
  lista.sort((a, b) => filtros.orden === 'desc' ? new Date(b.fecha) - new Date(a.fecha) : new Date(a.fecha) - new Date(b.fecha));

  return (
    <div>
      <div className="card">
        <h2>Registrar Movimiento</h2>
        <div className="form-grid">
          <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
            <option value="Ingreso">Ingreso Extra</option>
            <option value="Perdida">Pérdida</option>
          </select>
          <input type="text" placeholder="Descripción" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} />
          <input type="number" placeholder="Monto" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} />
          <select value={form.metodo} onChange={e => setForm({...form, metodo: e.target.value})}>
            <option value="Efectivo">Efectivo</option>
            <option value="Nequi">Nequi</option>
            <option value="Daviplata">Daviplata</option>
            <option value="Transferencia">Transferencia</option>
          </select>
        </div>
        <button className="btn-primario" onClick={agregarMovimiento}>Registrar</button>
      </div>

      <div className="barra-filtros">
        <select value={filtros.tipo} onChange={e => setFiltros({...filtros, tipo: e.target.value})}>
          <option value="Todos">Todos los movimientos</option>
          <option value="Ingreso">Solo Ingresos</option>
          <option value="Perdida">Solo Pérdidas</option>
        </select>
        <select value={filtros.metodo} onChange={e => setFiltros({...filtros, metodo: e.target.value})}>
          <option value="Todos">Todos los métodos</option>
          <option value="Efectivo">Efectivo</option>
          <option value="Nequi">Nequi</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Daviplata">Daviplata</option>
        </select>
        <select value={filtros.orden} onChange={e => setFiltros({...filtros, orden: e.target.value})}>
          <option value="desc">Más recientes</option>
          <option value="asc">Más antiguos</option>
        </select>
      </div>

      <table>
        <thead><tr><th>Fecha</th><th>Descripción</th><th>Tipo</th><th>Método</th><th>Monto</th></tr></thead>
        <tbody>
          {lista.map(m => (
            <tr key={m.id}>
              <td>{new Date(m.fecha).toLocaleString()}</td>
              <td>{m.descripcion}</td>
              <td><span className={m.tipo === 'Ingreso' ? 'badge-ingreso' : 'badge-perdida'}>{m.tipo}</span></td>
              <td>{m.metodo}</td>
              <td style={{ color: m.tipo === 'Ingreso' ? 'green' : 'red', fontWeight: 'bold' }}>
                {m.tipo === 'Ingreso' ? '+' : '-'}${m.monto}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}