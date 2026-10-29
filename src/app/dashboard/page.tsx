import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Fecha de hoy formateada en español
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const formattedDate = now.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)

  // 2. Consulta de Turno de Caja Activa
  const { data: activeRegister } = await supabase
    .from('cash_registers')
    .select('id, opened_at, opening_balance, status')
    .eq('status', 'Abierta')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 3. Ventas de Hoy
  const { data: todaySalesData } = await supabase
    .from('sales')
    .select('id, total, created_at, status')
    .gte('created_at', todayISO)
    .eq('status', 'Completada')

  const todaySales = todaySalesData || []
  const todayRevenue = todaySales.reduce((acc, s) => acc + Number(s.total || 0), 0)
  const todayTransactions = todaySales.length
  const todayAvgTicket = todayTransactions > 0 ? todayRevenue / todayTransactions : 0

  // 4. Conteo Real de Stock Bajo
  const { data: productsData } = await supabase
    .from('products')
    .select('id, name, stock, min_stock')

  const lowStockCount = (productsData || []).filter(p => p.stock <= (p.min_stock ?? 10)).length

  // 5. Ventas Reales de los Últimos 7 Días
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const { data: weeklySalesData } = await supabase
    .from('sales')
    .select('total, created_at')
    .gte('created_at', sevenDaysAgo.toISOString())
    .eq('status', 'Completada')

  const daysOfWeek: { key: string; label: string; dateStr: string; total: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const key = `${yyyy}-${mm}-${dd}`
    const rawDay = d.toLocaleDateString('es-PE', { weekday: 'short' })
    const label = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).replace('.', '')
    const dateStr = `${d.getDate()} ${d.toLocaleDateString('es-PE', { month: 'short' })}`
    daysOfWeek.push({ key, label, dateStr, total: 0 })
  }

  weeklySalesData?.forEach(s => {
    const sDate = s.created_at ? s.created_at.split('T')[0] : ''
    const dayItem = daysOfWeek.find(d => d.key === sDate)
    if (dayItem) {
      dayItem.total += Number(s.total || 0)
    }
  })

  const maxWeeklyTotal = Math.max(...daysOfWeek.map(d => d.total), 1)

  // 6. Productos Más Vendidos Reales (Top 5)
  const { data: saleItemsData } = await supabase
    .from('sale_items')
    .select(`
      quantity,
      subtotal,
      description,
      products ( id, name )
    `)
    .order('created_at', { ascending: false })
    .limit(250)

  const productAgg: Record<string, { name: string; qty: number; revenue: number }> = {}
  saleItemsData?.forEach(item => {
    const pName = (item.products as any)?.name || item.description || 'Producto Libre'
    if (!productAgg[pName]) {
      productAgg[pName] = { name: pName, qty: 0, revenue: 0 }
    }
    productAgg[pName].qty += Number(item.quantity || 0)
    productAgg[pName].revenue += Number(item.subtotal || 0)
  })

  const topProducts = Object.values(productAgg)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  // 7. Últimas Ventas Reales
  const { data: latestSalesData } = await supabase
    .from('sales')
    .select(`
      id,
      document_type,
      total,
      created_at,
      status,
      customers ( full_name ),
      sale_items ( id )
    `)
    .order('created_at', { ascending: false })
    .limit(6)

  const latestSales = latestSalesData || []

  return (
    <div className="space-y-6">
      
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-neutral-900 tracking-tight">Dashboard</h2>
          <p className="text-neutral-500 text-sm mt-0.5">Resumen de operaciones en tiempo real</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-left sm:text-right">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{capitalizedDate}</p>
          </div>
          {activeRegister ? (
            <Link 
              href="/dashboard/cash-register"
              className="px-3.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-2 transition-colors shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Caja Abierta
            </Link>
          ) : (
            <Link 
              href="/dashboard/cash-register"
              className="px-3.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold rounded-full flex items-center gap-2 transition-colors shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Caja Cerrada (Abrir)
            </Link>
          )}
        </div>
      </div>

      {/* Tarjetas KPI de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Ventas Hoy */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200/80 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Ventas Hoy</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl lg:text-3xl font-black text-neutral-900 leading-none">
              S/ {todayRevenue.toFixed(2)}
            </h3>
            <p className="text-xs text-neutral-400 font-medium mt-1">
              {todayTransactions} {todayTransactions === 1 ? 'venta realizada' : 'ventas realizadas'}
            </p>
          </div>
        </div>

        {/* Card 2: Transacciones Hoy */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200/80 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Transacciones</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl lg:text-3xl font-black text-neutral-900 leading-none">
              {todayTransactions}
            </h3>
            <p className="text-xs text-neutral-400 font-medium mt-1">
              Boletas y facturas emitidas
            </p>
          </div>
        </div>

        {/* Card 3: Ticket Promedio */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200/80 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Ticket Promedio</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl lg:text-3xl font-black text-neutral-900 leading-none">
              S/ {todayAvgTicket.toFixed(2)}
            </h3>
            <p className="text-xs text-neutral-400 font-medium mt-1">
              Gasto promedio por compra
            </p>
          </div>
        </div>

        {/* Card 4: Alertas de Stock Bajo */}
        <Link 
          href="/dashboard/inventory"
          className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200/80 flex flex-col justify-between hover:border-red-300 hover:shadow-md transition-all group cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Stock Bajo</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${lowStockCount > 0 ? 'bg-red-50 text-red-600' : 'bg-neutral-100 text-neutral-400'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-2xl lg:text-3xl font-black leading-none ${lowStockCount > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
              {lowStockCount}
            </h3>
            <p className="text-xs text-neutral-400 group-hover:text-red-500 font-medium mt-1 flex items-center gap-1 transition-colors">
              <span>{lowStockCount > 0 ? 'Productos por agotar' : 'Inventario en orden'}</span>
              <span>→</span>
            </p>
          </div>
        </Link>

      </div>

      {/* Sección Central (Gráfico Semanal + Top Vendidos) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico de Ventas de los Últimos 7 Días */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-neutral-200/80 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-neutral-900">Ventas de los Últimos 7 Días</h3>
              <p className="text-xs text-neutral-400">Total recaudado por día</p>
            </div>
            <span className="px-3 py-1 bg-neutral-100 text-neutral-600 text-xs font-bold rounded-full">
              Última semana
            </span>
          </div>
          
          {/* Barras dinámicas con datos 100% reales */}
          <div className="flex items-end justify-between h-52 mt-2 gap-2 sm:gap-4 px-2">
            {daysOfWeek.map((bar, i) => {
              const heightPercent = bar.total > 0 
                ? Math.max(16, Math.round((bar.total / maxWeeklyTotal) * 100))
                : 6
              const isToday = i === daysOfWeek.length - 1

              return (
                <div key={bar.key} className="flex flex-col items-center w-full group relative">
                  {/* Tooltip / Valor sobre la barra */}
                  <span className={`text-[11px] font-bold mb-2 transition-all ${bar.total > 0 ? 'text-neutral-800' : 'text-neutral-300'}`}>
                    S/ {bar.total > 0 ? Math.round(bar.total) : '0'}
                  </span>
                  
                  {/* Barra */}
                  <div className="w-full bg-neutral-100 rounded-t-xl h-36 flex items-end overflow-hidden p-0.5">
                    <div 
                      className={`w-full rounded-t-lg transition-all duration-500 ${isToday ? 'bg-emerald-500 group-hover:bg-emerald-600 shadow-sm' : bar.total > 0 ? 'bg-emerald-400 group-hover:bg-emerald-500' : 'bg-transparent'}`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>

                  {/* Etiqueta del día */}
                  <span className={`text-xs font-bold mt-2.5 ${isToday ? 'text-emerald-700 font-black' : 'text-neutral-500'}`}>
                    {bar.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top 5 Productos Más Vendidos */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-200/80 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Más Vendidos</h3>
            <p className="text-xs text-neutral-400 mb-5">Productos con mayor rotación</p>
            
            {topProducts.length > 0 ? (
              <div className="space-y-4">
                {topProducts.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-neutral-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-amber-100 text-amber-800' : idx === 1 ? 'bg-neutral-200 text-neutral-700' : idx === 2 ? 'bg-amber-50 text-amber-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-neutral-800 truncate" title={item.name}>
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-neutral-400 font-medium">
                          {item.qty} {item.qty === 1 ? 'unidad' : 'unidades'} vendidas
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-neutral-900 shrink-0">
                      S/ {item.revenue.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4">
                <p className="text-sm font-bold text-neutral-400">Sin ventas recientes</p>
                <p className="text-xs text-neutral-300 mt-1">Los productos más vendidos se reflejarán aquí al cobrar.</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100">
            <Link 
              href="/dashboard/pos"
              className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Ir a Vender al POS</span>
              <span>→</span>
            </Link>
          </div>
        </div>

      </div>

      {/* Tabla de Últimas Ventas Reales */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-200/80">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Últimas Ventas Registradas</h3>
            <p className="text-xs text-neutral-400">Historial de tickets recientes en la base de datos</p>
          </div>
          <Link href="/dashboard/pos" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline">
            Ir a Punto de Venta →
          </Link>
        </div>
        
        {latestSales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-100 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  <th className="pb-3 w-32">Documento</th>
                  <th className="pb-3">Fecha y Hora</th>
                  <th className="pb-3">Cliente</th>
                  <th className="pb-3">Total</th>
                  <th className="pb-3 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-sm font-medium">
                {latestSales.map((sale: any) => {
                  const saleDate = new Date(sale.created_at)
                  const timeFormatted = saleDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
                  const dateFormatted = saleDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })
                  const docPrefix = sale.document_type === 'Factura' ? 'F001' : 'B001'
                  const docNumber = `${docPrefix}-${sale.id.split('-')[0].toUpperCase()}`
                  const customer = sale.customers?.full_name || 'Público General'

                  return (
                    <tr key={sale.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3.5">
                        <span className="px-2.5 py-1 bg-neutral-100 text-neutral-800 text-xs font-mono font-bold rounded-lg border border-neutral-200">
                          {docNumber}
                        </span>
                      </td>
                      <td className="py-3.5 text-xs text-neutral-600">
                        {dateFormatted} - {timeFormatted}
                      </td>
                      <td className="py-3.5 text-xs text-neutral-800 font-bold">
                        {customer}
                      </td>
                      <td className="py-3.5 text-sm font-black text-neutral-900">
                        S/ {Number(sale.total).toFixed(2)}
                      </td>
                      <td className="py-3.5 text-right">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {sale.status || 'Completada'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-neutral-400 text-sm bg-neutral-50 rounded-2xl border border-neutral-100 border-dashed">
            No se han registrado ventas todavía en el sistema.
          </div>
        )}
      </div>

    </div>
  )
}
