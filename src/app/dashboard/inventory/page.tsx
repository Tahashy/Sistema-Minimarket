'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams } from 'next/navigation'

// Componente para miniatura con fallback de iniciales
function ProductThumbnail({ src, name }: { src?: string | null; name: string }) {
  const [error, setError] = useState(false)

  if (!src || error) {
    const initial = name ? name.trim().substring(0, 2).toUpperCase() : 'PR'
    return (
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-200 border border-neutral-200 flex items-center justify-center font-black text-neutral-400 text-xs shrink-0 select-none">
        {initial}
      </div>
    )
  }

  return (
    <img 
      src={src} 
      alt={name} 
      onError={() => setError(true)} 
      className="w-9 h-9 rounded-xl object-cover bg-neutral-100 border border-neutral-200 shrink-0" 
    />
  )
}

// Helper para calcular estado de vencimiento
function getExpirationInfo(dateStr?: string | null) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const [year, month, day] = dateStr.split('-').map(Number)
  const exp = new Date(year, month - 1, day)
  
  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const formatted = exp.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })

  if (diffDays < 0) {
    return {
      isExpired: true,
      isWarning: false,
      badgeClass: 'bg-red-50 text-red-700 border-red-200',
      label: `Vencido (${Math.abs(diffDays)}d)`,
      date: formatted
    }
  } else if (diffDays <= 30) {
    return {
      isExpired: false,
      isWarning: true,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      label: diffDays === 0 ? 'Vence hoy' : `Vence en ${diffDays}d`,
      date: formatted
    }
  } else {
    return {
      isExpired: false,
      isWarning: false,
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      label: formatted,
      date: formatted
    }
  }
}

export default function InventoryPage() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'alerts' ? 'ALERTS' : 'KARDEX'
  
  const [products, setProducts] = useState<any[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'KARDEX' | 'ALERTS' | 'RESTOCK' | 'EXPIRATIONS'>(initialTab as any)
  
  // Filtros Kardex
  const [kardexSearch, setKardexSearch] = useState('')
  const [kardexTypeFilter, setKardexTypeFilter] = useState<'ALL' | 'IN' | 'OUT' | 'ADJUST'>('ALL')
  const [kardexPage, setKardexPage] = useState(1)
  const [itemsPerKardexPage, setItemsPerKardexPage] = useState(15)

  // Filtros Alertas
  const [alertTypeFilter, setAlertTypeFilter] = useState<'ALL' | 'OUT_OF_STOCK' | 'LOW_STOCK'>('ALL')
  const [alertSearch, setAlertSearch] = useState('')
  const [alertPage, setAlertPage] = useState(1)
  const [itemsPerAlertPage, setItemsPerAlertPage] = useState(15)

  // Filtros Vencimientos
  const [expSearch, setExpSearch] = useState('')
  const [expStatusFilter, setExpStatusFilter] = useState<'ALL' | 'EXPIRED' | 'WARNING' | 'OK'>('ALL')
  const [expPage, setExpPage] = useState(1)
  const [itemsPerExpPage, setItemsPerExpPage] = useState(15)

  // Reabastecimiento Rápido
  const [barcodeQuery, setBarcodeQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [restockQty, setRestockQty] = useState('')
  const [restockExpDate, setRestockExpDate] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Feedback
  const [toastMessage, setToastMessage] = useState('')
  
  const barcodeRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (activeTab === 'RESTOCK' && barcodeRef.current) {
      setTimeout(() => barcodeRef.current?.focus(), 100)
    }
  }, [activeTab])

  const fetchData = async () => {
    // 1. Productos
    const { data: prodData } = await supabase
      .from('products')
      .select('*, categories(name)')
      .order('name')
    if (prodData) {
      const formatted = prodData.map(p => ({
        ...p,
        category: p.categories?.name || 'Sin Categoría'
      }))
      setProducts(formatted)
    }

    // 2. Movimientos Kardex
    const { data: movData } = await supabase
      .from('inventory_movements')
      .select('*, products(name, barcode, unit)')
      .order('created_at', { ascending: false })
      .limit(300)
    if (movData) setMovements(movData)
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  // Escaneo de código de barras para reposición
  const handleBarcodeSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const query = barcodeQuery.trim().toLowerCase()
      const match = products.find(p => (p.barcode && p.barcode.toLowerCase() === query) || p.name.toLowerCase().includes(query))
      if (match) {
        setSelectedProduct(match)
        setRestockExpDate(match.expiration_date || '')
        setBarcodeQuery('')
      } else {
        showToast('Producto no encontrado')
      }
    }
  }

  const handleRestock = async () => {
    if (!selectedProduct) return
    const qty = parseInt(restockQty)
    if (isNaN(qty) || qty <= 0) {
      showToast('Ingresa una cantidad válida mayor a 0.')
      return
    }

    setIsProcessing(true)
    
    // 1. Actualizar Stock y fecha de vencimiento si se ingresó
    const newStock = selectedProduct.stock + qty
    const updatePayload: any = { stock: newStock }
    if (restockExpDate) {
      updatePayload.expiration_date = restockExpDate
    }

    await supabase.from('products').update(updatePayload).eq('id', selectedProduct.id)
    
    // 2. Insertar movimiento en Kardex
    await supabase.from('inventory_movements').insert([{
      product_id: selectedProduct.id,
      movement_type: 'IN',
      quantity: qty,
      reason: 'Ingreso Proveedor / Reposición'
    }])

    setIsProcessing(false)
    showToast(`Se sumaron +${qty} ${selectedProduct.unit || 'unid.'} a "${selectedProduct.name}"`)
    setSelectedProduct(null)
    setRestockQty('')
    setRestockExpDate('')
    fetchData()
    setTimeout(() => barcodeRef.current?.focus(), 100)
  }

  // Métricas Clave Reales
  const totalValuation = products.reduce((sum, p) => sum + (p.stock * p.price), 0)
  const totalPhysicalUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0)
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= (p.min_stock || 20)).length
  const outOfStockCount = products.filter(p => p.stock === 0).length
  
  const expiringSoonCount = products.filter(p => {
    const info = getExpirationInfo(p.expiration_date)
    return info?.isWarning
  }).length

  const expiredCount = products.filter(p => {
    const info = getExpirationInfo(p.expiration_date)
    return info?.isExpired
  }).length

  // Kardex Filtrado
  const filteredMovements = movements.filter(m => {
    const pName = (m.products?.name || '').toLowerCase()
    const pBarcode = (m.products?.barcode || '').toLowerCase()
    const reason = (m.reason || '').toLowerCase()
    const query = kardexSearch.toLowerCase()

    const matchesQuery = pName.includes(query) || pBarcode.includes(query) || reason.includes(query)
    const matchesType = kardexTypeFilter === 'ALL' || m.movement_type === kardexTypeFilter

    return matchesQuery && matchesType
  })

  const totalKardexPages = Math.ceil(filteredMovements.length / itemsPerKardexPage) || 1
  const validKardexPage = Math.min(Math.max(1, kardexPage), totalKardexPages)
  const paginatedMovements = filteredMovements.slice((validKardexPage - 1) * itemsPerKardexPage, validKardexPage * itemsPerKardexPage)

  // Lista de Alertas de Reposición Filtrada y Paginada
  const criticalProducts = products.filter(p => p.stock <= (p.min_stock || 20)).filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(alertSearch.toLowerCase()) || (p.barcode && p.barcode.includes(alertSearch))
    if (alertTypeFilter === 'OUT_OF_STOCK') return matchesSearch && p.stock === 0
    if (alertTypeFilter === 'LOW_STOCK') return matchesSearch && p.stock > 0
    return matchesSearch
  })

  const totalAlertPages = Math.ceil(criticalProducts.length / itemsPerAlertPage) || 1
  const validAlertPage = Math.min(Math.max(1, alertPage), totalAlertPages)
  const paginatedAlertProducts = criticalProducts.slice((validAlertPage - 1) * itemsPerAlertPage, validAlertPage * itemsPerAlertPage)

  // Lista de Vencimientos Filtrada y Paginada
  const expirationProducts = products.filter(p => p.expiration_date).filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(expSearch.toLowerCase()) || (p.barcode && p.barcode.includes(expSearch))
    const info = getExpirationInfo(p.expiration_date)
    if (expStatusFilter === 'EXPIRED') return matchesSearch && info?.isExpired
    if (expStatusFilter === 'WARNING') return matchesSearch && info?.isWarning
    if (expStatusFilter === 'OK') return matchesSearch && !info?.isExpired && !info?.isWarning
    return matchesSearch
  })

  const totalExpPages = Math.ceil(expirationProducts.length / itemsPerExpPage) || 1
  const validExpPage = Math.min(Math.max(1, expPage), totalExpPages)
  const paginatedExpProducts = expirationProducts.slice((validExpPage - 1) * itemsPerExpPage, validExpPage * itemsPerExpPage)

  // Resetear páginas al cambiar filtros
  useEffect(() => {
    setAlertPage(1)
  }, [alertSearch, alertTypeFilter, itemsPerAlertPage])

  useEffect(() => {
    setExpPage(1)
  }, [expSearch, expStatusFilter, itemsPerExpPage])

  useEffect(() => {
    setKardexPage(1)
  }, [kardexSearch, kardexTypeFilter, itemsPerKardexPage])

  return (
    <div className="flex flex-col h-full space-y-6">
      
      {/* Encabezado */}
      <div>
        <h1 className="text-3xl font-black text-neutral-900 tracking-tight">Inventario y Kardex</h1>
        <p className="text-neutral-500 font-medium text-sm">Control de valorización, movimientos de mercadería y alertas de stock</p>
      </div>

      {/* 4 Tarjetas KPI Alineadas Perfectamente */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Valorización Total */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Valorización Total</span>
            <p className="text-2xl font-black text-neutral-900 mt-0.5">
              S/ {totalValuation.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs font-semibold text-emerald-600 mt-1 block">
              {totalPhysicalUnits.toLocaleString()} unidades en stock
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        
        {/* Por Vencer (30 días) */}
        <button 
          type="button"
          onClick={() => {
            setActiveTab('EXPIRATIONS')
            setExpStatusFilter('WARNING')
          }}
          className={`p-5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${activeTab === 'EXPIRATIONS' ? 'bg-amber-500 border-amber-500 text-white shadow-md' : 'bg-white border-neutral-200/80 hover:border-amber-400 text-neutral-800'}`}
        >
          <div>
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${activeTab === 'EXPIRATIONS' ? 'text-amber-100' : 'text-amber-700'}`}>
              Por Vencer (≤30 d)
            </span>
            <p className="text-2xl font-black mt-0.5">
              {expiringSoonCount} <span className="text-sm font-medium opacity-80">productos</span>
            </p>
            {expiredCount > 0 && (
              <span className={`text-xs font-bold mt-1 block ${activeTab === 'EXPIRATIONS' ? 'text-red-100' : 'text-red-600'}`}>
                + {expiredCount} vencidos
              </span>
            )}
          </div>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 ${activeTab === 'EXPIRATIONS' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </button>

        {/* Stock Bajo Crítico */}
        <button 
          type="button"
          onClick={() => {
            setActiveTab('ALERTS')
            setAlertTypeFilter('LOW_STOCK')
          }}
          className={`p-5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${activeTab === 'ALERTS' && alertTypeFilter === 'LOW_STOCK' ? 'bg-amber-500 border-amber-500 text-white shadow-md' : 'bg-white border-neutral-200/80 hover:border-amber-400 text-neutral-800'}`}
        >
          <div>
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${activeTab === 'ALERTS' && alertTypeFilter === 'LOW_STOCK' ? 'text-amber-100' : 'text-amber-600'}`}>
              Stock Bajo Crítico
            </span>
            <p className="text-2xl font-black mt-0.5">
              {lowStockCount} <span className="text-sm font-medium opacity-80">productos</span>
            </p>
            <span className={`text-xs font-medium mt-1 block ${activeTab === 'ALERTS' && alertTypeFilter === 'LOW_STOCK' ? 'text-amber-100' : 'text-neutral-400'}`}>
              Por debajo del mínimo
            </span>
          </div>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 ${activeTab === 'ALERTS' && alertTypeFilter === 'LOW_STOCK' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </button>

        {/* Stock Agotado (0) */}
        <button 
          type="button"
          onClick={() => {
            setActiveTab('ALERTS')
            setAlertTypeFilter('OUT_OF_STOCK')
          }}
          className={`p-5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${activeTab === 'ALERTS' && alertTypeFilter === 'OUT_OF_STOCK' ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-white border-neutral-200/80 hover:border-red-400 text-neutral-800'}`}
        >
          <div>
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${activeTab === 'ALERTS' && alertTypeFilter === 'OUT_OF_STOCK' ? 'text-red-100' : 'text-red-600'}`}>
              Stock Agotado (0)
            </span>
            <p className="text-2xl font-black mt-0.5">
              {outOfStockCount} <span className="text-sm font-medium opacity-80">productos</span>
            </p>
            <span className={`text-xs font-medium mt-1 block ${activeTab === 'ALERTS' && alertTypeFilter === 'OUT_OF_STOCK' ? 'text-red-100' : 'text-neutral-400'}`}>
              Requieren reposición
            </span>
          </div>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 ${activeTab === 'ALERTS' && alertTypeFilter === 'OUT_OF_STOCK' ? 'bg-red-700 text-white' : 'bg-red-50 text-red-600'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016zM12 9v2m0 4h.01" />
            </svg>
          </div>
        </button>

      </div>

      {/* Pestañas de Navegación */}
      <div className="flex items-center gap-2 border-b border-neutral-200 overflow-x-auto scrollbar-hide">
        <button 
          onClick={() => setActiveTab('KARDEX')} 
          className={`px-5 py-3 font-bold text-xs sm:text-sm transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${activeTab === 'KARDEX' ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-700'}`}
        >
          <span>Historial de Movimientos (KARDEX)</span>
          <span className="bg-neutral-100 text-neutral-600 text-xs px-2 py-0.5 rounded-full font-bold">
            {movements.length}
          </span>
        </button>
        <button 
          onClick={() => {
            setActiveTab('ALERTS')
            setAlertTypeFilter('ALL')
          }} 
          className={`px-5 py-3 font-bold text-xs sm:text-sm transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${activeTab === 'ALERTS' ? 'border-red-600 text-red-600' : 'border-transparent text-neutral-400 hover:text-neutral-700'}`}
        >
          <span>Reposición Crítica</span>
          {(lowStockCount + outOfStockCount) > 0 && (
            <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold">
              {lowStockCount + outOfStockCount}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('EXPIRATIONS')} 
          className={`px-5 py-3 font-bold text-xs sm:text-sm transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${activeTab === 'EXPIRATIONS' ? 'border-amber-500 text-amber-700' : 'border-transparent text-neutral-400 hover:text-neutral-700'}`}
        >
          <span>Lotes y Vencimientos</span>
          {(expiringSoonCount + expiredCount) > 0 && (
            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">
              {expiringSoonCount + expiredCount}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('RESTOCK')} 
          className={`px-5 py-3 font-bold text-xs sm:text-sm transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${activeTab === 'RESTOCK' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-neutral-400 hover:text-neutral-700'}`}
        >
          <span>⚡ Reabastecimiento con Pistola</span>
        </button>
      </div>

      {/* Contenido según Pestaña Activa */}
      <div className="flex-1 flex flex-col">
        
        {/* 1. TAB KARDEX */}
        {activeTab === 'KARDEX' && (
          <div className="space-y-4">
            
            {/* Filtros de Kardex */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input 
                  type="text" 
                  value={kardexSearch}
                  onChange={(e) => {
                    setKardexSearch(e.target.value)
                    setKardexPage(1)
                  }}
                  placeholder="Buscar movimiento por producto, código o motivo..." 
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-xs sm:text-sm font-medium shadow-sm"
                />
              </div>

              <select
                value={kardexTypeFilter}
                onChange={(e) => {
                  setKardexTypeFilter(e.target.value as any)
                  setKardexPage(1)
                }}
                className="px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-700 text-xs sm:text-sm font-medium shadow-sm cursor-pointer"
              >
                <option value="ALL">Todos los tipos de movimiento</option>
                <option value="IN">⬇ Solo Entradas (Compras / Ingresos)</option>
                <option value="OUT">⬆ Solo Salidas (Ventas)</option>
                <option value="ADJUST">🔄 Ajustes de Inventario</option>
              </select>
            </div>

            {/* Tabla Kardex */}
            <div className="bg-white border border-neutral-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      <th className="py-3 px-4 pl-6">Fecha y Hora</th>
                      <th className="py-3 px-4">Producto</th>
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4 text-center">Tipo</th>
                      <th className="py-3 px-4 text-center">Cantidad</th>
                      <th className="py-3 px-4 pr-6">Motivo / Operación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-xs sm:text-sm">
                    {paginatedMovements.map(mov => (
                      <tr key={mov.id} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="py-3 px-4 pl-6 text-neutral-500 font-medium whitespace-nowrap">
                          {new Date(mov.created_at).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 font-bold text-neutral-800">
                          {mov.products?.name || 'Producto Desconocido'}
                        </td>
                        <td className="py-3 px-4">
                          {mov.products?.barcode ? (
                            <span className="font-mono text-xs text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                              {mov.products.barcode}
                            </span>
                          ) : (
                            <span className="text-neutral-300 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {mov.movement_type === 'IN' ? (
                            <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1">
                              ↓ ENTRADA
                            </span>
                          ) : mov.movement_type === 'OUT' ? (
                            <span className="bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1">
                              ↑ SALIDA
                            </span>
                          ) : (
                            <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1">
                              🔄 AJUSTE
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-black text-sm">
                          <span className={mov.movement_type === 'IN' ? 'text-emerald-600' : 'text-neutral-900'}>
                            {mov.movement_type === 'IN' ? '+' : '-'}{mov.quantity} {mov.products?.unit || 'UN'}
                          </span>
                        </td>
                        <td className="py-3 px-4 pr-6 text-neutral-600 font-medium">
                          {mov.reason || 'Sin motivo especificado'}
                        </td>
                      </tr>
                    ))}
                    {paginatedMovements.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-neutral-500 font-medium">
                          No se encontraron movimientos que coincidan con la búsqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginación Kardex */}
              <div className="p-3.5 border-t border-neutral-200 bg-neutral-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500 font-semibold">
                    Mostrando {filteredMovements.length > 0 ? ((validKardexPage - 1) * itemsPerKardexPage) + 1 : 0} - {Math.min(validKardexPage * itemsPerKardexPage, filteredMovements.length)} de {filteredMovements.length} movimientos
                  </span>
                  <select
                    value={itemsPerKardexPage}
                    onChange={(e) => setItemsPerKardexPage(Number(e.target.value))}
                    className="px-2 py-1 bg-white border border-neutral-200 rounded text-xs font-medium text-neutral-700 outline-none cursor-pointer"
                  >
                    <option value={15}>15 por pág.</option>
                    <option value={30}>30 por pág.</option>
                    <option value={50}>50 por pág.</option>
                    <option value={100}>100 por pág.</option>
                  </select>
                </div>
                {totalKardexPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={validKardexPage <= 1}
                      onClick={() => setKardexPage(prev => Math.max(1, prev - 1))}
                      className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      ◀ Anterior
                    </button>
                    <span className="px-2 font-bold text-neutral-700">
                      {validKardexPage} / {totalKardexPages}
                    </span>
                    <button
                      type="button"
                      disabled={validKardexPage >= totalKardexPages}
                      onClick={() => setKardexPage(prev => Math.min(totalKardexPages, prev + 1))}
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

        {/* 2. TAB ALERTAS DE REPOSICIÓN */}
        {activeTab === 'ALERTS' && (
          <div className="space-y-4">
            
            {/* Barra de Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  value={alertSearch}
                  onChange={(e) => setAlertSearch(e.target.value)}
                  placeholder="Buscar producto a reponer..." 
                  className="w-full pl-4 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-red-50 focus:border-red-500 outline-none text-neutral-800 text-xs sm:text-sm font-medium shadow-sm"
                />
              </div>

              <select
                value={alertTypeFilter}
                onChange={(e) => setAlertTypeFilter(e.target.value as any)}
                className="px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-red-50 focus:border-red-500 outline-none text-neutral-700 text-xs sm:text-sm font-medium shadow-sm cursor-pointer"
              >
                <option value="ALL">Todos los críticos ({criticalProducts.length})</option>
                <option value="OUT_OF_STOCK">❌ Solo Agotados ({outOfStockCount})</option>
                <option value="LOW_STOCK">⚠️ Solo Stock Bajo ({lowStockCount})</option>
              </select>
            </div>

            {/* Tabla de Reposición */}
            <div className="bg-white border border-neutral-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      <th className="py-3 px-4 pl-6">Estado</th>
                      <th className="py-3 px-4">Producto</th>
                      <th className="py-3 px-4 text-center">Stock Actual</th>
                      <th className="py-3 px-4 text-center">Mínimo Requerido</th>
                      <th className="py-3 px-4 text-center">Sugerido a Comprar</th>
                      <th className="py-3 px-4 pr-6 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-xs sm:text-sm">
                    {paginatedAlertProducts.map(prod => {
                      const suggested = Math.max(10, ((prod.min_stock || 20) - prod.stock) + 10)

                      return (
                        <tr key={prod.id} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="py-3 px-4 pl-6">
                            {prod.stock === 0 ? (
                              <span className="bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full text-xs font-black inline-flex items-center gap-1 animate-pulse">
                                AGOTADO TOTAL
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1">
                                STOCK BAJO
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <ProductThumbnail src={prod.image_url} name={prod.name} />
                              <div>
                                <span className="font-bold text-neutral-800 block">{prod.name}</span>
                                <span className="text-xs text-neutral-400 font-mono">Cod: {prod.barcode || 'N/A'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center font-black text-sm text-neutral-900">
                            {prod.stock} {prod.unit || 'UN'}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-neutral-500 text-xs">
                            {prod.min_stock || 20} {prod.unit || 'UN'}
                          </td>
                          <td className="py-3 px-4 text-center font-black text-emerald-600 text-sm">
                            +{suggested} {prod.unit || 'UN'}
                          </td>
                          <td className="py-3 px-4 pr-6 text-center">
                            <button 
                              type="button"
                              onClick={() => {
                                setSelectedProduct(prod)
                                setRestockQty(suggested.toString())
                                setRestockExpDate(prod.expiration_date || '')
                                setActiveTab('RESTOCK')
                              }} 
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                            >
                              Reabastecer
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {criticalProducts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-neutral-500 font-medium">
                          ¡Excelente! No hay productos con stock crítico en este momento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginación Alertas */}
              <div className="p-3.5 border-t border-neutral-200 bg-neutral-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500 font-semibold">
                    Mostrando {criticalProducts.length > 0 ? ((validAlertPage - 1) * itemsPerAlertPage) + 1 : 0} - {Math.min(validAlertPage * itemsPerAlertPage, criticalProducts.length)} de {criticalProducts.length} productos
                  </span>
                  <select
                    value={itemsPerAlertPage}
                    onChange={(e) => setItemsPerAlertPage(Number(e.target.value))}
                    className="px-2 py-1 bg-white border border-neutral-200 rounded text-xs font-medium text-neutral-700 outline-none cursor-pointer"
                  >
                    <option value={15}>15 por pág.</option>
                    <option value={30}>30 por pág.</option>
                    <option value={50}>50 por pág.</option>
                    <option value={100}>100 por pág.</option>
                  </select>
                </div>
                {totalAlertPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={validAlertPage <= 1}
                      onClick={() => setAlertPage(prev => Math.max(1, prev - 1))}
                      className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      ◀ Anterior
                    </button>
                    <span className="px-2 font-bold text-neutral-700">
                      {validAlertPage} / {totalAlertPages}
                    </span>
                    <button
                      type="button"
                      disabled={validAlertPage >= totalAlertPages}
                      onClick={() => setAlertPage(prev => Math.min(totalAlertPages, prev + 1))}
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

        {/* 3. TAB LOTES Y VENCIMIENTOS (Totalmente implementado) */}
        {activeTab === 'EXPIRATIONS' && (
          <div className="space-y-4">
            
            {/* Barra de Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  value={expSearch}
                  onChange={(e) => setExpSearch(e.target.value)}
                  placeholder="Buscar producto por nombre o código..." 
                  className="w-full pl-4 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-amber-50 focus:border-amber-500 outline-none text-neutral-800 text-xs sm:text-sm font-medium shadow-sm"
                />
              </div>

              <select
                value={expStatusFilter}
                onChange={(e) => setExpStatusFilter(e.target.value as any)}
                className="px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-amber-50 focus:border-amber-500 outline-none text-neutral-700 text-xs sm:text-sm font-medium shadow-sm cursor-pointer"
              >
                <option value="ALL">Todos los productos con fecha ({expirationProducts.length})</option>
                <option value="WARNING">⏳ Por Vencer (≤30 días) ({expiringSoonCount})</option>
                <option value="EXPIRED">⛔ Vencidos ({expiredCount})</option>
                <option value="OK">🟢 Vigentes</option>
              </select>
            </div>

            {/* Tabla de Vencimientos */}
            <div className="bg-white border border-neutral-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      <th className="py-3 px-4 pl-6">Estado</th>
                      <th className="py-3 px-4">Producto</th>
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4 text-center">Stock Actual</th>
                      <th className="py-3 px-4 text-center">Fecha de Caducidad</th>
                      <th className="py-3 px-4 pr-6 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-xs sm:text-sm">
                    {paginatedExpProducts.map(prod => {
                      const expInfo = getExpirationInfo(prod.expiration_date)

                      return (
                        <tr key={prod.id} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="py-3 px-4 pl-6">
                            {expInfo && (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${expInfo.badgeClass}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${expInfo.isExpired ? 'bg-red-500 animate-pulse' : expInfo.isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                                {expInfo.label}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <ProductThumbnail src={prod.image_url} name={prod.name} />
                              <span className="font-bold text-neutral-800">{prod.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-neutral-500">
                            {prod.barcode || '-'}
                          </td>
                          <td className="py-3 px-4 text-center font-black text-neutral-900">
                            {prod.stock} {prod.unit || 'UN'}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-neutral-700">
                            {expInfo?.date || prod.expiration_date}
                          </td>
                          <td className="py-3 px-4 pr-6 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProduct(prod)
                                setRestockExpDate(prod.expiration_date || '')
                                setActiveTab('RESTOCK')
                              }}
                              className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              Actualizar Stock
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {expirationProducts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-neutral-500 font-medium">
                          No hay productos registrados con fecha de vencimiento que coincidan con el filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginación Vencimientos */}
              <div className="p-3.5 border-t border-neutral-200 bg-neutral-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500 font-semibold">
                    Mostrando {expirationProducts.length > 0 ? ((validExpPage - 1) * itemsPerExpPage) + 1 : 0} - {Math.min(validExpPage * itemsPerExpPage, expirationProducts.length)} de {expirationProducts.length} productos
                  </span>
                  <select
                    value={itemsPerExpPage}
                    onChange={(e) => setItemsPerExpPage(Number(e.target.value))}
                    className="px-2 py-1 bg-white border border-neutral-200 rounded text-xs font-medium text-neutral-700 outline-none cursor-pointer"
                  >
                    <option value={15}>15 por pág.</option>
                    <option value={30}>30 por pág.</option>
                    <option value={50}>50 por pág.</option>
                    <option value={100}>100 por pág.</option>
                  </select>
                </div>
                {totalExpPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={validExpPage <= 1}
                      onClick={() => setExpPage(prev => Math.max(1, prev - 1))}
                      className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      ◀ Anterior
                    </button>
                    <span className="px-2 font-bold text-neutral-700">
                      {validExpPage} / {totalExpPages}
                    </span>
                    <button
                      type="button"
                      disabled={validExpPage >= totalExpPages}
                      onClick={() => setExpPage(prev => Math.min(totalExpPages, prev + 1))}
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

        {/* 4. TAB REABASTECIMIENTO CON PISTOLA */}
        {activeTab === 'RESTOCK' && (
          <div className="bg-white border border-neutral-200/90 rounded-3xl shadow-sm p-8 max-w-xl mx-auto w-full mt-4 flex flex-col items-center">
            
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 border border-emerald-100 shadow-sm">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-black text-neutral-900 mb-1">Ingreso Rápido de Mercadería</h2>
            <p className="text-neutral-400 text-xs text-center mb-6">Escanea el código de barras o escribe el nombre del producto para sumar stock.</p>

            <div className="w-full space-y-5">
              {!selectedProduct ? (
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">Escáner / Buscador</label>
                  <input 
                    ref={barcodeRef}
                    type="text" 
                    value={barcodeQuery}
                    onChange={(e) => setBarcodeQuery(e.target.value)}
                    onKeyDown={handleBarcodeSubmit}
                    placeholder="Pasa la pistola o escribe aquí..."
                    className="w-full px-5 py-4 bg-neutral-50 border-2 border-dashed border-emerald-200 rounded-2xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-base font-medium text-neutral-800 text-center transition-all shadow-inner"
                  />
                  <p className="text-[11px] text-neutral-400 text-center mt-2">Presiona Enter después de escanear o escribir</p>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="bg-emerald-50/70 border border-emerald-200/80 p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ProductThumbnail src={selectedProduct.image_url} name={selectedProduct.name} />
                      <div>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Producto Seleccionado</span>
                        <h3 className="text-base font-black text-neutral-900">{selectedProduct.name}</h3>
                        <p className="text-xs text-neutral-500 font-medium">Stock actual: {selectedProduct.stock} {selectedProduct.unit || 'UN'}</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        setSelectedProduct(null)
                        setRestockQty('')
                        setRestockExpDate('')
                      }} 
                      className="text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                      ¿Cuántas unidades ingresan al almacén? *
                    </label>
                    <input 
                      autoFocus
                      type="number" 
                      min="1"
                      value={restockQty}
                      onChange={(e) => setRestockQty(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRestock()
                      }}
                      placeholder="Ej: 24"
                      className="w-full px-4 py-3 bg-white border-2 border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-lg font-bold text-neutral-800 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Fecha de Vencimiento de este lote</span>
                      <span className="text-[10px] text-neutral-400 font-normal">Opcional</span>
                    </label>
                    <input 
                      type="date"
                      value={restockExpDate}
                      onChange={(e) => setRestockExpDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-neutral-800"
                    />
                  </div>

                  <div className="pt-2">
                    <button 
                      type="button"
                      onClick={handleRestock}
                      disabled={isProcessing}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {isProcessing ? 'Guardando ingreso...' : 'Confirmar Ingreso al Kardex'}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-neutral-900 text-white px-5 py-3 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2 z-[200] animate-in slide-in-from-bottom-4">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          {toastMessage}
        </div>
      )}
    </div>
  )
}
