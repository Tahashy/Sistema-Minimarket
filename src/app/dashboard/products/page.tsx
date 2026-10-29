'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'

// Componente para Miniatura de Producto que maneja errores sin romper el diseño
function ProductThumbnail({ src, name }: { src?: string | null; name: string }) {
  const [error, setError] = useState(false)

  if (!src || error) {
    const initial = name ? name.trim().substring(0, 2).toUpperCase() : 'PR'
    return (
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-200 border border-neutral-200 flex items-center justify-center font-black text-neutral-400 text-xs shrink-0 select-none">
        {initial}
      </div>
    )
  }

  return (
    <img 
      src={src} 
      alt={name} 
      onError={() => setError(true)} 
      className="w-10 h-10 rounded-xl object-cover bg-neutral-100 border border-neutral-200 shrink-0" 
    />
  )
}

// Helper para calcular estado y alertas de fecha de vencimiento
function getExpirationInfo(dateStr?: string | null) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Parse YYYY-MM-DD
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

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Todas las categorías')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'bajo_stock' | 'agotados' | 'por_vencer' | 'vencidos'>('todos')
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)

  // Modales
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [productToDelete, setProductToDelete] = useState<any>(null)
  const [productToEdit, setProductToEdit] = useState<any>(null)
  
  // States
  const [categoryName, setCategoryName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  
  // Nuevo Producto
  const [newProduct, setNewProduct] = useState({
    barcode: '', 
    name: '', 
    category_id: '', 
    price: '', 
    stock: '', 
    min_stock: '20', 
    unit: 'UN',
    expiration_date: ''
  })

  // Referencias para auto-focus con escáner
  const addBarcodeRef = useRef<HTMLInputElement>(null)
  const addNameRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (showAddModal) {
      setTimeout(() => {
        addBarcodeRef.current?.focus()
      }, 100)
    }
  }, [showAddModal])

  const fetchData = async () => {
    const { data: catData } = await supabase.from('categories').select('*').order('name')
    if (catData) setCategories(catData)

    const { data: prodData } = await supabase
      .from('products')
      .select('*, categories(name)')
      .order('created_at', { ascending: false })
      
    if (prodData) {
      const formattedProd = prodData.map(p => ({
        ...p,
        category: p.categories?.name || 'Sin Categoría'
      }))
      setProducts(formattedProd)
    }
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) return
    setIsSaving(true)
    
    const { error } = await supabase.from('categories').insert([{ name: categoryName.trim() }])

    setIsSaving(false)
    if (error) {
      showToast('Error al guardar categoría.')
      console.error(error)
    } else {
      showToast('Categoría guardada correctamente.')
      setShowCategoryModal(false)
      setCategoryName('')
      fetchData()
    }
  }

  const handleSaveProduct = async () => {
    if (!newProduct.name || !newProduct.price || !newProduct.category_id) {
      showToast('Por favor completa el nombre, precio y categoría.')
      return
    }
    setIsSaving(true)
    
    const { error } = await supabase.from('products').insert([{ 
      name: newProduct.name.trim(),
      barcode: newProduct.barcode.trim() || null,
      category_id: newProduct.category_id,
      price: parseFloat(newProduct.price),
      stock: parseInt(newProduct.stock) || 0,
      min_stock: parseInt(newProduct.min_stock) || 20,
      unit: newProduct.unit,
      expiration_date: newProduct.expiration_date ? newProduct.expiration_date : null,
      image_url: null
    }])

    setIsSaving(false)
    if (error) {
      if (error.code === '23505') {
        showToast('Error: Ya existe un producto con este código de barras.')
      } else {
        showToast('Error al guardar producto.')
      }
      console.error(JSON.stringify(error, null, 2))
    } else {
      showToast('Producto registrado exitosamente.')
      setShowAddModal(false)
      setNewProduct({ barcode: '', name: '', category_id: '', price: '', stock: '', min_stock: '20', unit: 'UN', expiration_date: '' })
      fetchData()
    }
  }

  const handleUpdateProduct = async () => {
    if (!productToEdit.name || !productToEdit.price || !productToEdit.category_id) {
      showToast('Por favor completa los campos obligatorios.')
      return
    }
    setIsSaving(true)
    
    const { error } = await supabase.from('products').update({ 
      name: productToEdit.name.trim(),
      barcode: productToEdit.barcode ? productToEdit.barcode.trim() : null,
      category_id: productToEdit.category_id,
      price: parseFloat(productToEdit.price),
      stock: parseInt(productToEdit.stock) || 0,
      min_stock: parseInt(productToEdit.min_stock) || 20,
      unit: productToEdit.unit,
      expiration_date: productToEdit.expiration_date ? productToEdit.expiration_date : null
    }).eq('id', productToEdit.id)

    setIsSaving(false)
    if (error) {
      if (error.code === '23505') {
        showToast('Error: Ya existe un producto con este código de barras.')
      } else {
        showToast('Error al actualizar producto.')
      }
      console.error(JSON.stringify(error, null, 2))
    } else {
      showToast('Producto actualizado correctamente.')
      setProductToEdit(null)
      fetchData()
    }
  }

  const handleDeleteProduct = async () => {
    if (productToDelete) {
      const { error } = await supabase.from('products').delete().eq('id', productToDelete.id)
      if (!error) {
        showToast('Producto eliminado')
        setProductToDelete(null)
        fetchData()
      } else {
        showToast('Error al eliminar producto')
      }
    }
  }

  // Métricas rápidas calculadas
  const totalProductsCount = products.length
  const lowStockCount = products.filter(p => p.stock <= (p.min_stock || 20) && p.stock > 0).length
  const outOfStockCount = products.filter(p => p.stock === 0).length
  
  const expiringSoonCount = products.filter(p => {
    const info = getExpirationInfo(p.expiration_date)
    return info?.isWarning
  }).length

  const expiredCount = products.filter(p => {
    const info = getExpirationInfo(p.expiration_date)
    return info?.isExpired
  }).length

  // Filtrado de productos
  let filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchQuery))
  )

  if (selectedCategory !== 'Todas las categorías') {
    filteredProducts = filteredProducts.filter(p => p.category === selectedCategory)
  }

  if (statusFilter === 'bajo_stock') {
    filteredProducts = filteredProducts.filter(p => p.stock <= (p.min_stock || 20) && p.stock > 0)
  } else if (statusFilter === 'agotados') {
    filteredProducts = filteredProducts.filter(p => p.stock === 0)
  } else if (statusFilter === 'por_vencer') {
    filteredProducts = filteredProducts.filter(p => getExpirationInfo(p.expiration_date)?.isWarning)
  } else if (statusFilter === 'vencidos') {
    filteredProducts = filteredProducts.filter(p => getExpirationInfo(p.expiration_date)?.isExpired)
  }

  // Resetear página al filtrar
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedCategory, statusFilter, itemsPerPage])

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages)
  const paginatedProducts = filteredProducts.slice((validCurrentPage - 1) * itemsPerPage, validCurrentPage * itemsPerPage)

  return (
    <div className="flex flex-col h-full space-y-6">
      
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight">Catálogo de Productos</h1>
          <p className="text-neutral-500 font-medium text-sm">Gestiona el inventario, precios y fechas de vencimiento</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => setShowCategoryModal(true)}
            className="bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span>Categorías</span>
          </button>
          <button 
            type="button"
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all hover:shadow-md cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Tarjetas KPI interactivas (Hacen clic para filtrar) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        
        {/* Total Catálogo */}
        <button
          type="button"
          onClick={() => setStatusFilter('todos')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${statusFilter === 'todos' ? 'bg-neutral-900 border-neutral-900 text-white shadow-md' : 'bg-white border-neutral-200/80 hover:border-neutral-400 text-neutral-800'}`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${statusFilter === 'todos' ? 'text-neutral-300' : 'text-neutral-400'}`}>
            Total Catálogo
          </span>
          <span className="text-2xl font-black block mt-1">{totalProductsCount}</span>
        </button>

        {/* Bajo Stock */}
        <button
          type="button"
          onClick={() => setStatusFilter('bajo_stock')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${statusFilter === 'bajo_stock' ? 'bg-amber-500 border-amber-500 text-white shadow-md' : 'bg-white border-neutral-200/80 hover:border-amber-400 text-neutral-800'}`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${statusFilter === 'bajo_stock' ? 'text-amber-100' : 'text-amber-600'}`}>
            Stock Bajo
          </span>
          <span className="text-2xl font-black block mt-1">{lowStockCount}</span>
        </button>

        {/* Agotados */}
        <button
          type="button"
          onClick={() => setStatusFilter('agotados')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${statusFilter === 'agotados' ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-white border-neutral-200/80 hover:border-red-400 text-neutral-800'}`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${statusFilter === 'agotados' ? 'text-red-100' : 'text-red-500'}`}>
            Agotados
          </span>
          <span className="text-2xl font-black block mt-1">{outOfStockCount}</span>
        </button>

        {/* Por Vencer (30 días) */}
        <button
          type="button"
          onClick={() => setStatusFilter('por_vencer')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${statusFilter === 'por_vencer' ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-white border-neutral-200/80 hover:border-amber-400 text-neutral-800'}`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${statusFilter === 'por_vencer' ? 'text-amber-100' : 'text-amber-700'}`}>
            Por Vencer (≤30d)
          </span>
          <span className="text-2xl font-black block mt-1">{expiringSoonCount}</span>
        </button>

        {/* Vencidos */}
        <button
          type="button"
          onClick={() => setStatusFilter('vencidos')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer col-span-2 sm:col-span-1 ${statusFilter === 'vencidos' ? 'bg-red-700 border-red-700 text-white shadow-md' : 'bg-white border-neutral-200/80 hover:border-red-400 text-neutral-800'}`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${statusFilter === 'vencidos' ? 'text-red-100' : 'text-red-600'}`}>
            Vencidos
          </span>
          <span className="text-2xl font-black block mt-1">{expiredCount}</span>
        </button>

      </div>

      {/* Fila de Filtros y Búsqueda */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o código de barras..." 
            className="w-full pl-11 pr-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all outline-none text-neutral-800 text-sm shadow-sm font-medium"
          />
        </div>

        {/* Categoría */}
        <select 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-700 shadow-sm text-sm font-medium cursor-pointer"
        >
          <option>Todas las categorías</option>
          {categories.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>

        {/* Estado */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-700 shadow-sm text-sm font-medium cursor-pointer"
        >
          <option value="todos">Todos los estados</option>
          <option value="bajo_stock">⚠️ Solo Stock Bajo</option>
          <option value="agotados">❌ Solo Agotados</option>
          <option value="por_vencer">⏳ Por Vencer (≤30 días)</option>
          <option value="vencidos">⛔ Vencidos</option>
        </select>

        {/* Items por página */}
        <select
          value={itemsPerPage}
          onChange={(e) => setItemsPerPage(Number(e.target.value))}
          className="px-3 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-neutral-700 shadow-sm text-sm font-medium cursor-pointer"
          title="Productos por página"
        >
          <option value={10}>10 por pág.</option>
          <option value={15}>15 por pág.</option>
          <option value={25}>25 por pág.</option>
          <option value={50}>50 por pág.</option>
        </select>
      </div>

      {/* Contador de resultados */}
      <div className="flex items-center justify-between text-xs font-semibold text-neutral-500">
        <span>{filteredProducts.length} productos encontrados</span>
        {statusFilter !== 'todos' && (
          <button 
            type="button" 
            onClick={() => setStatusFilter('todos')} 
            className="text-emerald-600 hover:underline cursor-pointer"
          >
            Limpiar filtro de estado
          </button>
        )}
      </div>

      {/* Tabla Profesional de Productos */}
      <div className="bg-white border border-neutral-200/90 rounded-2xl shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 pl-6">Producto</th>
                <th className="py-3.5 px-4">Código</th>
                <th className="py-3.5 px-4">Categoría</th>
                <th className="py-3.5 px-4 text-right">Precio</th>
                <th className="py-3.5 px-4 text-center">Stock</th>
                <th className="py-3.5 px-4 text-center">Vencimiento</th>
                <th className="py-3.5 px-4 pr-6 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-sm">
              {paginatedProducts.map(prod => {
                const expInfo = getExpirationInfo(prod.expiration_date)

                return (
                  <tr key={prod.id} className="hover:bg-neutral-50/70 transition-colors">
                    {/* Producto (Miniatura sin error + Nombre) */}
                    <td className="py-3 px-4 pl-6">
                      <div className="flex items-center gap-3">
                        <ProductThumbnail src={prod.image_url} name={prod.name} />
                        <div className="min-w-0">
                          <span className="font-bold text-neutral-800 block truncate max-w-xs" title={prod.name}>
                            {prod.name}
                          </span>
                          <span className="text-[11px] text-neutral-400 font-medium">
                            Unidad: {prod.unit || 'UN'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Código de Barras */}
                    <td className="py-3 px-4">
                      {prod.barcode ? (
                        <span className="font-mono text-xs font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                          {prod.barcode}
                        </span>
                      ) : (
                        <span className="text-neutral-300 text-xs">-</span>
                      )}
                    </td>

                    {/* Categoría */}
                    <td className="py-3 px-4">
                      <span className="bg-neutral-100 text-neutral-700 px-2.5 py-1 rounded-full text-xs font-bold border border-neutral-200/60">
                        {prod.category}
                      </span>
                    </td>

                    {/* Precio */}
                    <td className="py-3 px-4 text-right font-black text-neutral-900">
                      S/ {prod.price.toFixed(2)}
                    </td>

                    {/* Stock Real con Estado */}
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="font-bold text-neutral-900 text-xs">
                          {prod.stock} {prod.unit || 'UN'}
                        </span>
                        {prod.stock === 0 ? (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold mt-0.5">
                            Agotado
                          </span>
                        ) : prod.stock <= (prod.min_stock || 20) ? (
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold mt-0.5">
                            Bajo (Mín: {prod.min_stock || 20})
                          </span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold mt-0.5">
                            Óptimo
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Columna de Vencimiento con Alerta */}
                    <td className="py-3 px-4 text-center">
                      {expInfo ? (
                        <span 
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${expInfo.badgeClass}`}
                          title={expInfo.date}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${expInfo.isExpired ? 'bg-red-500 animate-pulse' : expInfo.isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                          {expInfo.label}
                        </span>
                      ) : (
                        <span className="text-neutral-300 text-xs font-medium">Sin fecha</span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-4 pr-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          type="button"
                          onClick={() => setProductToEdit({
                            ...prod,
                            expiration_date: prod.expiration_date || ''
                          })} 
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Editar Producto"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button 
                          type="button"
                          onClick={() => setProductToDelete(prod)} 
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Eliminar Producto"
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

              {paginatedProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-neutral-500">
                    No hay productos que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Controles de Paginación */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-neutral-200 bg-neutral-50/60 flex items-center justify-between mt-auto">
            <span className="text-xs font-semibold text-neutral-500">
              Mostrando {Math.min((validCurrentPage - 1) * itemsPerPage + 1, filteredProducts.length)} - {Math.min(validCurrentPage * itemsPerPage, filteredProducts.length)} de {filteredProducts.length} productos
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={validCurrentPage <= 1}
                className="px-3.5 py-1.5 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                ◀ Anterior
              </button>
              <span className="text-xs font-bold text-neutral-700 bg-white border border-neutral-200 px-3 py-1.5 rounded-xl">
                {validCurrentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={validCurrentPage >= totalPages}
                className="px-3.5 py-1.5 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Siguiente ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Nuevo Producto con Campo de Vencimiento Opcional */}
      {showAddModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-neutral-900">Nuevo Producto</h3>
                <p className="text-xs text-neutral-400">Ingresa los datos para registrar en el catálogo</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-neutral-800 p-1">
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Código de Barras</label>
                <input 
                  ref={addBarcodeRef}
                  type="text" 
                  value={newProduct.barcode}
                  onChange={e => setNewProduct({...newProduct, barcode: e.target.value})}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addNameRef.current?.focus()
                    }
                  }}
                  placeholder="Escanea o escribe el código..." 
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-neutral-800 text-sm font-medium" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Nombre del Producto *</label>
                <input 
                  ref={addNameRef}
                  type="text" 
                  value={newProduct.name}
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                  placeholder="Ej: Arroz Extra 1kg" 
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-neutral-800 text-sm font-medium" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Categoría *</label>
                <select 
                  value={newProduct.category_id}
                  onChange={e => setNewProduct({...newProduct, category_id: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-neutral-800 text-sm font-medium"
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Precio Venta (S/) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={newProduct.price}
                    onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                    placeholder="0.00" 
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-neutral-800 text-sm font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Stock Inicial</label>
                  <input 
                    type="number" 
                    value={newProduct.stock}
                    onChange={e => setNewProduct({...newProduct, stock: e.target.value})}
                    placeholder="0" 
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-neutral-800 text-sm font-bold" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Alerta Stock Mínimo</label>
                  <input 
                    type="number" 
                    value={newProduct.min_stock}
                    onChange={e => setNewProduct({...newProduct, min_stock: e.target.value})}
                    placeholder="20" 
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-neutral-800 text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Unidad de Medida</label>
                  <select 
                    value={newProduct.unit}
                    onChange={e => setNewProduct({...newProduct, unit: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-neutral-800 text-sm font-medium"
                  >
                    <option value="UN">Unidad (UN)</option>
                    <option value="KG">Kilogramo (KG)</option>
                    <option value="L">Litro (L)</option>
                  </select>
                </div>
              </div>

              {/* Fecha de Vencimiento (Opcional) */}
              <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/80">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📅 Fecha de Vencimiento</span>
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-bold">Opcional</span>
                  </label>
                </div>
                <input 
                  type="date"
                  value={newProduct.expiration_date}
                  onChange={e => setNewProduct({...newProduct, expiration_date: e.target.value})}
                  className="w-full px-4 py-2 bg-white border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-neutral-800 text-sm font-medium"
                />
                <p className="text-[11px] text-amber-700 mt-1.5">
                  El sistema te alertará automáticamente en color amarillo cuando falten 30 días para vencer, y en rojo si ya caducó.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-neutral-100 flex gap-3 bg-neutral-50/50">
              <button 
                onClick={() => setShowAddModal(false)} 
                disabled={isSaving}
                className="flex-1 py-3 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-xl font-bold transition-colors text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveProduct} 
                disabled={isSaving}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 text-sm shadow-sm"
              >
                {isSaving ? 'Guardando...' : 'Crear Producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Producto con Fecha de Vencimiento */}
      {productToEdit && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-neutral-900">Editar Producto</h3>
                <p className="text-xs text-neutral-400">Modifica los detalles del producto</p>
              </div>
              <button onClick={() => setProductToEdit(null)} className="text-neutral-400 hover:text-neutral-800 p-1">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Código de Barras</label>
                <input 
                  type="text" 
                  value={productToEdit.barcode || ''}
                  onChange={e => setProductToEdit({...productToEdit, barcode: e.target.value})}
                  placeholder="Código de barras..." 
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-neutral-800 text-sm font-medium" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Nombre del Producto *</label>
                <input 
                  type="text" 
                  value={productToEdit.name || ''}
                  onChange={e => setProductToEdit({...productToEdit, name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-neutral-800 text-sm font-medium" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Categoría *</label>
                <select 
                  value={productToEdit.category_id || ''}
                  onChange={e => setProductToEdit({...productToEdit, category_id: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-neutral-800 text-sm font-medium"
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Precio (S/) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={productToEdit.price || ''}
                    onChange={e => setProductToEdit({...productToEdit, price: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-neutral-800 text-sm font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Stock Actual</label>
                  <input 
                    type="number" 
                    value={productToEdit.stock ?? ''}
                    onChange={e => setProductToEdit({...productToEdit, stock: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-neutral-800 text-sm font-bold" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Alerta Stock Mínimo</label>
                  <input 
                    type="number" 
                    value={productToEdit.min_stock ?? ''}
                    onChange={e => setProductToEdit({...productToEdit, min_stock: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-neutral-800 text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Unidad de Medida</label>
                  <select 
                    value={productToEdit.unit || 'UN'}
                    onChange={e => setProductToEdit({...productToEdit, unit: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-neutral-800 text-sm font-medium"
                  >
                    <option value="UN">Unidad (UN)</option>
                    <option value="KG">Kilogramo (KG)</option>
                    <option value="L">Litro (L)</option>
                  </select>
                </div>
              </div>

              {/* Fecha de Vencimiento Opcional */}
              <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/80">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📅 Fecha de Vencimiento</span>
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-bold">Opcional</span>
                  </label>
                </div>
                <input 
                  type="date"
                  value={productToEdit.expiration_date || ''}
                  onChange={e => setProductToEdit({...productToEdit, expiration_date: e.target.value})}
                  className="w-full px-4 py-2 bg-white border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-neutral-800 text-sm font-medium"
                />
              </div>
            </div>

            <div className="p-6 border-t border-neutral-100 flex gap-3 bg-neutral-50/50">
              <button 
                onClick={() => setProductToEdit(null)} 
                disabled={isSaving}
                className="flex-1 py-3 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-xl font-bold transition-colors text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleUpdateProduct} 
                disabled={isSaving}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 text-sm shadow-sm"
              >
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminar Producto */}
      {productToDelete && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-neutral-900 mb-1">¿Eliminar Producto?</h3>
            <p className="text-xs text-neutral-500 mb-6">¿Estás seguro de eliminar <span className="font-bold text-neutral-800">{productToDelete.name}</span>? Esta acción es permanente.</p>
            <div className="flex gap-3">
              <button onClick={() => setProductToDelete(null)} className="flex-1 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-xl text-xs font-bold transition-colors">
                Cancelar
              </button>
              <button onClick={handleDeleteProduct} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-colors shadow-sm">
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva Categoría */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-neutral-900">Nueva Categoría</h3>
                <p className="text-xs text-neutral-400">Para agrupar productos</p>
              </div>
              <button onClick={() => setShowCategoryModal(false)} className="text-neutral-400 hover:text-neutral-800 p-1">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Nombre de Categoría *</label>
                <input 
                  autoFocus 
                  type="text" 
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Ej: Abarrotes, Bebidas, Lácteos..." 
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-neutral-800 text-sm font-medium" 
                />
              </div>
            </div>
            <div className="p-6 border-t border-neutral-100 flex gap-3 bg-neutral-50/50">
              <button 
                onClick={() => setShowCategoryModal(false)} 
                className="flex-1 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-xl text-xs font-bold transition-colors"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveCategory} 
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                disabled={isSaving}
              >
                {isSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

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
