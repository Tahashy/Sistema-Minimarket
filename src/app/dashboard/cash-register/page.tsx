'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { getPaymentMethods, PaymentMethod } from '@/utils/settings'

// Formateador de fecha y hora local
function formatDateTime(dateStr?: string | null) {
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

// Tiempo transcurrido
function formatElapsedTime(openedAt?: string | null) {
  if (!openedAt) return ''
  const start = new Date(openedAt).getTime()
  const now = Date.now()
  const diffMinutes = Math.max(0, Math.floor((now - start) / (1000 * 60)))
  if (diffMinutes < 60) return `${diffMinutes}m en turno`
  const hours = Math.floor(diffMinutes / 60)
  const mins = diffMinutes % 60
  return `${hours}h ${mins}m en turno`
}

export default function CashRegisterPage() {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current')
  
  // Estado del Turno Actual
  const [activeRegister, setActiveRegister] = useState<any>(null)
  const [lastClosedRegister, setLastClosedRegister] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [openingBalance, setOpeningBalance] = useState('')
  const [closingCash, setClosingCash] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [closedSummary, setClosedSummary] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('Administrador')
  const [liveSummary, setLiveSummary] = useState<any>(null)
  const [showLiveAmounts, setShowLiveAmounts] = useState(true)
  const [configuredPaymentMethods, setConfiguredPaymentMethods] = useState<PaymentMethod[]>([])

  // Helper para identificar si un método es considerado Efectivo físico en cajón
  const isCashMethod = (methodName: string, methodsList: PaymentMethod[] = configuredPaymentMethods) => {
    if (!methodName) return false
    const match = methodsList.find(m => m.name.toLowerCase() === methodName.toLowerCase())
    if (match) return match.type === 'CASH'
    return methodName.toLowerCase() === 'efectivo' || methodName.toLowerCase().includes('efectivo')
  }

  // Desglose de Billetes y Monedas (Calculadora Física)
  const [showDenomCalc, setShowDenomCalc] = useState(false)
  const [denominations, setDenominations] = useState<Record<string, number>>({
    '200': 0, '100': 0, '50': 0, '20': 0, '10': 0,
    '5': 0, '2': 0, '1': 0, '0.5': 0, '0.2': 0, '0.1': 0
  })

  // Historial de Arqueos
  const [history, setHistory] = useState<any[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [itemsPerHistoryPage, setItemsPerHistoryPage] = useState(10)
  
  // Modal de Detalle de Historial
  const [selectedHistory, setSelectedHistory] = useState<any>(null)
  const [historyDetails, setHistoryDetails] = useState<any>(null)

  const supabase = createClient()

  const loadConfiguredMethods = async () => {
    try {
      const m = await getPaymentMethods()
      setConfiguredPaymentMethods(m)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchUserAndRole()
    fetchActiveRegister()
    fetchLastClosedRegister()
    loadConfiguredMethods()

    const handleSettingsUpdated = () => {
      loadConfiguredMethods()
    }
    window.addEventListener('storage', handleSettingsUpdated)
    window.addEventListener('pos_settings_changed', handleSettingsUpdated)
    return () => {
      window.removeEventListener('storage', handleSettingsUpdated)
      window.removeEventListener('pos_settings_changed', handleSettingsUpdated)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory()
    }
  }, [activeTab, startDate, endDate])

  useEffect(() => {
    setHistoryPage(1)
  }, [historySearch, startDate, endDate, itemsPerHistoryPage])

  const fetchUserAndRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    if (user) {
      const { data } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
      if (data?.role) setUserRole(data.role)
    }
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  const fetchLastClosedRegister = async () => {
    const { data } = await supabase
      .from('cash_registers')
      .select('*, profiles(full_name, email)')
      .eq('status', 'Cerrada')
      .order('closed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) setLastClosedRegister(data)
  }

  const fetchActiveRegister = async () => {
    setIsLoading(true)
    const { data } = await supabase
      .from('cash_registers')
      .select('*, profiles(full_name, email)')
      .eq('status', 'Abierta')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (data) {
      setActiveRegister(data)
      calculateLiveSummary(data)
    } else {
      setActiveRegister(null)
    }
    setIsLoading(false)
  }

  const calculateLiveSummary = async (register: any) => {
    // 1. Ventas registradas
    const { data: sales } = await supabase
      .from('sales')
      .select('id, total')
      .eq('cash_register_id', register.id)
    const totalSales = sales?.reduce((sum, s) => sum + Number(s.total), 0) || 0
    
    // 2. Pagos de ventas y pagos de fiados
    const { data: sPayments } = await supabase
      .from('sale_payments')
      .select('amount, payment_method')
      .eq('cash_register_id', register.id)
    const { data: cPayments } = await supabase
      .from('customer_payments')
      .select('amount, payment_method')
      .eq('cash_register_id', register.id)
    
    const allPayments = [...(sPayments || []), ...(cPayments || [])]
    const totalCustomerPayments = cPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0

    const cashPayments = allPayments.filter(p => isCashMethod(p.payment_method)).reduce((sum, p) => sum + Number(p.amount), 0)
    const digitalPayments = allPayments.filter(p => !isCashMethod(p.payment_method) && p.payment_method !== 'Fiado').reduce((sum, p) => sum + Number(p.amount), 0)

    const expectedCash = Number(register.opening_balance) + cashPayments
    setLiveSummary({
      totalSales,
      salesCount: sales?.length || 0,
      totalCustomerPayments,
      expectedCash,
      cashPayments,
      digitalPayments,
      allPayments
    })
  }

  // Apertura de Turno
  const handleOpenRegister = async () => {
    const balance = parseFloat(openingBalance)
    if (isNaN(balance) || balance < 0) return showToast('⚠️ Ingresa un monto base válido (ej: S/ 100.00)')

    setIsLoading(true)
    const { data, error } = await supabase
      .from('cash_registers')
      .insert([{ opening_balance: balance, status: 'Abierta', cashier_id: currentUser?.id }])
      .select('*, profiles(full_name, email)')
      .single()
    
    setIsLoading(false)
    if (error) {
      return showToast('❌ Error al abrir la caja: ' + error.message)
    }

    setActiveRegister(data)
    setOpeningBalance('')
    showToast('🟢 Turno de caja iniciado exitosamente')
    calculateLiveSummary(data)
  }

  // Cierre y Arqueo de Turno
  const handleCloseRegister = async () => {
    const countedCash = parseFloat(closingCash)
    if (isNaN(countedCash) || countedCash < 0) {
      return showToast('⚠️ Ingresa cuánto dinero físico contaste en el cajón')
    }

    if (!confirm('¿Estás seguro de finalizar el turno y cerrar la caja?')) return

    setIsLoading(true)

    const { data: sales } = await supabase.from('sales').select('total').eq('cash_register_id', activeRegister.id)
    const totalSales = sales?.reduce((sum, s) => sum + Number(s.total), 0) || 0
    
    const { data: sPayments } = await supabase.from('sale_payments').select('amount, payment_method').eq('cash_register_id', activeRegister.id)
    const { data: cPayments } = await supabase.from('customer_payments').select('amount, payment_method').eq('cash_register_id', activeRegister.id)
    
    const allPayments = [...(sPayments || []), ...(cPayments || [])]
    const totalCustomerPayments = cPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
    const cashPayments = allPayments.filter(p => isCashMethod(p.payment_method)).reduce((sum, p) => sum + Number(p.amount), 0)
    const digitalPayments = allPayments.filter(p => !isCashMethod(p.payment_method) && p.payment_method !== 'Fiado').reduce((sum, p) => sum + Number(p.amount), 0)

    const expectedCash = Number(activeRegister.opening_balance) + cashPayments
    const discrepancy = countedCash - expectedCash

    const closedAt = new Date().toISOString()

    const { error: closeError } = await supabase.from('cash_registers').update({
      status: 'Cerrada',
      closing_balance: countedCash,
      closed_at: closedAt
    }).eq('id', activeRegister.id)

    if (closeError) {
      setIsLoading(false)
      return showToast('❌ Error al cerrar caja: ' + closeError.message)
    }

    const summaryObj = {
      cashier: activeRegister.profiles?.full_name || currentUser?.email || 'Usuario',
      openedAt: activeRegister.opened_at,
      closedAt: closedAt,
      openingBalance: Number(activeRegister.opening_balance),
      totalSales,
      salesCount: sales?.length || 0,
      totalCustomerPayments,
      expectedCash,
      countedCash,
      discrepancy,
      cashPayments,
      digitalPayments,
      allPayments
    }

    setClosedSummary(summaryObj)
    setActiveRegister(null)
    setClosingCash('')
    setIsLoading(false)
    showToast('🏁 Turno finalizado y registrado')
    fetchLastClosedRegister()
  }

  // Cargar Historial de Arqueos
  const fetchHistory = async () => {
    setIsLoadingHistory(true)
    let query = supabase
      .from('cash_registers')
      .select('*, profiles(full_name, email)')
      .eq('status', 'Cerrada')
      .order('closed_at', { ascending: false })
      
    if (startDate) {
      const start = new Date(startDate + 'T00:00:00')
      query = query.gte('closed_at', start.toISOString())
    }
    if (endDate) {
      const end = new Date(endDate + 'T23:59:59')
      query = query.lte('closed_at', end.toISOString())
    }

    const { data } = await query
    setHistory(data || [])
    setIsLoadingHistory(false)
  }

  // Ver Detalle de un Arqueo del Historial
  const handleViewHistoryDetails = async (reg: any) => {
    setSelectedHistory(reg)
    const { data: sales } = await supabase.from('sales').select('total').eq('cash_register_id', reg.id)
    const totalSales = sales?.reduce((sum, s) => sum + Number(s.total), 0) || 0
    
    const { data: sPayments } = await supabase.from('sale_payments').select('amount, payment_method').eq('cash_register_id', reg.id)
    const { data: cPayments } = await supabase.from('customer_payments').select('amount, payment_method').eq('cash_register_id', reg.id)
    
    const allPayments = [...(sPayments || []), ...(cPayments || [])]
    const totalCustomerPayments = cPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
    const cashPayments = allPayments.filter(p => isCashMethod(p.payment_method)).reduce((sum, p) => sum + Number(p.amount), 0)
    const digitalPayments = allPayments.filter(p => !isCashMethod(p.payment_method) && p.payment_method !== 'Fiado').reduce((sum, p) => sum + Number(p.amount), 0)

    const expectedCash = Number(reg.opening_balance) + cashPayments
    const discrepancy = Number(reg.closing_balance) - expectedCash
    
    setHistoryDetails({
      totalSales,
      salesCount: sales?.length || 0,
      totalCustomerPayments,
      expectedCash,
      countedCash: Number(reg.closing_balance),
      discrepancy,
      cashPayments,
      digitalPayments,
      allPayments
    })
  }

  // Cálculo de la Calculadora de Billetes y Monedas
  const calculatedDenomTotal = Object.entries(denominations).reduce((sum, [denom, count]) => {
    return sum + (parseFloat(denom) * (Number(count) || 0))
  }, 0)

  const applyCalculatedDenoms = () => {
    setClosingCash(calculatedDenomTotal.toFixed(2))
    setShowDenomCalc(false)
    showToast(`💵 Total calculado aplicado: S/ ${calculatedDenomTotal.toFixed(2)}`)
  }

  // Filtrado y Paginación del Historial
  const filteredHistory = history.filter(reg => {
    const q = historySearch.toLowerCase().trim()
    const cashier = (reg.profiles?.full_name || reg.profiles?.email || 'Usuario').toLowerCase()
    return !q || cashier.includes(q)
  })

  const totalHistoryPages = Math.ceil(filteredHistory.length / itemsPerHistoryPage) || 1
  const validHistoryPage = Math.min(Math.max(1, historyPage), totalHistoryPages)
  const paginatedHistory = filteredHistory.slice((validHistoryPage - 1) * itemsPerHistoryPage, validHistoryPage * itemsPerHistoryPage)

  return (
    <div className="flex flex-col h-full space-y-6 relative max-w-6xl mx-auto w-full">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-neutral-900 text-white px-5 py-3 rounded-2xl shadow-2xl z-50 animate-fade-in-up font-bold text-sm flex items-center gap-2 border border-neutral-700">
          {toastMessage}
        </div>
      )}

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight font-serif">Arqueo de Cajas</h1>
          <p className="text-neutral-500 font-medium text-sm">Gestión de turnos, cuadre físico de efectivo y auditoría de ingresos</p>
        </div>
        
        {/* Selector de Pestañas Siempre Visible */}
        <div className="flex bg-neutral-100 p-1.5 rounded-2xl shrink-0 border border-neutral-200/80">
          <button 
            type="button"
            onClick={() => setActiveTab('current')} 
            className={`px-5 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'current' 
                ? 'bg-white text-neutral-900 shadow-sm' 
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeRegister ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'}`} />
            <span>Turno Actual</span>
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('history')} 
            className={`px-5 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'history' 
                ? 'bg-white text-neutral-900 shadow-sm' 
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Historial de Arqueos</span>
          </button>
        </div>
      </div>

      {/* 4 Tarjetas KPI de Estado de Caja */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Estado del Turno */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Estado de Caja</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${activeRegister ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'}`} />
              <p className="text-xl font-black text-neutral-900">
                {activeRegister ? 'Turno Abierto' : 'Caja Cerrada'}
              </p>
            </div>
            <span className="text-xs text-neutral-500 font-medium block mt-0.5">
              {activeRegister ? formatElapsedTime(activeRegister.opened_at) : 'Sin operaciones en curso'}
            </span>
          </div>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 ${activeRegister ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-500'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Base Inicial */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Base Inicial (Sencillo)</span>
            <p className="text-2xl font-black text-neutral-900 mt-0.5">
              S/ {activeRegister ? Number(activeRegister.opening_balance).toFixed(2) : (lastClosedRegister ? Number(lastClosedRegister.opening_balance).toFixed(2) : '0.00')}
            </p>
            <span className="text-xs text-neutral-500 font-medium block mt-0.5">
              {activeRegister ? 'En cajón al abrir' : 'Del turno anterior'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>

        {/* Ventas Registradas en Turno */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Ventas del Turno</span>
            <p className="text-2xl font-black text-neutral-900 mt-0.5">
              S/ {liveSummary ? liveSummary.totalSales.toFixed(2) : '0.00'}
            </p>
            <span className="text-xs text-emerald-600 font-semibold block mt-0.5">
              {liveSummary ? `${liveSummary.salesCount} ventas realizadas` : '0 ventas'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
        </div>

        {/* Pagos Digitales (Yape / Plin / Tarjeta) */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Ingresos Digitales</span>
            <p className="text-2xl font-black text-neutral-900 mt-0.5">
              S/ {liveSummary ? liveSummary.digitalPayments.toFixed(2) : '0.00'}
            </p>
            <span className="text-xs text-indigo-600 font-semibold block mt-0.5">
              Yape, Plin y Tarjeta
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* ======================= PESTAÑA 1: TURNO ACTUAL ======================= */}
      {activeTab === 'current' && (
        <div className="space-y-6">
          
          {/* 1.1 RESUMEN TRAS CERRAR TURNO */}
          {closedSummary && !activeRegister && (
            <div className="bg-white border border-neutral-200/90 rounded-3xl p-8 shadow-sm max-w-2xl mx-auto w-full animate-fade-in">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-black text-neutral-900 font-serif">Arqueo y Cierre Finalizado</h2>
                <p className="text-neutral-500 text-xs mt-1">
                  Turno auditado con éxito por <strong>{closedSummary.cashier}</strong>
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-100">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">Base Inicial</span>
                  <p className="text-base font-black text-neutral-900 mt-0.5">S/ {closedSummary.openingBalance.toFixed(2)}</p>
                </div>
                <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-100">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">Total Ventas</span>
                  <p className="text-base font-black text-neutral-900 mt-0.5">S/ {closedSummary.totalSales.toFixed(2)}</p>
                </div>
                <div className="bg-indigo-50/70 p-3.5 rounded-2xl border border-indigo-100">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase block">Digitales</span>
                  <p className="text-base font-black text-indigo-900 mt-0.5">S/ {closedSummary.digitalPayments.toFixed(2)}</p>
                </div>
                <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-100">
                  <span className="text-[10px] font-bold text-blue-600 uppercase block">Efectivo Esperado</span>
                  <p className="text-base font-black text-blue-900 mt-0.5">S/ {closedSummary.expectedCash.toFixed(2)}</p>
                </div>
              </div>

              {/* Resultado del Cuadre */}
              <div className="flex items-center gap-4 p-5 rounded-2xl border-2 border-neutral-100 bg-neutral-50/80 mb-6">
                <div className="flex-1">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Efectivo Físico Contado</span>
                  <p className="text-2xl font-black text-neutral-900 mt-0.5">S/ {closedSummary.countedCash.toFixed(2)}</p>
                </div>
                <div className="w-px h-12 bg-neutral-200"></div>
                <div className="flex-1">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Resultado Cuadre</span>
                  {closedSummary.discrepancy === 0 ? (
                    <p className="text-xl font-black text-emerald-600 mt-0.5 flex items-center gap-1">
                      <span>✓</span> Cuadre Exacto
                    </p>
                  ) : closedSummary.discrepancy > 0 ? (
                    <p className="text-xl font-black text-emerald-600 mt-0.5">
                      Sobrante: +S/ {closedSummary.discrepancy.toFixed(2)}
                    </p>
                  ) : (
                    <p className="text-xl font-black text-red-600 mt-0.5">
                      Faltante: S/ {Math.abs(closedSummary.discrepancy).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              {/* Desglose por método de pago */}
              {closedSummary.allPayments && closedSummary.allPayments.length > 0 && (
                <div className="border border-neutral-200 rounded-2xl overflow-hidden mb-6">
                  <div className="bg-neutral-100 px-4 py-2 border-b border-neutral-200">
                    <p className="text-xs font-bold text-neutral-600 uppercase tracking-wider">
                      Desglose Consolidado de Métodos
                    </p>
                  </div>
                  <div className="p-4 space-y-2 text-xs">
                    {Object.entries(closedSummary.allPayments.reduce((acc: any, p: any) => {
                      acc[p.payment_method] = (acc[p.payment_method] || 0) + Number(p.amount)
                      return acc
                    }, {})).map(([method, amount]: any, i: number) => (
                      <div key={i} className="flex justify-between items-center">
                        <span className="font-bold text-neutral-700 bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200/80">{method}</span>
                        <span className="font-black text-neutral-900">S/ {amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Imprimir Comprobante
                </button>
                <button 
                  type="button"
                  onClick={() => setClosedSummary(null)} 
                  className="flex-1 py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Preparar Nuevo Turno
                </button>
              </div>
            </div>
          )}

          {/* 1.2 FORMULARIO DE APERTURA (Cuando la caja está cerrada) */}
          {!activeRegister && !closedSummary && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Formulario Principal */}
              <div className="lg:col-span-7 bg-white border border-neutral-200/90 rounded-3xl p-8 shadow-sm">
                <div className="flex items-center gap-3.5 mb-5 pb-5 border-b border-neutral-100">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold border border-emerald-100 shrink-0">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-neutral-900 font-serif">Abrir Nueva Caja</h2>
                    <p className="text-neutral-500 text-xs">Inicia un turno seguro ingresando el sencillo disponible en gaveta.</p>
                  </div>
                </div>

                <div className="space-y-5">
                  
                  {/* Cajero Responsable */}
                  <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-neutral-500 uppercase tracking-wider">Cajero en Turno</span>
                    <span className="font-bold text-neutral-900">
                      {currentUser?.user_metadata?.full_name || currentUser?.email || 'Usuario Principal'}
                    </span>
                  </div>

                  {/* Input Monto Base */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                      Monto Base Inicial (Sencillo) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-2xl">S/</span>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.10" 
                        autoFocus
                        value={openingBalance} 
                        onChange={e => setOpeningBalance(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-16 pr-6 py-4 bg-white border-2 border-neutral-200 rounded-2xl focus:border-emerald-500 outline-none text-3xl font-black text-neutral-900 transition-all text-center"
                      />
                    </div>
                  </div>

                  {/* Atajos Rápidos de Sencillo */}
                  <div>
                    <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
                      Montos Rápidos Sugeridos
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {[0, 50, 100, 150, 200].map(amount => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => setOpeningBalance(amount.toFixed(2))}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            openingBalance === amount.toFixed(2)
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                              : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-700'
                          }`}
                        >
                          {amount === 0 ? 'Sin base' : `S/ ${amount}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Botón Iniciar Turno */}
                  <button 
                    type="button"
                    onClick={handleOpenRegister} 
                    disabled={isLoading}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-base shadow-md shadow-emerald-200 transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                    Iniciar Turno de Caja
                  </button>
                </div>
              </div>

              {/* Columna Derecha: Información del Último Cierre */}
              <div className="lg:col-span-5 bg-white border border-neutral-200/90 rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="font-bold text-neutral-900 text-sm uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Último Turno Cerrado
                </h3>

                {lastClosedRegister ? (
                  <div className="space-y-3 text-xs">
                    <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-center justify-between">
                      <span className="text-neutral-500 font-medium">Fecha y Hora de Cierre</span>
                      <span className="font-bold text-neutral-900">{formatDateTime(lastClosedRegister.closed_at)}</span>
                    </div>

                    <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-center justify-between">
                      <span className="text-neutral-500 font-medium">Cajero Saliente</span>
                      <span className="font-bold text-neutral-900">{lastClosedRegister.profiles?.full_name || 'Usuario'}</span>
                    </div>

                    <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-center justify-between">
                      <span className="text-neutral-500 font-medium">Efectivo Dejado en Cajón</span>
                      <span className="font-black text-neutral-900 text-sm">
                        S/ {Number(lastClosedRegister.closing_balance || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
                      >
                        Ver Historial Completo de Arqueos →
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 py-6 text-center">
                    Aún no hay turnos cerrados previamente registrados.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 1.3 TURNO EN CURSO (Cuando la caja está abierta) */}
          {activeRegister && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Columna Izquierda: Auditoría y Resumen en Vivo */}
              <div className="lg:col-span-6 bg-white border border-neutral-200/90 rounded-3xl p-6 shadow-sm space-y-6">
                
                {/* Cabecera del Turno */}
                <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                    </span>
                    <div>
                      <h3 className="font-black text-neutral-900 text-base">Caja en Operación</h3>
                      <p className="text-xs text-neutral-500 font-medium">
                        Abierta el {formatDateTime(activeRegister.opened_at)}
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                    {formatElapsedTime(activeRegister.opened_at)}
                  </span>
                </div>

                {/* Métricas del Turno Activo */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Flujo de Dinero en Turno</h4>
                    <button
                      type="button"
                      onClick={() => setShowLiveAmounts(!showLiveAmounts)}
                      className="text-xs font-bold text-neutral-500 hover:text-neutral-900 cursor-pointer"
                    >
                      {showLiveAmounts ? '👁️ Ocultar cifras' : '👁️ Ver cifras'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                      <span className="text-neutral-400 font-bold uppercase block text-[10px]">Base Inicial</span>
                      <p className="text-base font-black text-neutral-900 mt-0.5">
                        {showLiveAmounts ? `S/ ${Number(activeRegister.opening_balance).toFixed(2)}` : '••••'}
                      </p>
                    </div>

                    <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                      <span className="text-neutral-400 font-bold uppercase block text-[10px]">Ventas en Efectivo</span>
                      <p className="text-base font-black text-emerald-600 mt-0.5">
                        {showLiveAmounts ? `+ S/ ${liveSummary ? liveSummary.cashPayments.toFixed(2) : '0.00'}` : '••••'}
                      </p>
                    </div>

                    <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                      <span className="text-neutral-400 font-bold uppercase block text-[10px]">Cobro de Fiados</span>
                      <p className="text-base font-black text-blue-600 mt-0.5">
                        {showLiveAmounts ? `+ S/ ${liveSummary ? liveSummary.totalCustomerPayments.toFixed(2) : '0.00'}` : '••••'}
                      </p>
                    </div>

                    <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-100">
                      <span className="text-indigo-600 font-bold uppercase block text-[10px]">Ventas Digitales</span>
                      <p className="text-base font-black text-indigo-900 mt-0.5">
                        {showLiveAmounts ? `S/ ${liveSummary ? liveSummary.digitalPayments.toFixed(2) : '0.00'}` : '••••'}
                      </p>
                    </div>
                  </div>

                  {/* Efectivo Físico Esperado en Cajón */}
                  <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-100 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                        Efectivo Esperado en Cajón
                      </span>
                      <span className="text-xs text-blue-600 font-medium">Base + Ventas y Cobros en Efectivo</span>
                    </div>
                    <p className="text-2xl font-black text-blue-900">
                      {showLiveAmounts ? `S/ ${liveSummary ? liveSummary.expectedCash.toFixed(2) : '0.00'}` : '••••'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 text-center">
                  <Link 
                    href="/dashboard/pos" 
                    className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                  >
                    <span>Ir a Punto de Venta (Cobrar pedidos)</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>

              {/* Columna Derecha: Conteo y Cierre de Turno */}
              <div className="lg:col-span-6 bg-white border border-neutral-200/90 rounded-3xl p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-neutral-900 text-base">Cierre y Arqueo Físico</h3>
                  <button
                    type="button"
                    onClick={() => setShowDenomCalc(!showDenomCalc)}
                    className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>💵</span>
                    <span>{showDenomCalc ? 'Ocultar Desglose' : 'Contar Billetes / Monedas'}</span>
                  </button>
                </div>

                {/* Calculadora de Denominaciones Desplegable */}
                {showDenomCalc && (
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80 space-y-4 animate-fade-in">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Conteo de Billetes y Monedas
                    </span>

                    {/* Billetes */}
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1.5">Billetes</span>
                      <div className="grid grid-cols-5 gap-2 text-xs">
                        {['200', '100', '50', '20', '10'].map(d => (
                          <div key={d} className="bg-white p-2 rounded-xl border border-neutral-200 text-center">
                            <span className="font-bold text-neutral-600 block text-[11px]">S/ {d}</span>
                            <input 
                              type="number" 
                              min="0"
                              value={denominations[d] || ''}
                              onChange={e => setDenominations({...denominations, [d]: parseInt(e.target.value) || 0})}
                              placeholder="0"
                              className="w-full text-center font-bold text-neutral-900 outline-none text-xs mt-1 bg-neutral-50 rounded"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Monedas */}
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1.5">Monedas</span>
                      <div className="grid grid-cols-6 gap-2 text-xs">
                        {['5', '2', '1', '0.5', '0.2', '0.1'].map(d => (
                          <div key={d} className="bg-white p-2 rounded-xl border border-neutral-200 text-center">
                            <span className="font-bold text-neutral-600 block text-[10px]">
                              {parseFloat(d) >= 1 ? `S/ ${d}` : `${Math.round(parseFloat(d) * 100)}¢`}
                            </span>
                            <input 
                              type="number" 
                              min="0"
                              value={denominations[d] || ''}
                              onChange={e => setDenominations({...denominations, [d]: parseInt(e.target.value) || 0})}
                              placeholder="0"
                              className="w-full text-center font-bold text-neutral-900 outline-none text-xs mt-1 bg-neutral-50 rounded"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase block">Total Contado</span>
                        <p className="text-lg font-black text-emerald-600">S/ {calculatedDenomTotal.toFixed(2)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={applyCalculatedDenoms}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                      >
                        Aplicar al Arqueo
                      </button>
                    </div>
                  </div>
                )}

                {/* Input Efectivo Físico Contado */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                    Efectivo Físico Contado en Cajón (S/) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-2xl">S/</span>
                    <input 
                      type="number" 
                      min="0" 
                      step="0.10" 
                      value={closingCash} 
                      onChange={e => setClosingCash(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-14 pr-4 py-3.5 bg-white border-2 border-neutral-200 rounded-2xl focus:border-neutral-900 outline-none text-3xl font-black text-neutral-900 transition-all text-center"
                    />
                  </div>
                  <p className="text-[11px] text-neutral-400 font-medium mt-1.5">
                    Incluye la base inicial de apertura más todo el efectivo recaudado en el cajón.
                  </p>
                </div>

                {/* Previsualización de Cuadre */}
                {closingCash && !isNaN(parseFloat(closingCash)) && liveSummary && (
                  <div className="p-3.5 rounded-2xl border text-xs flex items-center justify-between bg-neutral-50 border-neutral-200">
                    <span className="font-bold text-neutral-600">Diferencia proyectada:</span>
                    {parseFloat(closingCash) === liveSummary.expectedCash ? (
                      <span className="font-black text-emerald-600">✓ Cuadre Exacto (S/ 0.00)</span>
                    ) : parseFloat(closingCash) > liveSummary.expectedCash ? (
                      <span className="font-black text-emerald-600">
                        Sobrante: +S/ {(parseFloat(closingCash) - liveSummary.expectedCash).toFixed(2)}
                      </span>
                    ) : (
                      <span className="font-black text-red-600">
                        Faltante: S/ {(parseFloat(closingCash) - liveSummary.expectedCash).toFixed(2)}
                      </span>
                    )}
                  </div>
                )}

                {/* Botón Confirmar Cierre */}
                <button 
                  type="button"
                  onClick={handleCloseRegister} 
                  disabled={isLoading}
                  className="w-full py-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl font-bold text-base shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  Confirmar Cierre de Turno
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================= PESTAÑA 2: HISTORIAL DE ARQUEOS ======================= */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-fade-in">
          
          {/* Barra de Filtros del Historial */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-neutral-200/90 shadow-sm">
            <div className="relative flex-1 w-full sm:w-auto">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input 
                type="text" 
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Buscar por cajero..." 
                className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-medium"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-neutral-400">Desde:</span>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  className="bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500" 
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-neutral-400">Hasta:</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500" 
                />
              </div>
              {(startDate || endDate || historySearch) && (
                <button
                  type="button"
                  onClick={() => { setStartDate(''); setEndDate(''); setHistorySearch(''); }}
                  className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Historial */}
          <div className="bg-white border border-neutral-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4 pl-6">Fecha y Hora Cierre</th>
                    <th className="py-3 px-4">Cajero</th>
                    <th className="py-3 px-4 text-right">Base Inicial</th>
                    <th className="py-3 px-4 text-right">Monto Declarado</th>
                    <th className="py-3 px-4 pr-6 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs sm:text-sm">
                  {paginatedHistory.map(reg => (
                    <tr key={reg.id} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="py-3 px-4 pl-6">
                        <span className="font-bold text-neutral-900 block">{formatDateTime(reg.closed_at)}</span>
                        <span className="text-[11px] text-neutral-400">Apertura: {formatDateTime(reg.opened_at)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-neutral-800">
                          {reg.profiles?.full_name || reg.profiles?.email || 'Usuario Local'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-neutral-600">
                        S/ {Number(reg.opening_balance).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-neutral-900">
                        S/ {Number(reg.closing_balance || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 pr-6 text-center">
                        <button 
                          type="button"
                          onClick={() => handleViewHistoryDetails(reg)}
                          className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                        >
                          Ver Auditoría
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paginatedHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-neutral-400 font-medium">
                        {isLoadingHistory ? 'Cargando historial...' : 'No se encontraron turnos cerrados en este período.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación de Historial */}
            <div className="p-3.5 border-t border-neutral-200 bg-neutral-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-neutral-500 font-semibold">
                  Mostrando {filteredHistory.length > 0 ? ((validHistoryPage - 1) * itemsPerHistoryPage) + 1 : 0} - {Math.min(validHistoryPage * itemsPerHistoryPage, filteredHistory.length)} de {filteredHistory.length} turnos
                </span>
                <select
                  value={itemsPerHistoryPage}
                  onChange={(e) => setItemsPerHistoryPage(Number(e.target.value))}
                  className="px-2 py-1 bg-white border border-neutral-200 rounded text-xs font-medium text-neutral-700 outline-none cursor-pointer"
                >
                  <option value={10}>10 por pág.</option>
                  <option value={20}>20 por pág.</option>
                  <option value={50}>50 por pág.</option>
                </select>
              </div>
              
              {totalHistoryPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={validHistoryPage <= 1}
                    onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    ◀ Anterior
                  </button>
                  <span className="px-2 font-bold text-neutral-700">
                    {validHistoryPage} / {totalHistoryPages}
                  </span>
                  <button
                    type="button"
                    disabled={validHistoryPage >= totalHistoryPages}
                    onClick={() => setHistoryPage(prev => Math.min(totalHistoryPages, prev + 1))}
                    className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Siguiente ▶
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL DE DETALLE DEL ARQUEO (AUDITORÍA) ======================= */}
      {selectedHistory && historyDetails && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-neutral-200">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div>
                <h3 className="text-xl font-black text-neutral-900 font-serif">Auditoría del Turno</h3>
                <p className="text-xs text-neutral-500 font-medium">
                  Cierre: {formatDateTime(selectedHistory.closed_at)}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedHistory(null)} 
                className="text-neutral-400 hover:text-neutral-900 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              
              {/* Cuadrícula de Métricas */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-100">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">Base Inicial</span>
                  <p className="text-base font-black text-neutral-900 mt-0.5">S/ {Number(selectedHistory.opening_balance).toFixed(2)}</p>
                </div>
                <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-100">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">Total Ventas</span>
                  <p className="text-base font-black text-neutral-900 mt-0.5">S/ {historyDetails.totalSales.toFixed(2)}</p>
                </div>
                <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-100">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">Cobro de Fiados</span>
                  <p className="text-base font-black text-blue-600 mt-0.5">S/ {historyDetails.totalCustomerPayments.toFixed(2)}</p>
                </div>
                <div className="bg-indigo-50/70 p-3.5 rounded-2xl border border-indigo-100">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase block">Digitales (Yape/Plin)</span>
                  <p className="text-base font-black text-indigo-900 mt-0.5">S/ {historyDetails.digitalPayments.toFixed(2)}</p>
                </div>
              </div>

              {/* Desglose por método de pago */}
              {historyDetails.allPayments.length > 0 && (
                <div className="border border-neutral-200 rounded-2xl overflow-hidden">
                  <div className="bg-neutral-100 px-4 py-2 border-b border-neutral-200">
                    <p className="text-xs font-bold text-neutral-600 uppercase tracking-wider">
                      Desglose Consolidado de Pagos
                    </p>
                  </div>
                  <div className="p-4 space-y-2 text-xs">
                    {Object.entries(historyDetails.allPayments.reduce((acc: any, p: any) => {
                      acc[p.payment_method] = (acc[p.payment_method] || 0) + Number(p.amount)
                      return acc
                    }, {})).map(([method, amount]: any, i: number) => (
                      <div key={i} className="flex justify-between items-center">
                        <span className="font-bold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded">{method}</span>
                        <span className="font-bold text-neutral-900">S/ {amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Efectivo Esperado vs Declarado */}
              <div className="p-4 bg-neutral-50 rounded-2xl border-2 border-neutral-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">Efectivo Físico Contado</span>
                  <p className="text-xl font-black text-neutral-900 mt-0.5">S/ {historyDetails.countedCash.toFixed(2)}</p>
                </div>
                <div className="w-px h-10 bg-neutral-200"></div>
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">Resultado Cuadre</span>
                  {historyDetails.discrepancy === 0 ? (
                    <p className="text-base font-black text-emerald-600 mt-0.5">✓ Exacto</p>
                  ) : historyDetails.discrepancy > 0 ? (
                    <p className="text-base font-black text-emerald-600 mt-0.5">+S/ {historyDetails.discrepancy.toFixed(2)}</p>
                  ) : (
                    <p className="text-base font-black text-red-600 mt-0.5">S/ {historyDetails.discrepancy.toFixed(2)}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedHistory(null)}
                className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
