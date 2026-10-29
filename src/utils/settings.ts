import { createClient } from '@/utils/supabase/client'

export type StoreSettings = {
  id?: string
  store_name: string
  ruc: string
  address: string
  phone: string
  email: string
  currency_symbol: string
  ticket_footer_text: string
  ticket_footer?: string
  primary_color: string
  logo_url: string | null
}

export type PaymentMethod = {
  id: string
  name: string
  type: 'CASH' | 'DIGITAL'
  account_info?: string | null // e.g. "987 654 321 - María López"
  account_holder?: string | null
  account_number?: string | null
  color: string
  is_active: boolean
}

export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  'Administrador': ['dashboard', 'pos', 'products', 'inventory', 'purchases', 'customers', 'cash-register', 'settings'],
  'Cajero': ['pos', 'customers', 'cash-register'],
  'Almacenero': ['products', 'inventory', 'purchases'],
  'Personalizado': ['pos'],
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  store_name: 'AdonayMarket',
  ruc: '20601234567',
  address: 'Av. Los Próceres 123, San Juan de Lurigancho',
  phone: '999 888 777',
  email: 'contacto@adonaymarket.pe',
  currency_symbol: 'S/',
  ticket_footer_text: '¡Gracias por su compra!',
  primary_color: '#10b981',
  logo_url: null
}

export const DEFAULT_PAYMENT_METHODS: PaymentMethod = {
  id: 'pm-1',
  name: 'Efectivo',
  type: 'CASH',
  account_info: 'Cajón de dinero físico',
  color: '#10b981',
  is_active: true
}

export const INITIAL_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'pm-cash',
    name: 'Efectivo',
    type: 'CASH',
    account_info: 'Cajón de dinero físico',
    color: '#10b981',
    is_active: true
  },
  {
    id: 'pm-yape',
    name: 'Yape',
    type: 'DIGITAL',
    account_info: 'Billetera BCP (987 654 321)',
    color: '#8b5cf6',
    is_active: true
  },
  {
    id: 'pm-plin',
    name: 'Plin',
    type: 'DIGITAL',
    account_info: 'Billetera Interbank/BBVA',
    color: '#06b6d4',
    is_active: true
  },
  {
    id: 'pm-card',
    name: 'Tarjeta',
    type: 'DIGITAL',
    account_info: 'POS Tarjeta Niubiz / Izipay',
    color: '#3b82f6',
    is_active: true
  },
  {
    id: 'pm-transfer',
    name: 'Transferencia',
    type: 'DIGITAL',
    account_info: 'Cta Corriente BCP / BBVA',
    color: '#f59e0b',
    is_active: true
  }
]

export const ALL_MODULES = [
  { id: 'dashboard', label: 'Dashboard', desc: 'Resumen ejecutivo, ventas de hoy y gráficos', icon: '📊' },
  { id: 'pos', label: 'Punto de Venta', desc: 'Caja rápida, lectura de código de barras y cobros', icon: '🛒' },
  { id: 'products', label: 'Productos', desc: 'Catálogo de mercadería, precios y stock', icon: '📦' },
  { id: 'inventory', label: 'Inventario', desc: 'Kardex, reposición crítica y lotes por vencer', icon: '📋' },
  { id: 'purchases', label: 'Compras', desc: 'Órdenes de compra y proveedores', icon: '🚚' },
  { id: 'customers', label: 'Clientes', desc: 'Cartera de clientes y cuentas por cobrar (Fiados)', icon: '👥' },
  { id: 'cash-register', label: 'Arqueo de Cajas', desc: 'Apertura de turno, cuadre físico y cierres', icon: '💵' },
  { id: 'settings', label: 'Configuración', desc: 'Datos de la empresa, métodos de pago y roles', icon: '⚙️' }
]

// 1. OBTENER CONFIGURACIÓN GENERAL
export async function getStoreSettings(): Promise<StoreSettings> {
  const supabase = createClient()
  try {
    const { data, error } = await supabase.from('store_settings').select('*').limit(1).maybeSingle()
    if (!error && data) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('adonay_store_settings', JSON.stringify(data))
      }
      return data as StoreSettings
    }
  } catch (e) {
    console.warn('Error fetching store_settings, falling back to local cache', e)
  }

  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('adonay_store_settings')
    if (cached) {
      try { return JSON.parse(cached) } catch {}
    }
  }

  return DEFAULT_STORE_SETTINGS
}

// 2. GUARDAR CONFIGURACIÓN GENERAL
export async function saveStoreSettings(settings: StoreSettings): Promise<{ success: boolean; data?: StoreSettings; error?: string }> {
  const supabase = createClient()
  
  if (typeof window !== 'undefined') {
    localStorage.setItem('adonay_store_settings', JSON.stringify(settings))
  }

  try {
    if (settings.id) {
      const { data, error } = await supabase
        .from('store_settings')
        .update({
          store_name: settings.store_name,
          ruc: settings.ruc,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          currency_symbol: settings.currency_symbol || 'S/',
          ticket_footer_text: settings.ticket_footer_text,
          primary_color: settings.primary_color,
          logo_url: settings.logo_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', settings.id)
        .select()
        .single()
      
      if (!error && data) return { success: true, data }
    } else {
      const { data, error } = await supabase
        .from('store_settings')
        .insert([{
          store_name: settings.store_name,
          ruc: settings.ruc,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          currency_symbol: settings.currency_symbol || 'S/',
          ticket_footer_text: settings.ticket_footer_text,
          primary_color: settings.primary_color,
          logo_url: settings.logo_url
        }])
        .select()
        .single()

      if (!error && data) return { success: true, data }
    }
  } catch (e: any) {
    console.warn('Supabase store_settings insert/update error, saved locally', e)
  }

  return { success: true, data: settings }
}

// 3. OBTENER MÉTODOS DE PAGO
export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const supabase = createClient()
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .order('type', { ascending: false })
      .order('name')

    if (!error && data && data.length > 0) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('adonay_payment_methods', JSON.stringify(data))
      }
      return data as PaymentMethod[]
    }
  } catch (e) {
    console.warn('Error fetching payment_methods, using cache', e)
  }

  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('adonay_payment_methods')
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch {}
    }
  }

  return INITIAL_PAYMENT_METHODS
}

// 4. GUARDAR O ACTUALIZAR MÉTODO DE PAGO
export async function savePaymentMethod(method: PaymentMethod): Promise<{ success: boolean; data?: PaymentMethod; error?: string }> {
  const supabase = createClient()
  
  // Guardado en Supabase
  try {
    if (method.id && !method.id.startsWith('pm-custom-')) {
      const { data, error } = await supabase
        .from('payment_methods')
        .update({
          name: method.name,
          type: method.type,
          account_info: method.account_info || null,
          color: method.color,
          is_active: method.is_active
        })
        .eq('id', method.id)
        .select()
        .single()
      if (!error && data) return { success: true, data }
    } else {
      const { data, error } = await supabase
        .from('payment_methods')
        .insert([{
          name: method.name,
          type: method.type,
          account_info: method.account_info || null,
          color: method.color,
          is_active: method.is_active
        }])
        .select()
        .single()
      if (!error && data) return { success: true, data }
    }
  } catch (e) {
    console.warn('Supabase payment method save error, updating local list', e)
  }

  // Fallback Local Storage
  if (typeof window !== 'undefined') {
    const current = await getPaymentMethods()
    const index = current.findIndex(m => m.id === method.id || m.name.toLowerCase() === method.name.toLowerCase())
    let updated: PaymentMethod[] = []
    if (index >= 0) {
      updated = [...current]
      updated[index] = { ...method, id: current[index].id }
    } else {
      const newMethod = { ...method, id: method.id || `pm-custom-${Date.now()}` }
      updated = [...current, newMethod]
    }
    localStorage.setItem('adonay_payment_methods', JSON.stringify(updated))
    return { success: true, data: method }
  }

  return { success: true, data: method }
}

// 5. ELIMINAR MÉTODO DE PAGO
export async function deletePaymentMethod(id: string): Promise<boolean> {
  const supabase = createClient()
  try {
    await supabase.from('payment_methods').delete().eq('id', id)
  } catch (e) {
    console.warn('Supabase payment method delete error', e)
  }

  if (typeof window !== 'undefined') {
    const current = await getPaymentMethods()
    const updated = current.filter(m => m.id !== id)
    localStorage.setItem('adonay_payment_methods', JSON.stringify(updated))
  }
  return true
}
