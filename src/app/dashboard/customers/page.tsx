'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { getPaymentMethods, PaymentMethod } from '@/utils/settings'

// Helper para formatear fechas
function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Avatar de cliente con iniciales
function CustomerAvatar({ name }: { name: string }) {
  const initials = (name || 'CL')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')

  return (
    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
      {initials}
    </div>
  )
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState('')
  const [debtFilter, setDebtFilter] = useState<'ALL' | 'WITH_DEBT' | 'NO_DEBT'>('ALL')
  const [sortOrder, setSortOrder] = useState<'DEBT_DESC' | 'DEBT_ASC' | 'NAME_ASC' | 'DATE_DESC'>('DEBT_DESC')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Modales
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<any>(null)
  const [customerToDelete, setCustomerToDelete] = useState<any>(null)
  
  // Modal de Pago / Liquidación
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [customerToPay, setCustomerToPay] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Efectivo')
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<PaymentMethod[]>([])
  
  // Modal de Historial
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyCustomer, setHistoryCustomer] = useState<any>(null)
  const [historyTab, setHistoryTab] = useState<'PAYMENTS' | 'SALES'>('PAYMENTS')
  const [customerPayments, setCustomerPayments] = useState<any[]>([])
  const [customerSales, setCustomerSales] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Formulario de Cliente
  const [formData, setFormData] = useState({
    document_type: 'DNI',
    document_number: '',
    full_name: '',
    email: '',
    phone: ''
  })

  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [activeRegister, setActiveRegister] = useState<any>(null)

  const supabase = createClient()

  const loadPaymentMethods = async () => {
    try {
      const methods = await getPaymentMethods()
      const active = methods.filter(m => m.is_active && m.name.toLowerCase() !== 'fiado')
      setAvailablePaymentMethods(active)
      if (active.length > 0 && !active.some(m => m.name === paymentMethod)) {
        setPaymentMethod(active[0].name)
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchData()
    fetchActiveRegister()
    loadPaymentMethods()

    const handleSettingsUpdated = () => {
      loadPaymentMethods()
    }
    window.addEventListener('storage', handleSettingsUpdated)
    window.addEventListener('pos_settings_changed', handleSettingsUpdated)
    return () => {
      window.removeEventListener('storage', handleSettingsUpdated)
      window.removeEventListener('pos_settings_changed', handleSettingsUpdated)
    }
  }, [])

  // Reset de página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, debtFilter, sortOrder, itemsPerPage])

  const fetchActiveRegister = async () => {
    const { data } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('status', 'Abierta')
      .order('opened_at', { ascending: false })
      .limit(1)
      .single()
    setActiveRegister(data || null)
  }

  const fetchData = async () => {
    setIsLoading(true)
    const { data } = await supabase.from('customers').select('*').order('full_name')
    if (data) setCustomers(data)
    setIsLoading(false)
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // Guardar o Editar Cliente
  const handleSaveCustomer = async () => {
    const num = formData.document_number.trim()
    const name = formData.full_name.trim()

    if (!num || !name) {
      return showToast('⚠️ Completa el documento y nombre completo')
    }

    if (formData.document_type === 'DNI' && num.length !== 8) {
      return showToast('⚠️ El DNI debe tener exactamente 8 dígitos')
    }

    if (formData.document_type === 'RUC' && num.length !== 11) {
      return showToast('⚠️ El RUC debe tener exactamente 11 dígitos')
    }

    setIsSaving(true)

    if (editingCustomer) {
      const { error } = await supabase.from('customers').update({
        document_type: formData.document_type,
        document_number: num,
        full_name: name,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null
      }).eq('id', editingCustomer.id)

      setIsSaving(false)
      if (error) {
        return showToast('❌ Error al actualizar: ' + error.message)
      }
      showToast('✅ Cliente actualizado exitosamente')
    } else {
      const { error } = await supabase.from('customers').insert([{
        document_type: formData.document_type,
        document_number: num,
        full_name: name,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        debt_balance: 0.00
      }])

      setIsSaving(false)
      if (error) {
        return showToast('❌ Error al crear: Ya existe un cliente con ese número de documento.')
      }
      showToast('✅ Cliente registrado exitosamente')
    }

    setShowCustomerModal(false)
    setEditingCustomer(null)
    setFormData({ document_type: 'DNI', document_number: '', full_name: '', email: '', phone: '' })
    fetchData()
  }

  // Eliminar Cliente
  const handleDeleteCustomer = async (id: string) => {
    setIsSaving(true)
    const { error } = await supabase.from('customers').delete().eq('id', id)
    setIsSaving(false)
    if (error) {
      showToast('❌ No se puede eliminar: Tiene compras, deudas o pagos registrados en el sistema.')
    } else {
      showToast('🗑️ Cliente eliminado correctamente')
      fetchData()
    }
    setCustomerToDelete(null)
  }

  // Liquidar o Abonar Deuda
  const handlePayment = async () => {
    if (!customerToPay) return
    const amount = parseFloat(paymentAmount)
    
    if (isNaN(amount) || amount <= 0) {
      return showToast('⚠️ Ingresa un monto válido mayor a 0')
    }
    
    const currentDebt = Number(customerToPay.debt_balance || 0)
    if (amount > currentDebt + 0.001) {
      return showToast(`⚠️ El monto (S/ ${amount.toFixed(2)}) supera la deuda actual (S/ ${currentDebt.toFixed(2)})`)
    }

    if (!activeRegister) {
      return showToast('⚠️ Debes tener una Caja abierta para recibir este pago.')
    }

    setIsSaving(true)

    // 1. Insertar Pago
    const { error: payError } = await supabase.from('customer_payments').insert([{
      customer_id: customerToPay.id,
      cash_register_id: activeRegister.id,
      amount: amount,
      payment_method: paymentMethod
    }])

    if (payError) {
      setIsSaving(false)
      return showToast('❌ Error al registrar pago: ' + payError.message)
    }

    // 2. Actualizar saldo del cliente
    const newDebt = Math.max(0, currentDebt - amount)
    await supabase.from('customers').update({ debt_balance: newDebt }).eq('id', customerToPay.id)

    setIsSaving(false)
    showToast(`✅ Abono de S/ ${amount.toFixed(2)} registrado correctamente`)
    setShowPaymentModal(false)
    setCustomerToPay(null)
    setPaymentAmount('')
    fetchData()
  }

  // Cargar Historial de Cliente
  const loadCustomerHistory = async (customer: any) => {
    setHistoryCustomer(customer)
    setShowHistoryModal(true)
    setLoadingHistory(true)

    // 1. Abonos realizados
    const { data: payments } = await supabase
      .from('customer_payments')
      .select('*, cash_registers(name)')
      .eq('customer_id', customer.id)
      .order('payment_date', { ascending: false })
    if (payments) setCustomerPayments(payments)

    // 2. Ventas asociadas
    const { data: sales } = await supabase
      .from('sales')
      .select('*, sale_items(*, products(name))')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(30)
    if (sales) setCustomerSales(sales)

    setLoadingHistory(false)
  }

  // ---- MÉTRICAS REALES ----
  const totalDebt = customers.reduce((sum, c) => sum + Number(c.debt_balance || 0), 0)
  const customersWithDebt = customers.filter(c => Number(c.debt_balance) > 0)
  const customersDebtFree = customers.filter(c => Number(c.debt_balance) <= 0)

  // ---- FILTRADO Y PAGINACIÓN ----
  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch = !q ||
      c.full_name?.toLowerCase().includes(q) ||
      c.document_number?.includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))

    const debt = Number(c.debt_balance || 0)
    const matchesDebt = 
      debtFilter === 'ALL' ? true :
      debtFilter === 'WITH_DEBT' ? debt > 0 :
      debt <= 0

    return matchesSearch && matchesDebt
  }).sort((a, b) => {
    const debtA = Number(a.debt_balance || 0)
    const debtB = Number(b.debt_balance || 0)
    if (sortOrder === 'DEBT_DESC') return debtB - debtA
    if (sortOrder === 'DEBT_ASC') return debtA - debtB
    if (sortOrder === 'NAME_ASC') return (a.full_name || '').localeCompare(b.full_name || '')
    if (sortOrder === 'DATE_DESC') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    return 0
  })

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage) || 1
  const validPage = Math.min(Math.max(1, currentPage), totalPages)
  const paginatedCustomers = filteredCustomers.slice((validPage - 1) * itemsPerPage, validPage * itemsPerPage)

  return (
    <div className="flex flex-col h-full space-y-6 relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-neutral-900 text-white px-5 py-3 rounded-2xl shadow-2xl z-50 animate-fade-in-up font-bold text-sm flex items-center gap-2 border border-neutral-700">
          {toastMessage}
        </div>
      )}

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight font-serif">Clientes y Cuentas</h1>
          <p className="text-neutral-500 font-medium text-sm">Gestiona tu cartera de clientes, historial de compras y cuentas por cobrar (Fiados)</p>
        </div>
        <button 
          type="button"
          onClick={() => {
            setFormData({ document_type: 'DNI', document_number: '', full_name: '', email: '', phone: '' })
            setEditingCustomer(null)
            setShowCustomerModal(true)
          }} 
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl font-bold shadow-md shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-sm shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Añadir Cliente
        </button>
      </div>

      {/* 4 Tarjetas KPI Interactivas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Clientes */}
        <button
          type="button"
          onClick={() => setDebtFilter('ALL')}
          className={`p-5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
            debtFilter === 'ALL'
              ? 'bg-neutral-900 border-neutral-900 text-white shadow-md'
              : 'bg-white border-neutral-200/80 hover:border-neutral-400 text-neutral-800 hover:shadow-sm'
          }`}
        >
          <div>
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${debtFilter === 'ALL' ? 'text-neutral-300' : 'text-neutral-400'}`}>
              Cartera de Clientes
            </span>
            <p className="text-2xl font-black mt-0.5">
              {customers.length} <span className={`text-xs font-medium ${debtFilter === 'ALL' ? 'text-neutral-300' : 'text-neutral-500'}`}>registrados</span>
            </p>
          </div>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 ${debtFilter === 'ALL' ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-700'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </button>

        {/* Clientes con Deuda (Fiados) */}
        <button
          type="button"
          onClick={() => setDebtFilter(debtFilter === 'WITH_DEBT' ? 'ALL' : 'WITH_DEBT')}
          className={`p-5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
            debtFilter === 'WITH_DEBT'
              ? 'bg-amber-500 border-amber-500 text-white shadow-md'
              : 'bg-white border-neutral-200/80 hover:border-amber-400 text-neutral-800 hover:shadow-sm'
          }`}
        >
          <div>
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${debtFilter === 'WITH_DEBT' ? 'text-amber-100' : 'text-amber-600'}`}>
              Con Saldo Deudor
            </span>
            <p className="text-2xl font-black mt-0.5">
              {customersWithDebt.length} <span className={`text-xs font-medium ${debtFilter === 'WITH_DEBT' ? 'text-amber-100' : 'text-neutral-500'}`}>con fiados</span>
            </p>
          </div>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 ${debtFilter === 'WITH_DEBT' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </button>

        {/* Clientes al Día */}
        <button
          type="button"
          onClick={() => setDebtFilter(debtFilter === 'NO_DEBT' ? 'ALL' : 'NO_DEBT')}
          className={`p-5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
            debtFilter === 'NO_DEBT'
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
              : 'bg-white border-neutral-200/80 hover:border-emerald-400 text-neutral-800 hover:shadow-sm'
          }`}
        >
          <div>
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${debtFilter === 'NO_DEBT' ? 'text-emerald-100' : 'text-emerald-600'}`}>
              Clientes al Día
            </span>
            <p className="text-2xl font-black mt-0.5">
              {customersDebtFree.length} <span className={`text-xs font-medium ${debtFilter === 'NO_DEBT' ? 'text-emerald-100' : 'text-neutral-500'}`}>sin deuda</span>
            </p>
          </div>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 ${debtFilter === 'NO_DEBT' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </button>

        {/* Cuentas por Cobrar Total */}
        <div className="bg-white p-5 rounded-2xl border border-red-200/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider block">Total por Cobrar</span>
            <p className="text-2xl font-black text-neutral-900 mt-0.5">
              S/ {totalDebt.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs font-medium text-neutral-500 block mt-0.5">en créditos vigentes</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-bold shrink-0 border border-red-100">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, DNI, RUC o teléfono..." 
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-xs sm:text-sm font-medium shadow-sm transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filtro de Deuda */}
        <select
          value={debtFilter}
          onChange={(e) => setDebtFilter(e.target.value as any)}
          className="px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-700 text-xs sm:text-sm font-medium shadow-sm cursor-pointer"
        >
          <option value="ALL">Todos los clientes ({customers.length})</option>
          <option value="WITH_DEBT">⚠️ Solo con Deuda ({customersWithDebt.length})</option>
          <option value="NO_DEBT">🟢 Solo al Día ({customersDebtFree.length})</option>
        </select>

        {/* Ordenamiento */}
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as any)}
          className="px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-700 text-xs sm:text-sm font-medium shadow-sm cursor-pointer"
        >
          <option value="DEBT_DESC">Mayor deuda primero</option>
          <option value="DEBT_ASC">Menor deuda primero</option>
          <option value="NAME_ASC">Nombre (A - Z)</option>
          <option value="DATE_DESC">Más recientes primero</option>
        </select>
      </div>

      {/* Tabla de Clientes */}
      <div className="bg-white border border-neutral-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 pl-6">Cliente</th>
                <th className="py-3.5 px-4">Documento</th>
                <th className="py-3.5 px-4">Contacto</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-right">Deuda Pendiente</th>
                <th className="py-3.5 px-4 pr-6 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs sm:text-sm">
              {paginatedCustomers.map(customer => {
                const debt = Number(customer.debt_balance || 0)
                const hasDebt = debt > 0

                return (
                  <tr key={customer.id} className="hover:bg-neutral-50/70 transition-colors">
                    
                    {/* Cliente */}
                    <td className="py-3.5 px-4 pl-6">
                      <div className="flex items-center gap-3">
                        <CustomerAvatar name={customer.full_name} />
                        <div>
                          <p className="font-bold text-neutral-900">{customer.full_name}</p>
                          <span className="text-[11px] text-neutral-400">
                            Registrado: {formatDate(customer.created_at)}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Documento */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-bold text-neutral-700 bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200 inline-block shadow-2xs">
                        {customer.document_type}: {customer.document_number}
                      </span>
                    </td>

                    {/* Contacto */}
                    <td className="py-3.5 px-4">
                      {customer.phone ? (
                        <div className="flex items-center gap-1.5">
                          <a 
                            href={`https://wa.me/51${customer.phone.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center gap-1 text-emerald-600 font-bold hover:underline"
                            title="Abrir WhatsApp"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.666-.699c.971.53 1.77.814 2.794.814 3.179 0 5.766-2.587 5.767-5.766.002-3.18-2.584-5.768-5.767-5.768zm0-2.172c4.418 0 8 3.582 8 8 0 4.418-3.582 8-8 8-1.408 0-2.732-.365-3.882-1.002l-4.149 1.088 1.107-4.043c-.694-1.183-1.076-2.548-1.076-4.043 0-4.418 3.582-8 8-8z"/>
                            </svg>
                            {customer.phone}
                          </a>
                        </div>
                      ) : (
                        <span className="text-neutral-400 text-xs italic">Sin teléfono</span>
                      )}
                      {customer.email && (
                        <p className="text-[11px] text-neutral-400">{customer.email}</p>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-4 text-center">
                      {hasDebt ? (
                        <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                          Deuda Pendiente
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Al Día
                        </span>
                      )}
                    </td>

                    {/* Deuda Pendiente */}
                    <td className="py-3.5 px-4 text-right">
                      {hasDebt ? (
                        <span className="font-black text-red-600 text-sm">
                          S/ {debt.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="font-semibold text-neutral-400 text-xs">
                          S/ 0.00
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-4 pr-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        
                        {/* Botón Liquidar / Abonar si tiene deuda */}
                        {hasDebt && (
                          <button 
                            type="button"
                            onClick={() => {
                              setCustomerToPay(customer)
                              setPaymentAmount(debt.toFixed(2))
                              setShowPaymentModal(true)
                            }}
                            className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Liquidar
                          </button>
                        )}

                        {/* Botón Historial */}
                        <button
                          type="button"
                          onClick={() => loadCustomerHistory(customer)}
                          className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-neutral-900 rounded-lg transition-colors cursor-pointer"
                          title="Ver historial de compras y pagos"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>

                        {/* Botón Editar */}
                        <button 
                          type="button"
                          onClick={() => {
                            setEditingCustomer(customer)
                            setFormData({
                              document_type: customer.document_type || 'DNI',
                              document_number: customer.document_number || '',
                              full_name: customer.full_name || '',
                              email: customer.email || '',
                              phone: customer.phone || ''
                            })
                            setShowCustomerModal(true)
                          }}
                          className="p-1.5 hover:bg-blue-50 text-neutral-400 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                          title="Editar Cliente"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>

                        {/* Botón Eliminar */}
                        <button 
                          type="button"
                          onClick={() => setCustomerToDelete(customer)} 
                          className="p-1.5 hover:bg-red-50 text-neutral-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar Cliente"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {paginatedCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-neutral-400 font-medium">
                    {isLoading ? 'Cargando clientes...' : 'No se encontraron clientes que coincidan con la búsqueda o filtro.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación de Clientes */}
        <div className="p-3.5 border-t border-neutral-200 bg-neutral-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 font-semibold">
              Mostrando {filteredCustomers.length > 0 ? ((validPage - 1) * itemsPerPage) + 1 : 0} - {Math.min(validPage * itemsPerPage, filteredCustomers.length)} de {filteredCustomers.length} clientes
            </span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="px-2 py-1 bg-white border border-neutral-200 rounded text-xs font-medium text-neutral-700 outline-none cursor-pointer"
            >
              <option value={10}>10 por pág.</option>
              <option value={25}>25 por pág.</option>
              <option value={50}>50 por pág.</option>
            </select>
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={validPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                ◀ Anterior
              </button>
              <span className="px-2 font-bold text-neutral-700">
                {validPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={validPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Siguiente ▶
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ======================= MODALES ======================= */}

      {/* 1. Modal Crear / Editar Cliente */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-neutral-200">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <h3 className="text-xl font-bold text-neutral-900 font-serif">
                {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <button 
                type="button"
                onClick={() => setShowCustomerModal(false)} 
                className="text-neutral-400 hover:text-neutral-900 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Tipo Doc. *</label>
                  <select 
                    value={formData.document_type} 
                    onChange={e => setFormData({...formData, document_type: e.target.value})} 
                    className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-xs sm:text-sm font-bold cursor-pointer"
                  >
                    <option value="DNI">DNI</option>
                    <option value="RUC">RUC</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">N° de Documento *</label>
                  <input 
                    type="text" 
                    value={formData.document_number} 
                    onChange={e => setFormData({...formData, document_number: e.target.value.replace(/\s+/g, '')})} 
                    placeholder={formData.document_type === 'DNI' ? '8 dígitos' : formData.document_type === 'RUC' ? '11 dígitos' : 'Número'}
                    maxLength={formData.document_type === 'DNI' ? 8 : formData.document_type === 'RUC' ? 11 : 20}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-xs sm:text-sm font-mono font-medium" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Nombre Completo / Razón Social *</label>
                <input 
                  type="text" 
                  value={formData.full_name} 
                  onChange={e => setFormData({...formData, full_name: e.target.value})} 
                  placeholder="Ej: Xiomara Takemoto"
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-xs sm:text-sm font-medium" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Teléfono / WhatsApp</label>
                  <input 
                    type="text" 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                    placeholder="999 999 999"
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-xs sm:text-sm font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Correo Electrónico</label>
                  <input 
                    type="email" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                    placeholder="cliente@ejemplo.com"
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-xs sm:text-sm font-medium" 
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-neutral-100 bg-neutral-50/50 flex gap-3">
              <button 
                type="button"
                onClick={() => setShowCustomerModal(false)} 
                className="flex-1 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSaveCustomer} 
                disabled={isSaving} 
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-200 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : (editingCustomer ? 'Guardar Cambios' : 'Registrar Cliente')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Eliminar Cliente */}
      {customerToDelete && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center border border-neutral-200">
            <div className="w-14 h-14 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-neutral-900 mb-1">¿Eliminar Cliente?</h3>
            <p className="text-neutral-500 text-xs mb-6">
              Estás a punto de eliminar a <strong className="text-neutral-800">{customerToDelete.full_name}</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setCustomerToDelete(null)} 
                className="flex-1 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={() => handleDeleteCustomer(customerToDelete.id)} 
                disabled={isSaving}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-md shadow-red-200 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal Liquidar / Abonar Deuda */}
      {showPaymentModal && customerToPay && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-neutral-200">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div>
                <h3 className="text-xl font-black text-neutral-900 font-serif">Abonar a Deuda</h3>
                <p className="text-xs text-neutral-500">{customerToPay.full_name}</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowPaymentModal(false)} 
                className="text-neutral-400 hover:text-neutral-900 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              
              {/* Alerta si no hay caja abierta */}
              {!activeRegister && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-2.5 text-xs text-amber-800">
                  <span>⚠️</span>
                  <span>
                    No hay una caja abierta actualmente. <Link href="/dashboard/cash-registers" className="font-bold underline text-amber-900">Abre caja aquí</Link> para registrar ingresos.
                  </span>
                </div>
              )}

              {/* Tarjeta Deuda Actual */}
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider block">Deuda Pendiente Actual</span>
                  <p className="text-2xl font-black text-red-700 mt-0.5">
                    S/ {Number(customerToPay.debt_balance).toFixed(2)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentAmount(Number(customerToPay.debt_balance).toFixed(2))}
                  className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Pagar Todo
                </button>
              </div>

              {/* Input Monto */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Monto a Pagar (S/)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-lg">S/</span>
                  <input 
                    type="number" 
                    min="0.10" 
                    step="0.01" 
                    max={customerToPay.debt_balance}
                    value={paymentAmount} 
                    onChange={e => setPaymentAmount(e.target.value)} 
                    placeholder="0.00"
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-neutral-200 rounded-2xl focus:border-emerald-500 outline-none text-2xl font-black text-neutral-900 transition-all" 
                  />
                </div>

                {/* Saldo Restante Simulado */}
                {paymentAmount && !isNaN(parseFloat(paymentAmount)) && (
                  <p className="text-xs font-bold text-neutral-500 mt-1.5">
                    Saldo restante tras el abono: {' '}
                    <strong className="text-neutral-800">
                      S/ {Math.max(0, Number(customerToPay.debt_balance) - parseFloat(paymentAmount)).toFixed(2)}
                    </strong>
                  </p>
                )}
              </div>

              {/* Método de Pago */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">Método de Pago</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-0.5">
                  {(availablePaymentMethods.length > 0 
                    ? availablePaymentMethods 
                    : [
                        { id: '1', name: 'Efectivo', type: 'CASH', color: 'bg-emerald-500' },
                        { id: '2', name: 'Tarjeta', type: 'DIGITAL', color: 'bg-blue-500' },
                        { id: '3', name: 'Yape', type: 'DIGITAL', color: 'bg-purple-600' },
                        { id: '4', name: 'Plin', type: 'DIGITAL', color: 'bg-cyan-500' },
                      ]
                  ).map((method: any) => {
                    const isSelected = paymentMethod === method.name
                    return (
                      <button 
                        key={method.id || method.name}
                        type="button"
                        onClick={() => setPaymentMethod(method.name)}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          isSelected 
                            ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs' 
                            : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${method.color || 'bg-emerald-500'} ${isSelected ? 'ring-1 ring-white' : ''}`} />
                        <span className="truncate">{method.name}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Info cuenta/titular */}
                {(() => {
                  const curr = availablePaymentMethods.find(m => m.name === paymentMethod)
                  if (!curr || (!curr.account_holder && !curr.account_number && !curr.account_info)) return null
                  return (
                    <div className="mt-2 p-2 rounded-lg bg-neutral-100 text-[11px] text-neutral-600 flex items-center justify-between">
                      {curr.account_holder && <span>Titular: <b>{curr.account_holder}</b></span>}
                      {curr.account_number && <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-neutral-200">{curr.account_number}</span>}
                      {!curr.account_holder && !curr.account_number && curr.account_info && (
                        <span>{curr.account_info}</span>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>

            <div className="p-6 border-t border-neutral-100 bg-neutral-50/50 flex gap-3">
              <button 
                type="button"
                onClick={() => setShowPaymentModal(false)} 
                className="flex-1 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handlePayment} 
                disabled={isSaving || !activeRegister} 
                className="flex-[2] py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-200 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Registrando...' : 'Confirmar Abono'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal Historial Completo (Compras y Abonos) */}
      {showHistoryModal && historyCustomer && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-neutral-200">
            
            {/* Cabecera */}
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-3">
                <CustomerAvatar name={historyCustomer.full_name} />
                <div>
                  <h3 className="text-xl font-black text-neutral-900 font-serif">{historyCustomer.full_name}</h3>
                  <p className="text-xs text-neutral-500 font-mono">
                    {historyCustomer.document_type}: {historyCustomer.document_number} {historyCustomer.phone ? `• ${historyCustomer.phone}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Deuda Actual</span>
                  <span className={`text-base font-black ${Number(historyCustomer.debt_balance) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    S/ {Number(historyCustomer.debt_balance || 0).toFixed(2)}
                  </span>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowHistoryModal(false)} 
                  className="text-neutral-400 hover:text-neutral-900 p-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Pestañas internas del Historial */}
            <div className="flex border-b border-neutral-200 px-6 pt-3 bg-neutral-50/30 gap-4">
              <button
                type="button"
                onClick={() => setHistoryTab('PAYMENTS')}
                className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  historyTab === 'PAYMENTS'
                    ? 'border-neutral-900 text-neutral-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <span>Abonos y Pagos</span>
                <span className="px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700 text-[10px]">
                  {customerPayments.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setHistoryTab('SALES')}
                className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  historyTab === 'SALES'
                    ? 'border-neutral-900 text-neutral-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <span>Ventas y Fiados</span>
                <span className="px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700 text-[10px]">
                  {customerSales.length}
                </span>
              </button>
            </div>

            {/* Contenido de la Pestaña Activa */}
            <div className="p-6 overflow-y-auto flex-1">
              {loadingHistory ? (
                <div className="py-12 text-center text-neutral-400 text-sm">
                  Cargando historial del cliente...
                </div>
              ) : historyTab === 'PAYMENTS' ? (
                <div>
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-[11px] font-bold text-neutral-400 uppercase">
                        <th className="py-2.5 px-3">Fecha y Hora</th>
                        <th className="py-2.5 px-3">Método</th>
                        <th className="py-2.5 px-3">Caja</th>
                        <th className="py-2.5 px-3 text-right">Monto Abonado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {customerPayments.map(pay => (
                        <tr key={pay.id} className="hover:bg-neutral-50/70">
                          <td className="py-3 px-3 text-neutral-600 font-medium">
                            {formatDate(pay.payment_date)}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2.5 py-0.5 bg-neutral-100 text-neutral-700 rounded-full font-bold text-xs">
                              {pay.payment_method}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-neutral-500 text-xs">
                            {pay.cash_registers?.name || 'Caja Principal'}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-emerald-600">
                            + S/ {Number(pay.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {customerPayments.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-neutral-400 text-xs">
                            No hay abonos ni pagos registrados para este cliente.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div>
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-[11px] font-bold text-neutral-400 uppercase">
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Comprobante</th>
                        <th className="py-2.5 px-3">Productos Comprados</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {customerSales.map(sale => (
                        <tr key={sale.id} className="hover:bg-neutral-50/70">
                          <td className="py-3 px-3 text-neutral-600 font-medium">
                            {formatDate(sale.created_at)}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 font-mono text-xs rounded">
                              {sale.document_type || 'Ticket'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-neutral-600 text-xs">
                            {sale.sale_items?.length || 0} productos
                          </td>
                          <td className="py-3 px-3 text-right font-black text-neutral-900">
                            S/ {Number(sale.total).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {customerSales.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-neutral-400 text-xs">
                            No hay ventas asociadas a este cliente.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-5 py-2 bg-neutral-900 text-white font-bold text-xs rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
