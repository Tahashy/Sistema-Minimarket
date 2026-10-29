'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import qz from 'qz-tray'
import { getPaymentMethods, getStoreSettings, PaymentMethod, StoreSettings } from '@/utils/settings'

function ProductImage({ src, name }: { src?: string | null; name: string }) {
  const [error, setError] = useState(false)

  if (!src || error) {
    const initial = name ? name.trim().substring(0, 2).toUpperCase() : 'PR'
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200/90 text-neutral-400 select-none">
        <span className="text-sm font-black tracking-wider text-neutral-400">
          {initial}
        </span>
      </div>
    )
  }

  return (
    <img 
      src={src} 
      alt={name} 
      onError={() => setError(true)} 
      className="w-full h-full object-cover mix-blend-multiply" 
    />
  )
}

export default function PosPage() {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  
  const [cart, setCart] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [documentType, setDocumentType] = useState('Boleta')

  // Vista, Paginación y Filtros de Productos
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [hideOutOfStock, setHideOutOfStock] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // Producto Libre / Varios
  const [showCustomProductModal, setShowCustomProductModal] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customQty, setCustomQty] = useState('1')
  const [customPrice, setCustomPrice] = useState('')
  const priceInputRef = useRef<HTMLInputElement>(null)

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [lastSale, setLastSale] = useState<any>(null)
  const [payments, setPayments] = useState<{method: string, amount: number}[]>([])
  const [paymentAmount, setPaymentAmount] = useState('')
  const [selectedMethod, setSelectedMethod] = useState('Efectivo')
  const [isProcessing, setIsProcessing] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Customers & Fiado
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')

  // Dynamic Payment Methods & Store Settings
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<PaymentMethod[]>([])
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null)

  // Cash Register
  const [activeRegister, setActiveRegister] = useState<any>(null)
  const [isLoadingRegister, setIsLoadingRegister] = useState(true)

  // QZ Tray
  const [printerName, setPrinterName] = useState<string>('')
  const [qzConnected, setQzConnected] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchProducts()
    fetchCustomers()
    fetchActiveRegister()
    fetchConfig()
    
    // Setup QZ Tray
    const savedPrinterName = localStorage.getItem('pos_printer_name') || ''
    setPrinterName(savedPrinterName)
    
    if (savedPrinterName && !qz.websocket.isActive()) {
      qz.websocket.connect()
        .then(() => setQzConnected(true))
        .catch((err: any) => console.error("Error conectando a QZ Tray", err))
    }
    // Atajo de teclado F2 para abrir modal de Producto Libre
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        setShowCustomProductModal(true)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)

    // Listen to changes in settings or payment methods
    const handleSettingsUpdated = () => {
      fetchConfig()
    }
    window.addEventListener('storage', handleSettingsUpdated)
    window.addEventListener('pos_settings_changed', handleSettingsUpdated)

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
      window.removeEventListener('storage', handleSettingsUpdated)
      window.removeEventListener('pos_settings_changed', handleSettingsUpdated)
    }
  }, [])

  const fetchConfig = async () => {
    try {
      const [methods, settings] = await Promise.all([
        getPaymentMethods(),
        getStoreSettings()
      ])
      const activeMethods = methods.filter(m => m.is_active)
      setAvailablePaymentMethods(activeMethods)
      setStoreSettings(settings)
      if (activeMethods.length > 0 && !activeMethods.some(m => m.name === selectedMethod)) {
        setSelectedMethod(activeMethods[0].name)
      }
    } catch (err) {
      console.error('Error fetching POS config:', err)
    }
  }

  const fetchActiveRegister = async () => {
    const { data } = await supabase.from('cash_registers').select('*').eq('status', 'Abierta').order('opened_at', { ascending: false }).limit(1).single()
    setActiveRegister(data || null)
    setIsLoadingRegister(false)
  }

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('full_name')
    if (data) setCustomers(data)
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  const handleAddCustomProduct = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanPriceStr = customPrice.toString().replace(',', '.')
    const parsedPrice = parseFloat(cleanPriceStr)
    const parsedQty = parseFloat(customQty) || 1

    if (!customName.trim()) {
      showToast('Ingresa una descripción para el producto.')
      return
    }

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      showToast('Ingresa un precio válido mayor a 0.')
      return
    }

    const newItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: customName.trim(),
      price: parsedPrice,
      qty: parsedQty,
      isCustom: true
    }

    setCart(prev => [...prev, newItem])
    setShowCustomProductModal(false)
    setCustomName('')
    setCustomQty('1')
    setCustomPrice('')
    showToast(`"${newItem.name}" agregado a la venta.`)
  }

  const imprimirConQZ = async (sale: any) => {
    if (!printerName) {
      showToast("No hay impresora configurada para QZ Tray.")
      return
    }
    
    try {
      if (!qz.websocket.isActive()) {
        await qz.websocket.connect()
        setQzConnected(true)
      }
      
      const config = qz.configs.create(printerName)
      
      const printData = [
        // Initialize printer
        '\x1B\x40', 
        // Open Cash Drawer (ESC p m t1 t2)
        '\x1B\x70\x00\x19\xFA',
        // Center alignment
        '\x1B\x61\x01', 
        `${storeSettings?.store_name || "MINIMARKET"}\n`,
        storeSettings?.ruc ? `RUC: ${storeSettings.ruc}\n` : "RUC: 20123456789\n",
        storeSettings?.address ? `${storeSettings.address}\n` : "Av. Los Olivos 123, Lima\n",
        storeSettings?.phone ? `Tel: ${storeSettings.phone}\n` : "",
        "--------------------------------\n",
        `${sale.documentType.toUpperCase()} ELECTRONICA\n`,
        `${sale.documentType === 'Factura' ? 'F001' : 'B001'}-${sale.id.split('-')[0].toUpperCase()}\n`,
        `${sale.date}\n`,
        "--------------------------------\n",
        // Left alignment
        '\x1B\x61\x00', 
      ]

      sale.cart.forEach((item: any) => {
        let line = `${item.qty} x ${item.name.substring(0, 15)}`
        let totalStr = `S/ ${(item.qty * item.price).toFixed(2)}`
        // Padding for 32 chars (typical 58mm printer)
        let spaces = 32 - line.length - totalStr.length
        if (spaces > 0) {
          line += " ".repeat(spaces) + totalStr
        } else {
          line += " " + totalStr
        }
        printData.push(line + "\n")
      })

      printData.push("--------------------------------\n")
      // Right align for totals
      printData.push('\x1B\x61\x02') 
      printData.push(`SUBTOTAL: S/ ${sale.subtotal.toFixed(2)}\n`)
      printData.push(`IGV (18%): S/ ${sale.igv.toFixed(2)}\n`)
      printData.push(`TOTAL: S/ ${sale.total.toFixed(2)}\n`)
      
      printData.push("--------------------------------\n")
      sale.payments.forEach((p: any) => {
        printData.push(`PAGO ${p.method.toUpperCase()}: S/ ${p.amount.toFixed(2)}\n`)
      })
      printData.push(`VUELTO: S/ ${sale.change.toFixed(2)}\n`)
      
      // Center align for footer
      printData.push('\x1B\x61\x01') 
      const footerLines = (storeSettings?.ticket_footer_text || storeSettings?.ticket_footer || "¡Gracias por su compra!\nVuelva pronto").split('\n')
      footerLines.forEach((fl: string) => printData.push(`${fl}\n`))
      
      // Feed and cut paper (partial cut: ESC m)
      printData.push('\x0A\x0A\x0A\x0A\x0A\x0A\x1B\x6D')
      
      await qz.print(config, printData)
      showToast("Ticket impreso correctamente")
    } catch (err: any) {
      console.error(err)
      showToast("Error al imprimir: " + err.message)
    }
  }

  const fetchProducts = async () => {
    const { data: prodData } = await supabase.from('products').select('*, categories(name)').order('name')
    if (prodData) {
      const formatted = prodData.map(p => ({
        ...p,
        category: p.categories?.name || 'Sin Categoría',
        img: p.image_url || null
      }))
      setProducts(formatted)
      const cats = Array.from(new Set(formatted.map(p => p.category)))
      setCategories(cats as string[])
    }
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price * (Number(item.qty) || 0)), 0)
  const igv = subtotal * 0.18
  const total = Number((subtotal + igv).toFixed(2))

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = Number(Math.max(0, total - totalPaid).toFixed(2))
  const change = Number(Math.max(0, totalPaid - total).toFixed(2))

  const itemsPerPage = viewMode === 'grid' ? 24 : 30

  let filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.barcode && p.barcode.includes(searchQuery)))
  if (selectedCategory !== 'Todos') {
    filteredProducts = filteredProducts.filter(p => p.category === selectedCategory)
  }
  if (hideOutOfStock) {
    filteredProducts = filteredProducts.filter(p => p.stock > 0)
  }

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages)
  const paginatedProducts = filteredProducts.slice(
    (validCurrentPage - 1) * itemsPerPage,
    validCurrentPage * itemsPerPage
  )

  const addToCart = (product: any) => {
    if (product.stock <= 0) {
      showToast(`El producto "${product.name}" está agotado.`)
      return
    }
    
    const existing = cart.find(item => item.id === product.id)
    if (existing) {
      if (existing.qty >= product.stock) {
        showToast(`Solo quedan ${product.stock} unidades de "${product.name}".`)
        return
      }
      updateQty(product.id, 1)
    } else {
      setCart([...cart, { id: product.id, name: product.name, price: product.price, qty: 1, img: product.img }])
    }
  }

  const updateQty = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const currentQty = Number(item.qty) || 0
        const newQty = Number((currentQty + delta).toFixed(3))

        // Si es producto libre, no tiene límite de stock
        if (item.isCustom) {
          return { ...item, qty: newQty > 0 ? newQty : 1 }
        }

        const product = products.find(p => p.id === id)
        if (product && newQty > product.stock) {
          showToast(`Solo quedan ${product.stock} unidades de "${product.name}".`)
          return item
        }
        
        return { ...item, qty: newQty > 0 ? newQty : 1 }
      }
      return item
    }))
  }

  const setExactQty = (id: string, qtyStr: string) => {
    if (qtyStr === '') {
      setCart(cart.map(item => item.id === id ? { ...item, qty: '' } : item))
      return
    }
    const newQty = parseFloat(qtyStr)
    if (!isNaN(newQty) && newQty >= 0) {
      const existing = cart.find(item => item.id === id)
      if (existing?.isCustom) {
        setCart(cart.map(item => item.id === id ? { ...item, qty: newQty } : item))
        return
      }

      const product = products.find(p => p.id === id)
      if (product && newQty > product.stock) {
        showToast(`Solo quedan ${product.stock} unidades de "${product.name}".`)
        setCart(cart.map(item => item.id === id ? { ...item, qty: product.stock } : item))
        return
      }
      setCart(cart.map(item => item.id === id ? { ...item, qty: newQty } : item))
    }
  }

  const removeItem = (id: string) => {
    setCart(cart.filter(item => item.id !== id))
  }

  const handleCobrarClick = () => {
    if (cart.length === 0) return
    setShowPaymentModal(true)
    setPaymentAmount(total.toFixed(2))
    setPayments([])
  }

  const handleAddPayment = () => {
    const cleanStr = paymentAmount.toString().replace(',', '.')
    const amt = parseFloat(cleanStr)
    if (!isNaN(amt) && amt > 0) {
      setPayments([...payments, { method: selectedMethod, amount: amt }])
      const newRemaining = remaining - amt
      setPaymentAmount(newRemaining > 0 ? newRemaining.toFixed(2) : '0.00')
    }
  }

  const handleRemovePayment = (index: number) => {
    const newPayments = [...payments]
    newPayments.splice(index, 1)
    setPayments(newPayments)
    const newTotalPaid = newPayments.reduce((sum, p) => sum + p.amount, 0)
    const newRem = Math.max(0, total - newTotalPaid)
    setPaymentAmount(newRem > 0 ? newRem.toFixed(2) : '0.00')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const match = products.find(p => p.barcode === searchQuery || p.name.toLowerCase() === searchQuery.toLowerCase())
      if (match) {
        addToCart(match)
        setSearchQuery('')
      } else if (filteredProducts.length === 1) {
        addToCart(filteredProducts[0])
        setSearchQuery('')
      } else if (searchQuery.trim() !== '') {
        // Si no se encuentra en el inventario, ofrecer agregarlo como producto libre
        setCustomName(searchQuery.trim())
        setCustomQty('1')
        setCustomPrice('')
        setShowCustomProductModal(true)
        setSearchQuery('')
      }
    }
  }

  const handleConfirmSale = async () => {
    if (totalPaid + 0.01 < total) return
    
    // Validations
    const hasFiado = payments.some(p => p.method === 'Fiado')
    if (hasFiado && !selectedCustomerId) {
      showToast('Debes seleccionar un cliente para realizar una venta al crédito (Fiado).')
      return
    }
    
    const selectedCustomer = customers.find(c => c.id === selectedCustomerId)
    if (documentType === 'Factura') {
      if (!selectedCustomer) {
        showToast('Debes seleccionar un cliente con RUC para emitir Factura.')
        return
      }
      if (selectedCustomer.document_type !== 'RUC') {
        showToast('El cliente seleccionado debe tener RUC para emitir Factura.')
        return
      }
    }

    setIsProcessing(true)

    try {
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{ 
          subtotal, 
          tax: igv, 
          total, 
          document_type: documentType, 
          status: 'Completada',
          customer_id: selectedCustomerId || null,
          cash_register_id: activeRegister?.id || null
        }])
        .select()
        .single()
      
      if (saleError) throw saleError

      for (const item of cart) {
        const itemQty = Number(item.qty) || 1
        await supabase.from('sale_items').insert([{
          sale_id: saleData.id,
          product_id: item.isCustom ? null : item.id,
          description: item.name,
          quantity: itemQty,
          unit_price: item.price,
          subtotal: Number((item.price * itemQty).toFixed(2))
        }])

        // Solo descontar inventario y Kardex si es un producto registrado del catálogo
        if (!item.isCustom) {
          const p = products.find(prod => prod.id === item.id)
          if (p) {
            const newStock = Math.max(0, p.stock - itemQty)
            await supabase.from('products').update({ stock: newStock }).eq('id', item.id)
            
            // Registrar salida en kardex
            await supabase.from('inventory_movements').insert([{
              product_id: item.id,
              movement_type: 'OUT',
              quantity: Math.ceil(itemQty),
              reason: 'Venta ' + saleData.document_type
            }])

            // Lógica FIFO para descontar lotes (Vencimientos)
            const { data: batches } = await supabase
              .from('product_batches')
              .select('*')
              .eq('product_id', item.id)
              .gt('current_quantity', 0)
              .order('expiration_date', { ascending: true, nullsFirst: false })
            
            if (batches && batches.length > 0) {
              let remainingToDeduct = itemQty;
              for (const batch of batches) {
                if (remainingToDeduct <= 0) break;
                
                const deductAmount = Math.min(batch.current_quantity, remainingToDeduct);
                await supabase.from('product_batches').update({
                  current_quantity: batch.current_quantity - deductAmount
                }).eq('id', batch.id);
                
                remainingToDeduct -= deductAmount;
              }
            }
          }
        }
      }

      // Handle Fiado (Increase Debt)
      if (hasFiado && selectedCustomer) {
        const fiadoTotal = payments.filter(p => p.method === 'Fiado').reduce((sum, p) => sum + p.amount, 0)
        const newDebt = Number(selectedCustomer.debt_balance) + fiadoTotal
        await supabase.from('customers').update({ debt_balance: newDebt }).eq('id', selectedCustomer.id)
      }

      // Record payments in sale_payments table
      for (const p of payments) {
        await supabase.from('sale_payments').insert([{
          sale_id: saleData.id,
          cash_register_id: activeRegister?.id || null,
          amount: p.amount,
          payment_method: p.method
        }])
      }

      const saleDataObj = {
        id: saleData.id,
        cart: [...cart],
        subtotal,
        igv,
        total,
        totalPaid,
        change,
        payments: [...payments],
        documentType,
        customerName: selectedCustomer ? selectedCustomer.full_name : 'Público General',
        customerDoc: selectedCustomer ? `${selectedCustomer.document_type}: ${selectedCustomer.document_number}` : '',
        date: new Date().toLocaleString('es-PE')
      }

      setLastSale(saleDataObj)
      
      const autoPrint = localStorage.getItem('pos_printer_autoprint') === 'true'
      if (autoPrint) {
        if (printerName) {
          imprimirConQZ(saleDataObj)
        } else {
          // If no printer name but autoPrint is true, use window.print fallback after a small delay to render modal
          setTimeout(() => window.print(), 500)
        }
      }
      
      setCart([])
      setShowPaymentModal(false)
      setSelectedCustomerId('')
      setIsProcessing(false)
    } catch (error) {
      console.error(error)
      showToast("Error al procesar la venta.")
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoadingRegister) {
    return <div className="p-8 text-neutral-500 font-bold">Verificando estado de la caja...</div>
  }

  if (!activeRegister) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center border-2 border-red-100 shadow-xl animate-in zoom-in-95">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-2xl font-black text-neutral-900 mb-2">Caja Cerrada</h2>
          <p className="text-neutral-500 mb-8">Debes abrir turno en el módulo de Cajas para poder procesar ventas.</p>
          <a href="/dashboard/cash-register" className="block w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-sm">
            Ir a Abrir Caja
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[calc(100vh-8rem)] relative">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-[9999] font-bold flex items-center gap-2 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {toastMessage}
        </div>
      )}
      
      <div className="flex-1 min-w-0 flex flex-col space-y-6">
        <div className="flex gap-3 items-stretch">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder="Escanear código de barras o buscar producto..." 
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-emerald-100 border-dashed rounded-2xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all outline-none text-lg text-neutral-700 shadow-sm"
            />
          </div>
          <button 
            type="button"
            onClick={() => {
              setCustomName('')
              setCustomQty('1')
              setCustomPrice('')
              setShowCustomProductModal(true)
            }}
            className="px-5 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold flex items-center gap-2 shadow-sm transition-all shrink-0 hover:shadow-md cursor-pointer"
            title="Agregar producto sin código o libre (Atajo: F2)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Producto Libre</span>
            <span className="bg-amber-600/70 text-amber-100 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">F2</span>
          </button>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => {
              setSelectedCategory('Todos')
              setCurrentPage(1)
            }}
            className={`flex-shrink-0 px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 shadow-sm transition-colors ${selectedCategory === 'Todos' ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:border-emerald-500 hover:text-emerald-700'}`}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button 
              key={cat} 
              onClick={() => {
                setSelectedCategory(cat)
                setCurrentPage(1)
              }}
              className={`flex-shrink-0 px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 transition-colors ${selectedCategory === cat ? 'bg-neutral-900 text-white shadow-sm' : 'bg-white border border-neutral-200 text-neutral-600 hover:border-emerald-500 hover:text-emerald-700'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Barra de control: Contador, Filtro de stock y Selector de vista */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-neutral-200/80 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-neutral-100 text-neutral-700 px-3 py-1.5 rounded-xl">
              {filteredProducts.length} productos
            </span>
            {filteredProducts.length > 0 && (
              <span className="text-xs text-neutral-400 font-medium hidden sm:inline">
                Página {validCurrentPage} de {totalPages}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Toggle Ocultar Agotados */}
            <label className="flex items-center gap-2 text-xs font-bold text-neutral-600 cursor-pointer select-none bg-neutral-50 hover:bg-neutral-100 px-3 py-1.5 rounded-xl border border-neutral-200 transition-colors">
              <input 
                type="checkbox" 
                checked={hideOutOfStock}
                onChange={(e) => {
                  setHideOutOfStock(e.target.checked)
                  setCurrentPage(1)
                }}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
              />
              <span>Solo con stock</span>
            </label>

            {/* Selector Cuadrícula / Lista */}
            <div className="flex items-center bg-neutral-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white text-emerald-600 shadow-sm font-bold' : 'text-neutral-400 hover:text-neutral-700'}`}
                title="Vista Cuadrícula Compacta"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white text-emerald-600 shadow-sm font-bold' : 'text-neutral-400 hover:text-neutral-700'}`}
                title="Vista Lista Rápida"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Contenedor de Productos */}
        {viewMode === 'grid' ? (
          /* Modo Cuadrícula Compacta */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto pr-1">
            {paginatedProducts.map(prod => (
              <div 
                key={prod.id} 
                onClick={() => addToCart(prod)} 
                className={`bg-white rounded-2xl border transition-all cursor-pointer group flex flex-col overflow-hidden select-none ${prod.stock === 0 ? 'border-red-100 opacity-60 bg-red-50/20' : 'border-neutral-200/80 hover:border-emerald-500 hover:shadow-md hover:-translate-y-0.5'}`}
              >
                <div className="h-28 bg-neutral-50 relative flex items-center justify-center overflow-hidden border-b border-neutral-100">
                  <ProductImage src={prod.img} name={prod.name} />
                  
                  {cart.find(i => i.id === prod.id) && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-500 text-white text-xs font-black rounded-full flex items-center justify-center shadow-md animate-in zoom-in-75">
                      {cart.find(i => i.id === prod.id)?.qty}
                    </div>
                  )}
                  {prod.stock === 0 && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
                      <span className="bg-red-500 text-white px-2.5 py-0.5 rounded-full font-bold text-[11px] shadow-sm">Agotado</span>
                    </div>
                  )}
                </div>

                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block truncate mb-0.5">{prod.category}</span>
                    <h4 className="text-xs font-bold text-neutral-800 leading-snug line-clamp-2 min-h-[2rem]" title={prod.name}>
                      {prod.name}
                    </h4>
                  </div>
                  <div className="flex items-end justify-between mt-2 pt-2 border-t border-neutral-50">
                    <div>
                      <p className="text-base font-black text-neutral-900 leading-none">S/ {prod.price.toFixed(2)}</p>
                      <p className={`text-[10px] font-semibold mt-0.5 ${prod.stock === 0 ? 'text-red-500' : prod.stock <= 5 ? 'text-amber-600' : 'text-neutral-400'}`}>
                        {prod.stock} en stock
                      </p>
                    </div>
                    <button 
                      type="button" 
                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${prod.stock === 0 ? 'bg-neutral-100 text-neutral-300 cursor-not-allowed' : 'bg-emerald-50 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white shadow-sm'}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Modo Lista Rápida */
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm divide-y divide-neutral-100">
            {paginatedProducts.map(prod => (
              <div 
                key={prod.id} 
                onClick={() => addToCart(prod)}
                className={`p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer select-none ${prod.stock === 0 ? 'opacity-50 bg-neutral-50' : 'hover:bg-emerald-50/50'}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 shrink-0 overflow-hidden border border-neutral-200 relative flex items-center justify-center">
                    <ProductImage src={prod.img} name={prod.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-neutral-800 truncate" title={prod.name}>
                      {prod.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <span>{prod.category}</span>
                      {prod.barcode && <span>• {prod.barcode}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-black text-neutral-900">S/ {prod.price.toFixed(2)}</p>
                    <p className={`text-[11px] font-semibold ${prod.stock === 0 ? 'text-red-500' : prod.stock <= 5 ? 'text-amber-600' : 'text-neutral-400'}`}>
                      {prod.stock} en stock
                    </p>
                  </div>

                  {cart.find(i => i.id === prod.id) ? (
                    <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                      {cart.find(i => i.id === prod.id)?.qty}
                    </div>
                  ) : (
                    <button 
                      type="button"
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${prod.stock === 0 ? 'bg-neutral-100 text-neutral-300' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Estado Vacío */}
        {filteredProducts.length === 0 && (
          <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200 border-dashed space-y-2">
            <p className="text-neutral-600 font-bold text-base">No se encontraron productos</p>
            <p className="text-neutral-400 text-xs">
              Prueba cambiando la categoría seleccionada o quitando el filtro de búsqueda.
            </p>
            {hideOutOfStock && (
              <button 
                type="button"
                onClick={() => setHideOutOfStock(false)}
                className="mt-2 text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
              >
                Mostrar también productos agotados
              </button>
            )}
          </div>
        )}

        {/* Paginación Rápida */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-neutral-200 shadow-sm mt-1">
            <button
              type="button"
              disabled={validCurrentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="px-3.5 py-1.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>◀</span>
              <span>Anterior</span>
            </button>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-neutral-500">Pág.</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                {validCurrentPage}
              </span>
              <span className="text-xs font-medium text-neutral-500">de {totalPages}</span>
            </div>

            <button
              type="button"
              disabled={validCurrentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-3.5 py-1.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Siguiente</span>
              <span>▶</span>
            </button>
          </div>
        )}
      </div>

      <div className="w-full lg:w-[420px] shrink-0 bg-white rounded-3xl shadow-sm border border-neutral-200 flex flex-col overflow-hidden h-[calc(100vh-7rem)] sticky top-6">
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-lg font-bold text-neutral-900">Venta Actual</h3>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{cart.length} items</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => {
                setCustomName('')
                setCustomQty('1')
                setCustomPrice('')
                setShowCustomProductModal(true)
              }}
              className="text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              title="Agregar producto libre o sin código (Atajo: F2)"
            >
              <span>+ Libre</span>
            </button>
            <button className="text-xs font-bold text-neutral-400 hover:text-red-500 flex items-center gap-1 transition-colors" onClick={() => setCart([])}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Vaciar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {cart.map(item => (
            <div key={item.id} className="flex gap-4 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-sm font-bold text-neutral-800 line-clamp-1">{item.name}</h4>
                  {item.isCustom && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">Libre</span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 mb-2">S/ {item.price.toFixed(2)} c/u</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-100">-</button>
                  <input 
                    type="number" 
                    step="any"
                    value={item.qty} 
                    onChange={(e) => setExactQty(item.id, e.target.value)}
                    onBlur={(e) => { if (!e.target.value || Number(e.target.value) === 0) setExactQty(item.id, '1') }}
                    className="w-12 text-center text-sm font-bold bg-transparent outline-none border-b-2 border-transparent focus:border-emerald-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                  />
                  <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-50">+</button>
                </div>
              </div>
              <div className="flex flex-col justify-between items-end">
                <button onClick={() => removeItem(item.id)} className="text-neutral-300 hover:text-red-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <p className="font-bold text-neutral-900">S/ {(item.price * (Number(item.qty) || 0)).toFixed(2)}</p>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400 gap-2">
              <svg className="w-12 h-12 text-neutral-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              <p className="text-sm font-medium">El carrito está vacío</p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-neutral-100 bg-white space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 font-medium">Subtotal</span>
              <span className="font-semibold text-neutral-800">S/ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 font-medium">IGV (18%)</span>
              <span className="font-semibold text-neutral-800">S/ {igv.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg pt-2 border-t border-neutral-100 border-dashed">
              <span className="font-black text-neutral-900">TOTAL</span>
              <span className="font-black text-emerald-600">S/ {total.toFixed(2)}</span>
            </div>
          </div>
          <button onClick={handleCobrarClick} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:bg-neutral-300 disabled:cursor-not-allowed" disabled={cart.length === 0}>
            Cobrar S/ {total.toFixed(2)}
          </button>
          <div className="flex gap-2">
            <button onClick={() => setDocumentType('Boleta')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors border ${documentType === 'Boleta' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Boleta
            </button>
            <button onClick={() => setDocumentType('Factura')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors border ${documentType === 'Factura' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m3-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              Factura
            </button>
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-100 flex flex-col gap-4 bg-neutral-50/50">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900">Completar Pago</h3>
                <button onClick={() => setShowPaymentModal(false)} className="w-8 h-8 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-2">Cliente (Opcional, Obligatorio para Factura/Fiado)</label>
                <select 
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-neutral-800 font-medium"
                >
                  <option value="">Público General</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.document_type}: {c.document_number})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                <div>
                  <p className="text-sm font-semibold text-emerald-600">Total a Cobrar</p>
                  <p className="text-3xl font-black text-emerald-700">S/ {total.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-neutral-500">Restante</p>
                  <p className={`text-xl font-bold ${remaining > 0 ? 'text-red-500' : 'text-emerald-500'}`}>S/ {remaining.toFixed(2)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-800 mb-3">Método de pago</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1">
                  {(availablePaymentMethods.length > 0 
                    ? [
                        ...availablePaymentMethods,
                        ...(availablePaymentMethods.some(m => m.name.toLowerCase() === 'fiado') ? [] : [{
                          id: 'fiado-opt',
                          name: 'Fiado',
                          type: 'DIGITAL' as const,
                          color: 'bg-amber-500',
                          icon: 'credit',
                          is_active: true
                        }])
                      ]
                    : [
                        { id: '1', name: 'Efectivo', type: 'CASH', color: 'bg-emerald-500' },
                        { id: '2', name: 'Tarjeta', type: 'DIGITAL', color: 'bg-blue-500' },
                        { id: '3', name: 'Yape', type: 'DIGITAL', color: 'bg-purple-600' },
                        { id: '4', name: 'Plin', type: 'DIGITAL', color: 'bg-cyan-500' },
                        { id: '5', name: 'Fiado', type: 'DIGITAL', color: 'bg-amber-500' },
                      ]
                  ).map((method: any) => {
                    const isSelected = selectedMethod === method.name
                    return (
                      <button 
                        key={method.id || method.name}
                        type="button"
                        onClick={() => setSelectedMethod(method.name)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 transition-all text-center ${
                          isSelected 
                            ? 'bg-neutral-900 border-neutral-900 text-white shadow-md' 
                            : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-100'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full mb-1.5 ${method.color || 'bg-emerald-500'} ${isSelected ? 'ring-2 ring-white' : ''}`} />
                        <span className="text-xs font-bold leading-tight truncate max-w-full px-1">{method.name}</span>
                        <span className="text-[10px] opacity-75 font-medium">{method.type === 'CASH' ? 'Efectivo' : 'Digital'}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Info del método seleccionado si tiene cuenta o titular */}
                {(() => {
                  const currentM = availablePaymentMethods.find(m => m.name === selectedMethod)
                  if (!currentM || (!currentM.account_holder && !currentM.account_number && !currentM.account_info)) return null
                  return (
                    <div className="mt-2.5 p-3 rounded-xl bg-neutral-100 border border-neutral-200 text-xs flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
                      <div className="flex items-center gap-1.5 text-neutral-600 font-semibold">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Verificación de abono:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {currentM.account_holder && (
                          <span className="font-bold text-neutral-800">Titular: {currentM.account_holder}</span>
                        )}
                        {currentM.account_number && (
                          <span className="bg-white px-2 py-0.5 rounded font-mono font-bold text-neutral-900 border border-neutral-300">
                            {currentM.account_number}
                          </span>
                        )}
                        {!currentM.account_holder && !currentM.account_number && currentM.account_info && (
                          <span className="bg-white px-2 py-0.5 rounded font-medium text-neutral-900 border border-neutral-300">
                            {currentM.account_info}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
              {remaining > 0 && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-3.5 text-neutral-500 font-bold text-lg">S/</span>
                    <input 
                      type="text" 
                      inputMode="decimal"
                      value={paymentAmount}
                      onChange={(e) => {
                         const val = e.target.value.replace(/[^0-9.,]/g, '')
                         setPaymentAmount(val)
                      }}
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all outline-none font-bold text-lg text-neutral-800"
                    />
                  </div>
                  <button onClick={handleAddPayment} className="px-6 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold transition-colors">
                    Añadir Pago
                  </button>
                </div>
              )}
              {payments.length > 0 && (
                <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 space-y-2">
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Pagos Registrados</p>
                  {payments.map((p, index) => (
                    <div key={index} className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-neutral-100">
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-xs font-bold">{p.method}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-neutral-800">S/ {p.amount.toFixed(2)}</span>
                        <button onClick={() => handleRemovePayment(index)} className="text-neutral-400 hover:text-red-500">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  {change > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-dashed border-neutral-200">
                      <span className="font-bold text-amber-600">Vuelto a entregar:</span>
                      <span className="font-black text-amber-600 text-lg">S/ {change.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-neutral-100 bg-neutral-50/50">
              <button 
                onClick={handleConfirmSale}
                disabled={remaining > 0 || isProcessing}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:bg-neutral-300 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Procesando Venta...' : 'Confirmar Venta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lastSale && (
        <>
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page { margin: 0; }
              body { background: white; }
              body * { visibility: hidden; }
              #receipt-modal, #receipt-modal * { visibility: visible; }
              #receipt-modal { 
                position: fixed !important; 
                left: 0 !important; 
                top: 0 !important; 
                width: 100% !important; 
                height: 100% !important;
                background: white !important;
                z-index: 99999 !important; 
                overflow: visible !important;
              }
              .print\\:hidden { display: none !important; }
            }
          `}} />
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div id="receipt-modal" className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col print:shadow-none print:w-full print:max-w-full print:rounded-none">
              
              <div className="p-6 overflow-y-auto max-h-[70vh] print:max-h-full print:p-0">
                <div className="font-mono text-sm text-neutral-800 p-4 border border-neutral-200 bg-neutral-50 rounded-xl print:border-none print:bg-white print:p-2">
                  <div className="text-center mb-4">
                    <h2 className="text-xl font-black uppercase">{storeSettings?.store_name || 'MINIMARKET'}</h2>
                    <p className="text-xs">RUC: {storeSettings?.ruc || '20123456789'}</p>
                    <p className="text-xs">{storeSettings?.address || 'Av. Los Olivos 123, Lima'}</p>
                    {storeSettings?.phone && <p className="text-xs">Tel: {storeSettings.phone}</p>}
                    <p className="text-xs mt-2 border-t border-dashed border-neutral-400 pt-2 font-bold uppercase">{lastSale.documentType} ELECTRÓNICA</p>
                    <p className="text-xs">{lastSale.documentType === 'Factura' ? 'F001' : 'B001'}-{lastSale.id.split('-')[0].toUpperCase()}</p>
                    <p className="text-xs mt-2 text-left">{lastSale.date}</p>
                  </div>

                  <div className="border-t border-b border-dashed border-neutral-400 py-2 my-2 space-y-2">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left font-bold">
                          <th className="pb-1 w-8">CANT</th>
                          <th className="pb-1">DESCRIPCIÓN</th>
                          <th className="pb-1 text-right">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lastSale.cart.map((item: any, idx: number) => (
                          <tr key={idx} className="align-top">
                            <td className="py-1">{item.qty}</td>
                            <td className="py-1 pr-2">{item.name} <br/> <span className="text-[10px] text-neutral-500">S/ {item.price.toFixed(2)} c/u</span></td>
                            <td className="py-1 text-right font-medium">S/ {(item.qty * item.price).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-1 text-xs text-right mt-3">
                    <p>SUBTOTAL: S/ {lastSale.subtotal.toFixed(2)}</p>
                    <p>IGV (18%): S/ {lastSale.igv.toFixed(2)}</p>
                    <p className="font-bold text-sm mt-1 border-t border-dashed border-neutral-400 pt-1">TOTAL: S/ {lastSale.total.toFixed(2)}</p>
                  </div>

                  <div className="border-t border-dashed border-neutral-400 mt-3 pt-3 space-y-1 text-xs">
                    {lastSale.payments.map((p: any, idx: number) => (
                      <div key={idx} className="flex justify-between">
                        <span>PAGO {p.method.toUpperCase()}</span>
                        <span>S/ {p.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold mt-1">
                      <span>VUELTO</span>
                      <span>S/ {lastSale.change.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="text-center mt-6 text-xs text-neutral-500 whitespace-pre-line">
                    <p>{storeSettings?.ticket_footer_text || storeSettings?.ticket_footer || '¡Gracias por su compra!\nVuelva pronto'}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-neutral-100 flex gap-3 bg-neutral-50/50 print:hidden">
                <button onClick={() => setLastSale(null)} className="flex-1 py-3 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-xl font-bold transition-colors">
                  Nueva Venta
                </button>
                <button onClick={() => {
                  if (printerName) {
                    imprimirConQZ(lastSale)
                  } else {
                    window.print()
                  }
                }} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Imprimir Ticket
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showCustomProductModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-amber-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-lg shadow-sm">
                  ⚡
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 leading-tight">Producto Libre / Sin Código</h3>
                  <p className="text-xs text-neutral-500">Pan, verduras, frutas o varios</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowCustomProductModal(false)}
                className="w-8 h-8 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomProduct} className="p-6 space-y-4">
              {/* Botones de Acceso Frecuente */}
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Accesos Frecuentes</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '🥖 Pan', name: 'Pan' },
                    { label: '🛍️ Bolsa', name: 'Bolsa' },
                    { label: '🥚 Huevos', name: 'Huevos' },
                    { label: '🥦 Verduras', name: 'Verduras' }
                  ].map(preset => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setCustomName(preset.name)
                        setTimeout(() => priceInputRef.current?.focus(), 50)
                      }}
                      className="px-2 py-2 rounded-xl text-xs font-bold border border-neutral-200 bg-neutral-50 hover:bg-amber-100 hover:border-amber-300 text-neutral-700 transition-colors text-center cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-1">Descripción del Producto *</label>
                <input 
                  type="text" 
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Ej: Pan, Tomate, Plátanos..."
                  autoFocus
                  required
                  className="w-full px-4 py-3 bg-white border-2 border-neutral-200 rounded-xl focus:ring-4 focus:ring-amber-50 focus:border-amber-500 transition-all outline-none font-medium text-neutral-800"
                />
              </div>

              {/* Cantidad y Precio */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Cantidad (o peso)</label>
                  <input 
                    type="number"
                    step="any"
                    min="0.01"
                    value={customQty}
                    onChange={(e) => setCustomQty(e.target.value)}
                    placeholder="1"
                    className="w-full px-4 py-3 bg-white border-2 border-neutral-200 rounded-xl focus:ring-4 focus:ring-amber-50 focus:border-amber-500 transition-all outline-none font-bold text-neutral-800"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">Admite decimales (ej: 0.5)</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-700 mb-1">Precio Unitario *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3.5 text-neutral-400 font-bold text-sm">S/</span>
                    <input 
                      ref={priceInputRef}
                      type="text"
                      inputMode="decimal"
                      value={customPrice}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.,]/g, '')
                        setCustomPrice(val)
                      }}
                      placeholder="0.00"
                      required
                      className="w-full pl-9 pr-3 py-3 bg-white border-2 border-neutral-200 rounded-xl focus:ring-4 focus:ring-amber-50 focus:border-amber-500 transition-all outline-none font-bold text-neutral-800 text-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Total estimado */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800">Total a sumar al carrito:</span>
                <span className="text-xl font-black text-amber-600">
                  S/ {((parseFloat(customQty) || 0) * (parseFloat(customPrice.replace(',', '.')) || 0)).toFixed(2)}
                </span>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomProductModal(false)}
                  className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Agregar a la Venta</span>
                  <span className="text-xs opacity-80 font-normal">(Enter)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
