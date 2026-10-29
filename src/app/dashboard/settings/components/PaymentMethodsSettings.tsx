'use client'

import { useState, useEffect } from 'react'
import { getPaymentMethods, savePaymentMethod, deletePaymentMethod, PaymentMethod, INITIAL_PAYMENT_METHODS } from '@/utils/settings'

const PRESET_COLORS = [
  { name: 'Verde (Efectivo)', value: '#10b981' },
  { name: 'Morado (Yape)', value: '#8b5cf6' },
  { name: 'Turquesa (Plin)', value: '#06b6d4' },
  { name: 'Azul (Tarjeta / BCP)', value: '#3b82f6' },
  { name: 'Ámbar (Transferencia / BBVA)', value: '#f59e0b' },
  { name: 'Rojo (Scotiabank / Otro)', value: '#ef4444' },
  { name: 'Negro / Neutro', value: '#171717' }
]

export default function PaymentMethodsSettings() {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState('')
  
  // Modal de Crear / Editar
  const [showModal, setShowModal] = useState(false)
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)
  const [methodToDelete, setMethodToDelete] = useState<PaymentMethod | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Formulario
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<'CASH' | 'DIGITAL'>('DIGITAL')
  const [formAccountInfo, setFormAccountInfo] = useState('')
  const [formColor, setFormColor] = useState('#8b5cf6')
  const [formIsActive, setFormIsActive] = useState(true)

  useEffect(() => {
    loadMethods()
  }, [])

  const loadMethods = async () => {
    setLoading(true)
    const list = await getPaymentMethods()
    setMethods(list)
    setLoading(false)
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  const handleOpenCreate = () => {
    setEditingMethod(null)
    setFormName('')
    setFormType('DIGITAL')
    setFormAccountInfo('')
    setFormColor('#8b5cf6')
    setFormIsActive(true)
    setShowModal(true)
  }

  const handleOpenEdit = (method: PaymentMethod) => {
    setEditingMethod(method)
    setFormName(method.name)
    setFormType(method.type)
    setFormAccountInfo(method.account_info || '')
    setFormColor(method.color || '#10b981')
    setFormIsActive(method.is_active)
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = formName.trim()
    if (!name) return showToast('⚠️ Ingresa un nombre para el método de pago')

    setIsSaving(true)
    const payload: PaymentMethod = {
      id: editingMethod?.id || `pm-custom-${Date.now()}`,
      name,
      type: formType,
      account_info: formAccountInfo.trim() || null,
      color: formColor,
      is_active: formIsActive
    }

    const res = await savePaymentMethod(payload)
    setIsSaving(false)

    if (res.success) {
      showToast(editingMethod ? '✅ Método de pago actualizado' : '✅ Nuevo método de pago registrado')
      setShowModal(false)
      loadMethods()
    } else {
      showToast('❌ Error al guardar método de pago')
    }
  }

  const handleToggleActive = async (method: PaymentMethod) => {
    const updated: PaymentMethod = { ...method, is_active: !method.is_active }
    await savePaymentMethod(updated)
    setMethods(prev => prev.map(m => m.id === method.id ? updated : m))
    showToast(`${updated.is_active ? '🟢 Activado' : '⚪ Desactivado'}: ${updated.name}`)
  }

  const handleDelete = async (id: string) => {
    await deletePaymentMethod(id)
    setMethodToDelete(null)
    showToast('🗑️ Método de pago eliminado')
    loadMethods()
  }

  return (
    <div className="max-w-4xl animate-fade-in space-y-6">
      
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-neutral-900 text-white px-5 py-3 rounded-2xl shadow-2xl z-50 font-bold text-sm border border-neutral-700 animate-fade-in-up">
          {toastMessage}
        </div>
      )}

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 font-serif">Métodos de Pago</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Configura billeteras digitales, tarjetas y cuentas (ej: Yape María, Transferencias BCP) para el cobro en POS y cuadre de cajas.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl font-bold shadow-md shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Método de Pago
        </button>
      </div>

      {/* Lista de Métodos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {methods.map(method => {
          const isCash = method.type === 'CASH'

          return (
            <div 
              key={method.id} 
              className={`p-5 rounded-3xl border transition-all ${
                method.is_active 
                  ? 'bg-white border-neutral-200/90 shadow-2xs hover:shadow-sm' 
                  : 'bg-neutral-50 border-neutral-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <span 
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-2xs"
                    style={{ backgroundColor: method.color || '#10b981' }}
                  >
                    {isCash ? '💵' : method.name.toLowerCase().includes('yape') ? '🟣' : method.name.toLowerCase().includes('plin') ? '🔵' : '💳'}
                  </span>
                  <div>
                    <h3 className="font-bold text-neutral-900 text-base">{method.name}</h3>
                    <span className="text-[11px] font-bold text-neutral-400 block uppercase">
                      {isCash ? '💵 Efectivo (Gaveta física)' : '📱 Digital (Bancario / Billetera)'}
                    </span>
                  </div>
                </div>

                {/* Switch Activo */}
                <button
                  type="button"
                  onClick={() => handleToggleActive(method)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                    method.is_active 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-neutral-200 text-neutral-600 border-neutral-300'
                  }`}
                >
                  {method.is_active ? 'Activo' : 'Pausado'}
                </button>
              </div>

              {/* Información de Cuenta / Titular */}
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 text-xs mb-4">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                  {isCash ? 'Destino contable' : 'Titular / Teléfono para cobro'}
                </span>
                <p className="font-semibold text-neutral-800 mt-0.5">
                  {method.account_info || (isCash ? 'Suma al efectivo físico del arqueo de caja' : 'Sin datos de cuenta especificados')}
                </p>
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs">
                <span className="text-[11px] text-neutral-400 font-medium">
                  Visible en POS: {method.is_active ? 'Sí' : 'No'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(method)}
                    className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Editar
                  </button>
                  {method.name !== 'Efectivo' && (
                    <button
                      type="button"
                      onClick={() => setMethodToDelete(method)}
                      className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ======================= MODAL CREAR / EDITAR ======================= */}
      {showModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-neutral-200">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <h3 className="text-xl font-bold text-neutral-900 font-serif">
                {editingMethod ? 'Editar Método de Pago' : 'Nuevo Método de Pago'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-neutral-900 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Nombre del Método *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Ej: Yape María, Transferencia BCP, Niubiz"
                  required
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-sm font-bold text-neutral-900 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Tipo de Ingreso *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType('DIGITAL')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                      formType === 'DIGITAL'
                        ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <span className="block font-black">📱 Digital / Banco</span>
                    <span className={`text-[10px] block mt-0.5 ${formType === 'DIGITAL' ? 'text-neutral-300' : 'text-neutral-400'}`}>
                      Va a billetera o cuenta bancaria
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('CASH')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                      formType === 'CASH'
                        ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <span className="block font-black">💵 Efectivo Físico</span>
                    <span className={`text-[10px] block mt-0.5 ${formType === 'CASH' ? 'text-neutral-300' : 'text-neutral-400'}`}>
                      Entra al cajón y se cuenta en arqueo
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Titular / Teléfono / N° de Cuenta (Opcional)
                </label>
                <input
                  type="text"
                  value={formAccountInfo}
                  onChange={e => setFormAccountInfo(e.target.value)}
                  placeholder="Ej: 987 654 321 - María López"
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-xs sm:text-sm font-medium text-neutral-800 transition-all"
                />
                <p className="text-[10px] text-neutral-400 mt-1">
                  Se mostrará en la pantalla de cobro del POS para que el cajero le indique al cliente el número al que debe transferir.
                </p>
              </div>

              {/* Color Identificativo */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                  Color del Botón en POS
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFormColor(c.value)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                        formColor === c.value ? 'scale-125 border-neutral-900 ring-2 ring-neutral-300' : 'border-transparent hover:scale-110'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 flex gap-3 -mx-6 -mb-6 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-200 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : (editingMethod ? 'Guardar Cambios' : 'Crear Método')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL CONFIRMAR ELIMINACIÓN ======================= */}
      {methodToDelete && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center border border-neutral-200">
            <div className="w-14 h-14 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-neutral-900 mb-1">¿Eliminar Método de Pago?</h3>
            <p className="text-neutral-500 text-xs mb-6">
              Estás a punto de eliminar <strong className="text-neutral-800">{methodToDelete.name}</strong>. Ya no aparecerá como opción de cobro en el POS.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMethodToDelete(null)}
                className="flex-1 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(methodToDelete.id)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-md shadow-red-200 cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
