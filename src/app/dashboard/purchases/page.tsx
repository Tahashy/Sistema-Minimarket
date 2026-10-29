'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

// Helper para formatear fechas sin desfase UTC
function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—'
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
}

// Iniciales de proveedor
function SupplierAvatar({ name }: { name: string }) {
  const initials = (name || 'PR')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')

  return (
    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-200 text-amber-700 flex items-center justify-center font-black text-xs shrink-0">
      {initials}
    </div>
  )
}

export default function PurchasesPage() {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'SUPPLIERS'>('ORDERS')
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros de Órdenes
  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] = useState<'ALL' | 'Pendiente' | 'Recibida' | 'Enviada' | 'Cancelada'>('ALL')
  const [orderSort, setOrderSort] = useState<'DATE_DESC' | 'DATE_ASC' | 'TOTAL_DESC' | 'TOTAL_ASC'>('DATE_DESC')
  const [orderPage, setOrderPage] = useState(1)
  const [itemsPerOrderPage, setItemsPerOrderPage] = useState(10)

  // Filtros de Proveedores
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierCategoryFilter, setSupplierCategoryFilter] = useState('ALL')
  const [supplierPage, setSupplierPage] = useState(1)
  const [itemsPerSupplierPage, setItemsPerSupplierPage] = useState(10)
  
  // Modals state
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [supplierToEdit, setSupplierToEdit] = useState<any>(null)
  const [supplierToDelete, setSupplierToDelete] = useState<any>(null)
  
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [orderToView, setOrderToView] = useState<any>(null)
  
  const [showReceiveConfirm, setShowReceiveConfirm] = useState(false)
  const [expirationDates, setExpirationDates] = useState<Record<string, string>>({})
  
  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Formulario Nuevo Proveedor
  const [newSupplier, setNewSupplier] = useState({
    business_name: '', alias: '', ruc: '', contact_name: '', email: '', phone: '', category: ''
  })

  // Formulario Nueva Orden
  const [newOrder, setNewOrder] = useState({
    supplier_id: '',
    status: 'Pendiente',
    order_date: new Date().toISOString().split('T')[0],
    expected_date: '',
    notes: '',
    items: [] as any[]
  })

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    // 1. Proveedores
    const { data: supData } = await supabase.from('suppliers').select('*').order('business_name')
    if (supData) setSuppliers(supData)

    // 2. Catálogo de Productos
    const { data: prodData } = await supabase.from('products').select('*').order('name')
    if (prodData) setProducts(prodData)

    // 3. Órdenes de compra con detalles
    const { data: orderData } = await supabase
      .from('purchase_orders')
      .select('*, suppliers(business_name, alias, ruc, phone), purchase_order_items(*, products(name, barcode, unit))')
      .order('created_at', { ascending: false })
    
    if (orderData) setOrders(orderData)
    setIsLoading(false)
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // Reset de páginas al buscar o cambiar filtros
  useEffect(() => {
    setOrderPage(1)
  }, [orderSearch, orderStatusFilter, orderSort, itemsPerOrderPage])

  useEffect(() => {
    setSupplierPage(1)
  }, [supplierSearch, supplierCategoryFilter, itemsPerSupplierPage])

  // ---- LÓGICA DE PROVEEDORES ----
  const handleSaveSupplier = async () => {
    if (!newSupplier.business_name || !newSupplier.ruc) {
      return showToast('⚠️ RUC y Razón Social son obligatorios')
    }
    setIsSaving(true)
    
    const { error } = await supabase.from('suppliers').insert([newSupplier])
    setIsSaving(false)
    
    if (error) {
      showToast('❌ Error al guardar proveedor: ' + error.message)
    } else {
      showToast('✅ Proveedor registrado exitosamente')
      setShowSupplierModal(false)
      setNewSupplier({ business_name: '', alias: '', ruc: '', contact_name: '', email: '', phone: '', category: '' })
      fetchData()
    }
  }

  const handleUpdateSupplier = async () => {
    if (!supplierToEdit.business_name || !supplierToEdit.ruc) {
      return showToast('⚠️ RUC y Razón Social son obligatorios')
    }
    setIsSaving(true)
    
    const { error } = await supabase.from('suppliers').update(supplierToEdit).eq('id', supplierToEdit.id)
    setIsSaving(false)
    
    if (error) {
      showToast('❌ Error al actualizar proveedor')
    } else {
      showToast('✅ Proveedor actualizado exitosamente')
      setSupplierToEdit(null)
      fetchData()
    }
  }

  const handleDeleteSupplier = async (id: string) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (error) {
      showToast('❌ No se puede eliminar (Tiene órdenes asociadas)')
    } else {
      showToast('🗑️ Proveedor eliminado')
      fetchData()
    }
    setSupplierToDelete(null)
  }

  // ---- LÓGICA DE ÓRDENES ----
  const addOrderItem = () => {
    setNewOrder({
      ...newOrder,
      items: [...newOrder.items, { product_id: '', quantity: 1, unit_price: 0, total_price: 0 }]
    })
  }

  const updateOrderItem = (index: number, field: string, value: any) => {
    const updatedItems = [...newOrder.items]
    const item = { ...updatedItems[index], [field]: value }

    // Si cambia de producto y el precio unitario era 0, sugerir precio
    if (field === 'product_id' && value) {
      const selectedProd = products.find(p => p.id === value)
      if (selectedProd && (!item.unit_price || item.unit_price === 0)) {
        item.unit_price = Number((selectedProd.price * 0.75).toFixed(2))
      }
    }
    
    // Auto calcular total
    if (field === 'quantity' || field === 'unit_price' || field === 'product_id') {
      const q = Number(item.quantity) || 0
      const p = Number(item.unit_price) || 0
      item.total_price = Number((q * p).toFixed(2))
    }
    
    updatedItems[index] = item
    setNewOrder({ ...newOrder, items: updatedItems })
  }

  const removeOrderItem = (index: number) => {
    const updatedItems = [...newOrder.items]
    updatedItems.splice(index, 1)
    setNewOrder({ ...newOrder, items: updatedItems })
  }

  const handleSaveOrder = async () => {
    if (!newOrder.supplier_id) return showToast('⚠️ Selecciona un proveedor para la orden')
    if (newOrder.items.length === 0) return showToast('⚠️ Añade al menos un producto a la orden')
    
    // Verificar que los productos estén seleccionados
    const invalidItem = newOrder.items.find(i => !i.product_id || i.quantity <= 0)
    if (invalidItem) return showToast('⚠️ Todos los productos deben tener cantidad válida')

    setIsSaving(true)
    
    const total = newOrder.items.reduce((sum, item) => sum + item.total_price, 0)
    const orderNumber = `OC-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`

    // Insert Order
    const { data: orderResponse, error: orderError } = await supabase
      .from('purchase_orders')
      .insert([{
        order_number: orderNumber,
        supplier_id: newOrder.supplier_id,
        status: newOrder.status,
        total: total,
        order_date: newOrder.order_date,
        expected_date: newOrder.expected_date || null,
        notes: newOrder.notes || null
      }])
      .select()
      .single()

    if (orderError) {
      setIsSaving(false)
      return showToast('❌ Error al crear orden: ' + orderError.message)
    }

    // Insert Items
    const itemsToInsert = newOrder.items.map(item => ({
      purchase_order_id: orderResponse.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price
    }))

    await supabase.from('purchase_order_items').insert(itemsToInsert)

    setIsSaving(false)
    showToast(`✅ Orden ${orderNumber} registrada exitosamente`)
    setShowOrderModal(false)
    setNewOrder({ 
      supplier_id: '', 
      status: 'Pendiente', 
      order_date: new Date().toISOString().split('T')[0], 
      expected_date: '', 
      notes: '',
      items: [] 
    })
    fetchData()
  }

  const handleReceiveOrder = async () => {
    if (!orderToView) return
    setIsSaving(true)
    
    // 1. Actualizar estado de orden a Recibida
    await supabase.from('purchase_orders').update({ 
      status: 'Recibida', 
      received_date: new Date().toISOString().split('T')[0] 
    }).eq('id', orderToView.id)

    // 2. Iterar items para actualizar stock, Kardex y vencimientos
    for (const item of orderToView.purchase_order_items) {
      const prod = products.find(p => p.id === item.product_id)
      if (prod) {
        // Actualizar stock y fecha de vencimiento si se ingresó
        const productUpdates: any = { stock: prod.stock + item.quantity }
        if (expirationDates[item.id]) {
          productUpdates.expiration_date = expirationDates[item.id]
        }
        await supabase.from('products').update(productUpdates).eq('id', prod.id)
        
        // Agregar movimiento Kardex tipo IN
        await supabase.from('inventory_movements').insert([{
          product_id: prod.id,
          movement_type: 'IN',
          quantity: item.quantity,
          reason: `Compra - ${orderToView.order_number}`
        }])

        // Agregar Lote en product_batches
        await supabase.from('product_batches').insert([{
          product_id: prod.id,
          batch_number: `L-${orderToView.order_number}-${prod.name.substring(0,3).toUpperCase()}`,
          expiration_date: expirationDates[item.id] || null,
          initial_quantity: item.quantity,
          current_quantity: item.quantity
        }])
      }
    }
    
    setIsSaving(false)
    setShowReceiveConfirm(false)
    setShowOrderModal(false)
    setOrderToView(null)
    showToast('📦 Orden recibida. Stock y Kardex actualizados.')
    fetchData()
  }

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('¿Estás seguro de cancelar esta orden de compra? El estado cambiará a Cancelada.')) return
    setIsSaving(true)
    const { error } = await supabase.from('purchase_orders').update({ status: 'Cancelada' }).eq('id', orderId)
    setIsSaving(false)
    if (error) {
      showToast('❌ Error al cancelar orden')
    } else {
      showToast('🚫 Orden cancelada')
      setShowOrderModal(false)
      setOrderToView(null)
      fetchData()
    }
  }

  // ---- CÁLCULO DE MÉTRICAS REALES ----
  const pendingOrders = orders.filter(o => o.status === 'Pendiente').length
  const receivedOrders = orders.filter(o => o.status === 'Recibida').length
  const totalPurchases = orders
    .filter(o => o.status === 'Recibida')
    .reduce((sum, o) => sum + Number(o.total || 0), 0)

  // ---- FILTRADO Y PAGINACIÓN DE ÓRDENES ----
  const filteredOrders = orders.filter(order => {
    const q = orderSearch.toLowerCase().trim()
    const matchSearch = !q || 
      order.order_number?.toLowerCase().includes(q) ||
      order.suppliers?.business_name?.toLowerCase().includes(q) ||
      order.suppliers?.alias?.toLowerCase().includes(q) ||
      order.suppliers?.ruc?.includes(q)

    const matchStatus = orderStatusFilter === 'ALL' || order.status === orderStatusFilter
    return matchSearch && matchStatus
  }).sort((a, b) => {
    if (orderSort === 'DATE_DESC') return new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
    if (orderSort === 'DATE_ASC') return new Date(a.order_date).getTime() - new Date(b.order_date).getTime()
    if (orderSort === 'TOTAL_DESC') return Number(b.total) - Number(a.total)
    if (orderSort === 'TOTAL_ASC') return Number(a.total) - Number(b.total)
    return 0
  })

  const totalOrderPages = Math.ceil(filteredOrders.length / itemsPerOrderPage) || 1
  const validOrderPage = Math.min(Math.max(1, orderPage), totalOrderPages)
  const paginatedOrders = filteredOrders.slice((validOrderPage - 1) * itemsPerOrderPage, validOrderPage * itemsPerOrderPage)

  // ---- FILTRADO Y PAGINACIÓN DE PROVEEDORES ----
  const supplierCategories = Array.from(new Set(suppliers.map(s => s.category).filter(Boolean)))

  const filteredSuppliers = suppliers.filter(sup => {
    const q = supplierSearch.toLowerCase().trim()
    const matchSearch = !q ||
      sup.business_name?.toLowerCase().includes(q) ||
      sup.alias?.toLowerCase().includes(q) ||
      sup.ruc?.includes(q) ||
      sup.contact_name?.toLowerCase().includes(q)

    const matchCat = supplierCategoryFilter === 'ALL' || sup.category === supplierCategoryFilter
    return matchSearch && matchCat
  })

  const totalSupplierPages = Math.ceil(filteredSuppliers.length / itemsPerSupplierPage) || 1
  const validSupplierPage = Math.min(Math.max(1, supplierPage), totalSupplierPages)
  const paginatedSuppliers = filteredSuppliers.slice((validSupplierPage - 1) * itemsPerSupplierPage, validSupplierPage * itemsPerSupplierPage)

  return (
    <div className="flex flex-col h-full space-y-6 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-neutral-900 text-white px-5 py-3 rounded-2xl shadow-2xl z-50 animate-fade-in-up font-bold text-sm flex items-center gap-2 border border-neutral-700">
          {toastMessage}
        </div>
      )}

      {/* Encabezado y Botón Principal */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight font-serif">Compras</h1>
          <p className="text-neutral-500 font-medium text-sm">Gestión de proveedores, cotizaciones y órdenes de reabastecimiento</p>
        </div>
        <button 
          type="button"
          onClick={() => {
            if (activeTab === 'ORDERS') {
              setOrderToView(null)
              setNewOrder({ 
                supplier_id: '', 
                status: 'Pendiente', 
                order_date: new Date().toISOString().split('T')[0], 
                expected_date: '', 
                notes: '',
                items: [] 
              })
              setShowOrderModal(true)
            } else {
              setSupplierToEdit(null)
              setNewSupplier({ business_name: '', alias: '', ruc: '', contact_name: '', email: '', phone: '', category: '' })
              setShowSupplierModal(true)
            }
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl font-bold shadow-md shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-sm shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          {activeTab === 'ORDERS' ? 'Nueva Orden' : 'Nuevo Proveedor'}
        </button>
      </div>

      {/* 4 Tarjetas KPI Interactivas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Proveedores Activos */}
        <button
          type="button"
          onClick={() => setActiveTab('SUPPLIERS')}
          className={`p-5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
            activeTab === 'SUPPLIERS' 
              ? 'bg-amber-500 border-amber-500 text-white shadow-md' 
              : 'bg-white border-neutral-200/80 hover:border-amber-400 text-neutral-800 hover:shadow-sm'
          }`}
        >
          <div>
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${activeTab === 'SUPPLIERS' ? 'text-amber-100' : 'text-neutral-400'}`}>
              Proveedores Activos
            </span>
            <p className="text-2xl font-black mt-0.5">
              {suppliers.length} <span className={`text-xs font-medium ${activeTab === 'SUPPLIERS' ? 'text-amber-100' : 'text-neutral-500'}`}>registrados</span>
            </p>
          </div>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 ${activeTab === 'SUPPLIERS' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        </button>
        
        {/* Órdenes Pendientes */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('ORDERS')
            setOrderStatusFilter(orderStatusFilter === 'Pendiente' ? 'ALL' : 'Pendiente')
          }}
          className={`p-5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
            activeTab === 'ORDERS' && orderStatusFilter === 'Pendiente'
              ? 'bg-orange-500 border-orange-500 text-white shadow-md' 
              : 'bg-white border-neutral-200/80 hover:border-orange-400 text-neutral-800 hover:shadow-sm'
          }`}
        >
          <div>
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${activeTab === 'ORDERS' && orderStatusFilter === 'Pendiente' ? 'text-orange-100' : 'text-orange-600'}`}>
              Órdenes Pendientes
            </span>
            <p className="text-2xl font-black mt-0.5">
              {pendingOrders} <span className={`text-xs font-medium ${activeTab === 'ORDERS' && orderStatusFilter === 'Pendiente' ? 'text-orange-100' : 'text-neutral-500'}`}>por recibir</span>
            </p>
          </div>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 ${activeTab === 'ORDERS' && orderStatusFilter === 'Pendiente' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </button>

        {/* Órdenes Recibidas */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('ORDERS')
            setOrderStatusFilter(orderStatusFilter === 'Recibida' ? 'ALL' : 'Recibida')
          }}
          className={`p-5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
            activeTab === 'ORDERS' && orderStatusFilter === 'Recibida'
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' 
              : 'bg-white border-neutral-200/80 hover:border-emerald-400 text-neutral-800 hover:shadow-sm'
          }`}
        >
          <div>
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${activeTab === 'ORDERS' && orderStatusFilter === 'Recibida' ? 'text-emerald-100' : 'text-emerald-600'}`}>
              Órdenes Recibidas
            </span>
            <p className="text-2xl font-black mt-0.5">
              {receivedOrders} <span className={`text-xs font-medium ${activeTab === 'ORDERS' && orderStatusFilter === 'Recibida' ? 'text-emerald-100' : 'text-neutral-500'}`}>ingresadas</span>
            </p>
          </div>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 ${activeTab === 'ORDERS' && orderStatusFilter === 'Recibida' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </button>

        {/* Total Compras */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Total Compras</span>
            <p className="text-2xl font-black text-neutral-900 mt-0.5">
              S/ {totalPurchases.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-xs font-medium text-neutral-500 block mt-0.5">en compras recibidas</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Selector de Pestañas */}
      <div className="flex gap-2 border-b border-neutral-200 pb-2">
        <button 
          type="button"
          onClick={() => setActiveTab('ORDERS')} 
          className={`px-5 py-2.5 font-bold text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'ORDERS' 
              ? 'bg-neutral-900 text-white shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <span>Órdenes de Compra</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'ORDERS' ? 'bg-neutral-700 text-white' : 'bg-neutral-200 text-neutral-700'}`}>
            {orders.length}
          </span>
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab('SUPPLIERS')} 
          className={`px-5 py-2.5 font-bold text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'SUPPLIERS' 
              ? 'bg-neutral-900 text-white shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <span>Proveedores</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'SUPPLIERS' ? 'bg-neutral-700 text-white' : 'bg-neutral-200 text-neutral-700'}`}>
            {suppliers.length}
          </span>
        </button>
      </div>

      {/* ======================= TAB 1: ÓRDENES DE COMPRA ======================= */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-4">
          
          {/* Barra de Filtros y Búsqueda */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input 
                type="text" 
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Buscar por N° orden (ej: OC-2026), proveedor o RUC..." 
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-xs sm:text-sm font-medium shadow-sm transition-all"
              />
              {orderSearch && (
                <button 
                  onClick={() => setOrderSearch('')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filtro de Estado */}
            <select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value as any)}
              className="px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-700 text-xs sm:text-sm font-medium shadow-sm cursor-pointer"
            >
              <option value="ALL">Todos los estados ({orders.length})</option>
              <option value="Pendiente">⏳ Solo Pendientes ({pendingOrders})</option>
              <option value="Recibida">📦 Solo Recibidas ({receivedOrders})</option>
              <option value="Enviada">🚚 Solo Enviadas</option>
              <option value="Cancelada">❌ Canceladas</option>
            </select>

            {/* Ordenamiento */}
            <select
              value={orderSort}
              onChange={(e) => setOrderSort(e.target.value as any)}
              className="px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-700 text-xs sm:text-sm font-medium shadow-sm cursor-pointer"
            >
              <option value="DATE_DESC">Más recientes primero</option>
              <option value="DATE_ASC">Más antiguas primero</option>
              <option value="TOTAL_DESC">Mayor monto primero</option>
              <option value="TOTAL_ASC">Menor monto primero</option>
            </select>
          </div>

          {/* Tabla de Órdenes */}
          <div className="bg-white border border-neutral-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4 pl-6">N° Orden</th>
                    <th className="py-3.5 px-4">Proveedor</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-4 text-center">Items</th>
                    <th className="py-3.5 px-4 text-right">Total</th>
                    <th className="py-3.5 px-4 text-center">F. Pedido</th>
                    <th className="py-3.5 px-4 text-center">F. Recibida</th>
                    <th className="py-3.5 px-4 pr-6 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs sm:text-sm">
                  {paginatedOrders.map(order => (
                    <tr key={order.id} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="py-3.5 px-4 pl-6">
                        <span className="font-mono text-xs font-bold text-neutral-800 bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200 inline-block shadow-2xs">
                          {order.order_number}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <SupplierAvatar name={order.suppliers?.business_name} />
                          <div>
                            <span className="font-bold text-neutral-800 block">{order.suppliers?.business_name || 'Proveedor No Asignado'}</span>
                            {order.suppliers?.ruc && (
                              <span className="text-[11px] text-neutral-400 font-mono">RUC: {order.suppliers.ruc}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border ${
                          order.status === 'Pendiente' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          order.status === 'Recibida' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          order.status === 'Enviada' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                          'bg-red-50 text-red-800 border-red-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            order.status === 'Pendiente' ? 'bg-amber-500 animate-pulse' :
                            order.status === 'Recibida' ? 'bg-emerald-500' :
                            order.status === 'Enviada' ? 'bg-blue-500' : 'bg-red-500'
                          }`} />
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs font-semibold text-neutral-600">
                        {order.purchase_order_items?.length || 0} prod.
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-neutral-900 text-sm">
                        S/ {Number(order.total || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs font-medium text-neutral-600 whitespace-nowrap">
                        {formatDate(order.order_date)}
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs font-medium text-neutral-500 whitespace-nowrap">
                        {formatDate(order.received_date)}
                      </td>
                      <td className="py-3.5 px-4 pr-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {order.status === 'Pendiente' && (
                            <button
                              type="button"
                              onClick={() => {
                                setOrderToView(order)
                                setExpirationDates({})
                                setShowReceiveConfirm(true)
                                setShowOrderModal(true)
                              }}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                              Recibir
                            </button>
                          )}
                          <button 
                            type="button"
                            onClick={() => {
                              setOrderToView(order)
                              setExpirationDates({})
                              setShowReceiveConfirm(false)
                              setShowOrderModal(true)
                            }}
                            className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Ver
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedOrders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-neutral-400 font-medium">
                        {isLoading ? 'Cargando órdenes de compra...' : 'No se encontraron órdenes de compra que coincidan con la búsqueda.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación de Órdenes */}
            <div className="p-3.5 border-t border-neutral-200 bg-neutral-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-neutral-500 font-semibold">
                  Mostrando {filteredOrders.length > 0 ? ((validOrderPage - 1) * itemsPerOrderPage) + 1 : 0} - {Math.min(validOrderPage * itemsPerOrderPage, filteredOrders.length)} de {filteredOrders.length} órdenes
                </span>
                <select
                  value={itemsPerOrderPage}
                  onChange={(e) => setItemsPerOrderPage(Number(e.target.value))}
                  className="px-2 py-1 bg-white border border-neutral-200 rounded text-xs font-medium text-neutral-700 outline-none cursor-pointer"
                >
                  <option value={10}>10 por pág.</option>
                  <option value={20}>20 por pág.</option>
                  <option value={50}>50 por pág.</option>
                </select>
              </div>
              {totalOrderPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={validOrderPage <= 1}
                    onClick={() => setOrderPage(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    ◀ Anterior
                  </button>
                  <span className="px-2 font-bold text-neutral-700">
                    {validOrderPage} / {totalOrderPages}
                  </span>
                  <button
                    type="button"
                    disabled={validOrderPage >= totalOrderPages}
                    onClick={() => setOrderPage(prev => Math.min(totalOrderPages, prev + 1))}
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

      {/* ======================= TAB 2: PROVEEDORES ======================= */}
      {activeTab === 'SUPPLIERS' && (
        <div className="space-y-4">
          
          {/* Barra de Filtros Proveedores */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input 
                type="text" 
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                placeholder="Buscar proveedor por razón social, alias, RUC o contacto..." 
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-amber-50 focus:border-amber-500 outline-none text-neutral-800 text-xs sm:text-sm font-medium shadow-sm transition-all"
              />
              {supplierSearch && (
                <button 
                  onClick={() => setSupplierSearch('')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Categoría */}
            {supplierCategories.length > 0 && (
              <select
                value={supplierCategoryFilter}
                onChange={(e) => setSupplierCategoryFilter(e.target.value)}
                className="px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-amber-50 focus:border-amber-500 outline-none text-neutral-700 text-xs sm:text-sm font-medium shadow-sm cursor-pointer"
              >
                <option value="ALL">Todas las categorías</option>
                {supplierCategories.map((c: any) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          {/* Tabla de Proveedores */}
          <div className="bg-white border border-neutral-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4 pl-6">Proveedor</th>
                    <th className="py-3.5 px-4">RUC</th>
                    <th className="py-3.5 px-4">Contacto</th>
                    <th className="py-3.5 px-4">Teléfono / Email</th>
                    <th className="py-3.5 px-4">Categoría</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-4 pr-6 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs sm:text-sm">
                  {paginatedSuppliers.map(sup => (
                    <tr key={sup.id} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="py-3.5 px-4 pl-6">
                        <div className="flex items-center gap-3">
                          <SupplierAvatar name={sup.business_name} />
                          <div>
                            <p className="font-bold text-neutral-800">{sup.business_name}</p>
                            {sup.alias && <p className="text-xs text-neutral-400 font-medium">{sup.alias}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs font-bold text-neutral-700 bg-neutral-100 px-2.5 py-0.5 rounded border border-neutral-200">
                          {sup.ruc}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-sm font-medium text-neutral-700">
                        {sup.contact_name || <span className="text-neutral-400 italic">—</span>}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-neutral-600">
                        <p className="font-semibold text-neutral-800">{sup.phone || '—'}</p>
                        {sup.email && <p className="text-[11px] text-neutral-400">{sup.email}</p>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 bg-neutral-100 text-neutral-700 rounded-full text-xs font-bold">
                          {sup.category || 'General'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {sup.status || 'Activo'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 pr-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            type="button"
                            onClick={() => setSupplierToEdit(sup)} 
                            className="p-1.5 hover:bg-blue-50 text-neutral-400 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                            title="Editar Proveedor"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button 
                            type="button"
                            onClick={() => setSupplierToDelete(sup)} 
                            className="p-1.5 hover:bg-red-50 text-neutral-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar Proveedor"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedSuppliers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-neutral-400 font-medium">
                        {isLoading ? 'Cargando proveedores...' : 'No hay proveedores que coincidan con la búsqueda.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación Proveedores */}
            <div className="p-3.5 border-t border-neutral-200 bg-neutral-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-neutral-500 font-semibold">
                  Mostrando {filteredSuppliers.length > 0 ? ((validSupplierPage - 1) * itemsPerSupplierPage) + 1 : 0} - {Math.min(validSupplierPage * itemsPerSupplierPage, filteredSuppliers.length)} de {filteredSuppliers.length} proveedores
                </span>
                <select
                  value={itemsPerSupplierPage}
                  onChange={(e) => setItemsPerSupplierPage(Number(e.target.value))}
                  className="px-2 py-1 bg-white border border-neutral-200 rounded text-xs font-medium text-neutral-700 outline-none cursor-pointer"
                >
                  <option value={10}>10 por pág.</option>
                  <option value={20}>20 por pág.</option>
                  <option value={50}>50 por pág.</option>
                </select>
              </div>
              {totalSupplierPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={validSupplierPage <= 1}
                    onClick={() => setSupplierPage(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    ◀ Anterior
                  </button>
                  <span className="px-2 font-bold text-neutral-700">
                    {validSupplierPage} / {totalSupplierPages}
                  </span>
                  <button
                    type="button"
                    disabled={validSupplierPage >= totalSupplierPages}
                    onClick={() => setSupplierPage(prev => Math.min(totalSupplierPages, prev + 1))}
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

      {/* ======================= MODALES ======================= */}

      {/* 1. Modal Proveedor (Crear / Editar) */}
      {(showSupplierModal || supplierToEdit) && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-neutral-200">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <h3 className="text-xl font-bold text-neutral-900 font-serif">
                {supplierToEdit ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h3>
              <button 
                onClick={() => { setShowSupplierModal(false); setSupplierToEdit(null); }} 
                className="text-neutral-400 hover:text-neutral-900 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Razón Social *</label>
                  <input 
                    autoFocus 
                    type="text" 
                    value={supplierToEdit ? supplierToEdit.business_name : newSupplier.business_name} 
                    onChange={e => supplierToEdit ? setSupplierToEdit({...supplierToEdit, business_name: e.target.value}) : setNewSupplier({...newSupplier, business_name: e.target.value})} 
                    placeholder="Ej: DISTRIBUIDORA ALICORP S.A.A."
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-sm font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">RUC *</label>
                  <input 
                    type="text" 
                    value={supplierToEdit ? supplierToEdit.ruc : newSupplier.ruc} 
                    onChange={e => supplierToEdit ? setSupplierToEdit({...supplierToEdit, ruc: e.target.value}) : setNewSupplier({...newSupplier, ruc: e.target.value})} 
                    placeholder="11 dígitos"
                    maxLength={11}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-sm font-mono" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Nombre Comercial (Alias)</label>
                  <input 
                    type="text" 
                    value={supplierToEdit ? (supplierToEdit.alias || '') : newSupplier.alias} 
                    onChange={e => supplierToEdit ? setSupplierToEdit({...supplierToEdit, alias: e.target.value}) : setNewSupplier({...newSupplier, alias: e.target.value})} 
                    placeholder="Ej: Alicorp"
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-sm" 
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Nombre de Contacto / Vendedor</label>
                  <input 
                    type="text" 
                    value={supplierToEdit ? (supplierToEdit.contact_name || '') : newSupplier.contact_name} 
                    onChange={e => supplierToEdit ? setSupplierToEdit({...supplierToEdit, contact_name: e.target.value}) : setNewSupplier({...newSupplier, contact_name: e.target.value})} 
                    placeholder="Ej: Carlos Mendoza"
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Teléfono / Celular</label>
                  <input 
                    type="text" 
                    value={supplierToEdit ? (supplierToEdit.phone || '') : newSupplier.phone} 
                    onChange={e => supplierToEdit ? setSupplierToEdit({...supplierToEdit, phone: e.target.value}) : setNewSupplier({...newSupplier, phone: e.target.value})} 
                    placeholder="999 999 999"
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Rubro / Categoría</label>
                  <input 
                    type="text" 
                    value={supplierToEdit ? (supplierToEdit.category || '') : newSupplier.category} 
                    onChange={e => supplierToEdit ? setSupplierToEdit({...supplierToEdit, category: e.target.value}) : setNewSupplier({...newSupplier, category: e.target.value})} 
                    placeholder="Ej: Abarrotes, Bebidas"
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-sm" 
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-neutral-100 flex gap-3 bg-neutral-50/50">
              <button 
                type="button"
                onClick={() => { setShowSupplierModal(false); setSupplierToEdit(null); }} 
                className="flex-1 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-xl font-bold text-sm transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={supplierToEdit ? handleUpdateSupplier : handleSaveSupplier} 
                disabled={isSaving} 
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-200 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : (supplierToEdit ? 'Guardar Cambios' : 'Registrar Proveedor')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Eliminar Proveedor */}
      {supplierToDelete && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center border border-neutral-200">
            <div className="w-14 h-14 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-neutral-900 mb-1">¿Eliminar Proveedor?</h3>
            <p className="text-neutral-500 text-xs mb-6">
              Estás a punto de eliminar a <strong className="text-neutral-800">{supplierToDelete.business_name}</strong>. Esta acción no se puede deshacer si no tiene órdenes vinculadas.
            </p>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setSupplierToDelete(null)} 
                className="flex-1 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={() => handleDeleteSupplier(supplierToDelete.id)} 
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-md shadow-red-200 cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal Orden de Compra (Crear / Ver Detalle / Recibir) */}
      {(showOrderModal || orderToView) && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col border border-neutral-200">
            
            {/* Cabecera del Modal */}
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-black text-neutral-900 font-serif">
                    {orderToView ? `Orden ${orderToView.order_number}` : 'Nueva Orden de Compra'}
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">
                    {orderToView ? (showReceiveConfirm ? 'Ingreso de mercadería a almacén' : 'Detalle de la orden de compra') : 'Registra un pedido a tu proveedor'}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => { setShowOrderModal(false); setOrderToView(null); setShowReceiveConfirm(false); }} 
                className="text-neutral-400 hover:text-neutral-900 p-2 rounded-xl transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              
              {/* Información Proveedor y Fechas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-50/80 p-4 rounded-2xl border border-neutral-200/80">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Proveedor *</label>
                  {orderToView ? (
                    <div className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-neutral-900 font-bold text-sm shadow-2xs">
                      {orderToView.suppliers?.business_name || 'Sin Proveedor'}
                      {orderToView.suppliers?.ruc && <span className="block text-xs text-neutral-400 font-normal font-mono">RUC: {orderToView.suppliers.ruc}</span>}
                    </div>
                  ) : (
                    <select 
                      value={newOrder.supplier_id} 
                      onChange={e => setNewOrder({...newOrder, supplier_id: e.target.value})}
                      className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-sm font-medium shadow-2xs cursor-pointer"
                    >
                      <option value="">Selecciona un proveedor...</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.business_name} (RUC: {s.ruc})</option>)}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    {orderToView ? 'Fecha de Emisión / Pedido' : 'Fecha Estimada de Entrega'}
                  </label>
                  {orderToView ? (
                    <div className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-neutral-800 text-sm font-medium shadow-2xs flex items-center justify-between">
                      <span>{formatDate(orderToView.order_date)}</span>
                      {orderToView.received_date && (
                        <span className="text-xs text-emerald-600 font-bold">Recibido: {formatDate(orderToView.received_date)}</span>
                      )}
                    </div>
                  ) : (
                    <input 
                      type="date" 
                      value={newOrder.expected_date} 
                      onChange={e => setNewOrder({...newOrder, expected_date: e.target.value})} 
                      className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-sm shadow-2xs" 
                    />
                  )}
                </div>
              </div>

              {/* Mensaje especial al recibir orden */}
              {orderToView && showReceiveConfirm && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold">
                    ⚠️
                  </div>
                  <div className="text-xs text-amber-900 leading-relaxed">
                    <p className="font-bold text-sm text-amber-950 mb-0.5">Recepción de Mercadería</p>
                    Al confirmar, el stock de cada producto aumentará en la base de datos y se generarán los movimientos de entrada en el Kardex. Opcionalmente puedes ingresar la fecha de vencimiento de cada lote que recibas.
                  </div>
                </div>
              )}

              {/* Tabla de Productos del Pedido */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-neutral-900 text-sm uppercase tracking-wider">Productos del Pedido</h4>
                  {!orderToView && (
                    <button 
                      type="button"
                      onClick={addOrderItem} 
                      className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                      </svg>
                      Añadir Producto
                    </button>
                  )}
                </div>
                
                <div className="border border-neutral-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50/80 border-b border-neutral-200">
                      <tr className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                        <th className="py-3 px-4 pl-5">Producto del Catálogo</th>
                        <th className="py-3 px-3 w-28 text-center">Cantidad</th>
                        <th className="py-3 px-3 w-32 text-right">Costo Unit. (S/)</th>
                        <th className="py-3 px-4 w-32 text-right">Subtotal</th>
                        {!orderToView && <th className="py-3 px-2 w-12 text-center"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-xs sm:text-sm">
                      {(orderToView ? orderToView.purchase_order_items : newOrder.items).map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="py-3 px-4 pl-5">
                            {orderToView ? (
                              <div className="flex flex-col gap-1">
                                <span className="font-bold text-neutral-800">{item.products?.name || 'Producto'}</span>
                                {item.products?.barcode && (
                                  <span className="text-[11px] text-neutral-400 font-mono">Cod: {item.products.barcode}</span>
                                )}
                                
                                {/* Campo opcional de vencimiento si se está recibiendo */}
                                {showReceiveConfirm && (
                                  <div className="flex items-center gap-2 mt-1.5 bg-amber-50/80 p-2 rounded-xl border border-amber-200/80 w-max">
                                    <span className="text-xs font-bold text-amber-800">Fecha Vence:</span>
                                    <input 
                                      type="date"
                                      value={expirationDates[item.id] || ''}
                                      onChange={(e) => setExpirationDates({...expirationDates, [item.id]: e.target.value})}
                                      className="text-xs px-2.5 py-1 border border-amber-300 rounded-lg outline-none bg-white text-neutral-800 font-medium"
                                    />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <select 
                                value={item.product_id}
                                onChange={e => updateOrderItem(idx, 'product_id', e.target.value)}
                                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm outline-none focus:border-emerald-500 font-medium"
                              >
                                <option value="">Selecciona un producto...</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} — (Stock actual: {p.stock} {p.unit || 'UN'})
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {orderToView ? (
                              <span className="font-black text-neutral-800">{item.quantity} {item.products?.unit || 'UN'}</span>
                            ) : (
                              <input 
                                type="number" 
                                min="1" 
                                value={item.quantity} 
                                onChange={e => updateOrderItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm outline-none text-center font-bold" 
                              />
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {orderToView ? (
                              <span className="font-semibold text-neutral-600">S/ {Number(item.unit_price).toFixed(2)}</span>
                            ) : (
                              <input 
                                type="number" 
                                min="0" 
                                step="0.01" 
                                value={item.unit_price} 
                                onChange={e => updateOrderItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm outline-none text-right font-bold" 
                              />
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-neutral-900">
                            S/ {(Number(item.total_price || (item.quantity * item.unit_price) || 0)).toFixed(2)}
                          </td>
                          {!orderToView && (
                            <td className="py-3 px-2 text-center">
                              <button 
                                type="button"
                                onClick={() => removeOrderItem(idx)} 
                                className="text-neutral-400 hover:text-red-500 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Quitar ítem"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {!orderToView && newOrder.items.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-neutral-400 text-xs">
                            Haz clic en <strong>"Añadir Producto"</strong> para empezar a armar la orden de compra.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Observaciones (Creación) */}
              {!orderToView && (
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Notas u Observaciones (Opcional)</label>
                  <textarea 
                    value={newOrder.notes}
                    onChange={(e) => setNewOrder({...newOrder, notes: e.target.value})}
                    placeholder="Ej: Entrega por la mañana, factura a 30 días, etc."
                    rows={2}
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-800 text-xs sm:text-sm font-medium"
                  />
                </div>
              )}
            </div>

            {/* Pie del Modal con Total y Botones de Acción */}
            <div className="p-6 border-t border-neutral-100 bg-neutral-50/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-left sm:text-right w-full sm:w-auto pr-4">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Total de la Orden</span>
                <p className="text-2xl sm:text-3xl font-black text-neutral-900 font-serif">
                  S/ {orderToView 
                    ? Number(orderToView.total || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : newOrder.items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  }
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button 
                  type="button"
                  onClick={() => { setShowOrderModal(false); setOrderToView(null); setShowReceiveConfirm(false); }} 
                  className="px-5 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  Cerrar
                </button>

                {/* Si la orden está pendiente y se puede cancelar */}
                {orderToView && orderToView.status === 'Pendiente' && !showReceiveConfirm && (
                  <button 
                    type="button"
                    onClick={() => handleCancelOrder(orderToView.id)} 
                    disabled={isSaving}
                    className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancelar Orden
                  </button>
                )}

                {/* Botón de Recibir Mercadería */}
                {orderToView && orderToView.status === 'Pendiente' && (
                  showReceiveConfirm ? (
                    <button 
                      type="button"
                      onClick={handleReceiveOrder} 
                      disabled={isSaving} 
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-200 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isSaving ? 'Procesando Ingreso...' : 'Confirmar Ingreso a Almacén'}
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => setShowReceiveConfirm(true)} 
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-200 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      Recibir Mercadería
                    </button>
                  )
                )}

                {/* Botón de Guardar Nueva Orden */}
                {!orderToView && (
                  <button 
                    type="button"
                    onClick={handleSaveOrder} 
                    disabled={isSaving} 
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-200 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSaving ? 'Guardando...' : 'Generar Orden'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
