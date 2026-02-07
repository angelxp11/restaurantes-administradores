import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Empleados.css';
import { db } from '../firebase';
import { doc, setDoc, collection, getDocs, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import ConfirmationDelete from '../RESOURCES/THEMES/CONFIRMATIONDELETE/ConfirmationDelete';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';

const formatPrice = (value) => {
  if (value === null || value === undefined || value === '') return '0';
  const stringValue = value.toString();
  const numberValue = parseFloat(stringValue.replace(/[$,]/g, '')) || 0;
  return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const Empleados = ({ modalVisible, closeModal }) => {
  const [empleado, setEmpleado] = useState({ id: '', name: '', role: '', phone: '', phoneCountryCode: '+1', address: '', salary: '', scheduleStart: '', scheduleEnd: '', email: '' });
  const [empleados, setEmpleados] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [isEditing, setIsEditing] = useState(false); // nuevo estado para distinguir editar vs crear

  useEffect(() => {
    if (modalVisible) {
      fetchLastEmpleadoId();
      fetchEmpleados();
    }
  }, [modalVisible]);

  const fetchLastEmpleadoId = async () => {
    try {
      const q = query(collection(db, 'EMPLEADOS'), orderBy('id', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);
      let lastId = 0;
      querySnapshot.forEach((d) => {
        const val = parseInt(d.data().id, 10);
        if (!isNaN(val)) lastId = val;
      });
      setEmpleado((prev) => ({ ...prev, id: (lastId + 1).toString().padStart(8, '0') }));
    } catch (error) {
      console.error('Error fetching last empleado ID:', error);
    }
  };

  const fetchEmpleados = async () => {
    try {
      const q = query(collection(db, 'EMPLEADOS'), orderBy('id', 'asc'));
      const querySnapshot = await getDocs(q);
      const items = [];
      querySnapshot.forEach((d) => {
        items.push(d.data());
      });
      setEmpleados(items);
    } catch (error) {
      console.error('Error fetching empleados:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEmpleado((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { role, name, phone, address, salary, scheduleStart, scheduleEnd, email, phoneCountryCode, id } = empleado;

    if (role === 'CLIENTE') {
      if (!name || !phone || !address || !email) {
        toast.error("Por favor complete todos los campos obligatorios para el empleado.");
        return;
      }
    } else {
      if (!name || !phone || !salary || !scheduleStart || !scheduleEnd || !email) {
        toast.error("Por favor complete todos los campos obligatorios para el rol seleccionado.");
        return;
      }
    }

    try {
      // Primero grabar en Firestore
      const formattedEmpleado = {
        id,
        name,
        role,
        phone: `${phoneCountryCode}${phone}`,
        address,
        salary: (salary || '').toString().replace(/[^0-9.]/g, ''),
        schedule: `${scheduleStart}-${scheduleEnd}`,
        email
      };

      await setDoc(doc(db, "EMPLEADOS", id), formattedEmpleado);

      // Si estamos creando (no editando), entonces crear la cuenta en Auth
      if (!isEditing) {
        const auth = getAuth();
        const password = email.split('@')[0] || 'password';
        try {
          // Crear usuario en Auth (esto suele iniciar sesión automáticamente)
          await createUserWithEmailAndPassword(auth, email, password);

          // Asegurarnos de que el inicio de sesión se realice SOLO después del guardado:
          // Forzar sign-out si quedó autenticado y luego sign-in explícito.
          try {
            await signOut(auth);
            await signInWithEmailAndPassword(auth, email, password);
          } catch (signinErr) {
            console.error('Error al forzar sign-out/sign-in:', signinErr);
            // No hacemos rollback aquí; la cuenta ya fue creada correctamente.
            toast.warn('Usuario creado, pero hubo un problema al iniciar sesión automáticamente.');
          }
        } catch (authError) {
          // Si falla la creación en Auth, eliminar el documento en Firestore (rollback)
          try {
            await deleteDoc(doc(db, 'EMPLEADOS', id));
          } catch (delErr) {
            console.error('Error al hacer rollback (eliminar doc):', delErr);
          }
          throw authError; // para que el catch externo muestre el error
        }
      }

      toast.success("Empleado registrado correctamente");
      fetchEmpleados();
      handleBack();
    } catch (error) {
      console.error('Error al registrar empleado:', error);
      toast.error('Error al registrar empleado: ' + (error.message || ''));
    }
  };

  const handleEdit = (item) => {
    const [scheduleStart = '', scheduleEnd = ''] = (item.schedule || '').split('-');
    const phoneCountryCodeMatch = item.phone ? item.phone.match(/^(\+\d{1,3})/) : null;
    const phoneCountryCode = phoneCountryCodeMatch ? phoneCountryCodeMatch[1] : '+1';
    const phone = item.phone ? item.phone.replace(phoneCountryCode, '') : '';
    setEmpleado({ id: item.id || '', name: item.name || '', role: item.role || '', phone, phoneCountryCode, address: item.address || '', salary: item.salary || '', scheduleStart, scheduleEnd, email: item.email || '' });
    setIsEditing(true);
    setIsAdding(true);
  };

  const handleDelete = (id) => {
    setDeleteId(id);
    setShowConfirmation(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'EMPLEADOS', deleteId));
      toast.success('Empleado eliminado correctamente');
      fetchEmpleados();
    } catch (error) {
      console.error('Error al eliminar el empleado:', error);
      toast.error('Error al eliminar el empleado');
    } finally {
      setShowConfirmation(false);
      setDeleteId(null);
    }
  };

  const cancelDelete = () => {
    setShowConfirmation(false);
    setDeleteId(null);
  };

  const handleBack = () => {
    setIsAdding(false);
    setIsEditing(false);
    setEmpleado({ id: '', name: '', role: '', phone: '', phoneCountryCode: '+1', address: '', salary: '', scheduleStart: '', scheduleEnd: '', email: '' });
  };

  const handleAdd = () => {
    fetchLastEmpleadoId();
    setIsAdding(true);
    setIsEditing(false);
    setEmpleado({ id: '', name: '', role: '', phone: '', phoneCountryCode: '+1', address: '', salary: '', scheduleStart: '', scheduleEnd: '', email: '' });
  };

  const handleCloseModal = () => {
    closeModal();
    handleBack();
  };

  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 5; hour <= 23; hour++) {
      const ampm = hour < 12 ? 'AM' : 'PM';
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      times.push(`${displayHour}:00 ${ampm}`);
    }
    times.push('12:00 AM');
    return times;
  };

  return (
    <div className="empleados-container">
      <ToastContainer />
      {modalVisible && (
        <>
          <div className="empleados-overlay" onClick={handleCloseModal}></div>
          <div className="empleados-modal">
            <div className="empleados-modal-content">
              <span className="empleados-close" onClick={handleCloseModal}>&times;</span>
              <h2 className="modal-header">Administrar Empleados</h2>

              {isAdding ? (
                <form className="empleados-form" onSubmit={handleSubmit}>
                  <div className="empleados-form-group">
                    <label className="empleados-label">ID:</label>
                    <input className="empleados-input" type="text" name="id" value={empleado.id} onChange={handleInputChange} readOnly />
                  </div>

                  <div className="empleados-form-group">
                    <label className="empleados-label">Nombre:</label>
                    <input className="empleados-input" type="text" name="name" value={empleado.name} onChange={handleInputChange} required />
                  </div>

                  <div className="empleados-form-group">
                    <label className="empleados-label">Email:</label>
                    <input className="empleados-input" type="email" name="email" value={empleado.email} onChange={handleInputChange} required />
                  </div>

                  <div className="empleados-form-group">
                    <label className="empleados-label">Rol:</label>
                    <select className="empleados-input" name="role" value={empleado.role} onChange={handleInputChange} required>
                      <option value="">Seleccionar Rol</option>
                      <option value="ADMINISTRADOR">ADMINISTRADOR</option>
                      <option value="DOMICILIARIO">DOMICILIARIO</option>
                      <option value="COCINERO">COCINERO</option>
                      <option value="MESERO">MESERO</option>
                      <option value="CLIENTE">CLIENTE</option>
                    </select>
                  </div>

                  <div className="empleados-form-group">
                    <label className="empleados-label">Teléfono:</label>
                    <div className="phone-container">
                      <select className="phone-country-code" name="phoneCountryCode" value={empleado.phoneCountryCode} onChange={handleInputChange} required>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+52">🇲🇽 +52</option>
                        <option value="+57">🇨🇴 +57</option>
                        <option value="+58">🇻🇪 +58</option>
                      </select>
                      <input className="empleados-input phone-number" type="text" name="phone" value={empleado.phone} onChange={handleInputChange} required />
                    </div>
                  </div>

                  {empleado.role === 'CLIENTE' && (
                    <div className="empleados-form-group">
                      <label className="empleados-label">Dirección:</label>
                      <input className="empleados-input" type="text" name="address" value={empleado.address} onChange={handleInputChange} required />
                    </div>
                  )}

                  {empleado.role !== 'CLIENTE' && (
                    <>
                      <div className="empleados-form-group">
                        <label className="empleados-label">Sueldo:</label>
                        <input className="empleados-input" type="text" name="salary" value={formatPrice(empleado.salary)} onChange={handleInputChange} required />
                      </div>

                      <div className="empleados-form-group">
                        <label className="empleados-label">Horario:</label>
                        <div className="schedule-container">
                          <select className="empleados-input schedule-select" name="scheduleStart" value={empleado.scheduleStart} onChange={handleInputChange} required>
                            <option value="">ENTRADA</option>
                            {generateTimeOptions().map((time) => (
                              <option key={time} value={time}>{time}</option>
                            ))}
                          </select>
                          <select className="empleados-input schedule-select" name="scheduleEnd" value={empleado.scheduleEnd} onChange={handleInputChange} required>
                            <option value="">SALIDA</option>
                            {generateTimeOptions().map((time) => (
                              <option key={time} value={time}>{time}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="form-actions">
                    <button className="empleados-button" type="submit">Guardar</button>
                    <button className="empleados-button" type="button" onClick={handleBack}>Atrás</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="list-actions">
                    <button className="empleados-button" onClick={handleAdd}>Agregar</button>
                  </div>

                  <div className="empleados-list">
                    {empleados.map((item) => (
                      <div key={item.id} className="empleados-item">
                        <span>{item.name}</span>
                        <div className="button-container">
                          <button onClick={() => handleEdit(item)}><FaEdit /></button>
                          <button onClick={() => handleDelete(item.id)}><FaTrash /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {showConfirmation && (
        <ConfirmationDelete
          title="Confirmar eliminación"
          message="¿Estás seguro de que deseas eliminar este empleado?"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
};

export default Empleados;