-- Script para Tablas del Punto de Venta (POS)

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    barcode TEXT UNIQUE,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 20,
    unit TEXT DEFAULT 'UN',
    image_url TEXT,
    expiration_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.1 Cash Registers (Cajas y Turnos)
CREATE TABLE IF NOT EXISTS public.cash_registers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    opening_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    closing_balance DECIMAL(10, 2),
    status TEXT NOT NULL DEFAULT 'Abierta' CHECK (status IN ('Abierta', 'Cerrada')),
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- 3. Customers Table (Clientes y Cuentas por Cobrar)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_type TEXT NOT NULL CHECK (document_type IN ('DNI', 'RUC', 'Pasaporte')),
    document_number TEXT UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    debt_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Customer Payments (Pagos de Deudas)
CREATE TABLE IF NOT EXISTS public.customer_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method TEXT NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Sales Table
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
    cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    tax DECIMAL(10, 2) NOT NULL DEFAULT 0.00, -- IGV
    total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    document_type TEXT NOT NULL CHECK (document_type IN ('Boleta', 'Factura')),
    status TEXT NOT NULL DEFAULT 'Completada',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Sale Items Table
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    description TEXT, -- Nombre o detalle del producto (especialmente útil para productos libres)
    quantity DECIMAL(10, 3) NOT NULL DEFAULT 1, -- Permite decimales para productos por peso (ej. 0.5 kg)
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6.5 Sale Payments (Desglose de métodos de pago por venta)
CREATE TABLE IF NOT EXISTS public.sale_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Inventory Movements (Kardex)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUST')),
    quantity INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Product Batches (Lotes y Vencimientos)
CREATE TABLE IF NOT EXISTS public.product_batches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    batch_number TEXT,
    expiration_date DATE,
    initial_quantity INTEGER NOT NULL,
    current_quantity INTEGER NOT NULL,
    status TEXT DEFAULT 'Activo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Suppliers (Proveedores)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_name TEXT NOT NULL,
    alias TEXT,
    ruc TEXT UNIQUE NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    category TEXT,
    status TEXT DEFAULT 'Activo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Purchase Orders (Órdenes de Compra)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'Enviada', 'Recibida', 'Cancelada')),
    total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    order_date DATE NOT NULL,
    expected_date DATE,
    received_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Purchase Order Items (Detalle de la orden de compra)
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (Seguridad)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Políticas de Acceso (Usuarios logueados pueden hacer todo por ahora)
CREATE POLICY "Permitir todo a autenticados en inventory" ON public.inventory_movements FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados en batches" ON public.product_batches FOR ALL USING (true);
CREATE POLICY "Permitir todo a autenticados en suppliers" ON public.suppliers FOR ALL USING (true);
CREATE POLICY "Permitir todo a autenticados en orders" ON public.purchase_orders FOR ALL USING (true);
CREATE POLICY "Permitir todo a autenticados en order_items" ON public.purchase_order_items FOR ALL USING (true);
CREATE POLICY "Permitir todo a autenticados en customers" ON public.customers FOR ALL USING (true);
CREATE POLICY "Permitir todo a autenticados en customer_payments" ON public.customer_payments FOR ALL USING (true);
CREATE POLICY "Permitir todo a autenticados en cash_registers" ON public.cash_registers FOR ALL USING (true);
CREATE POLICY "Permitir todo a autenticados en productos" ON public.products FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados en ventas" ON public.sales FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados en detalle_ventas" ON public.sale_items FOR ALL TO authenticated USING (true);

-- 12. Store Settings (Configuración General de la Tienda)
CREATE TABLE IF NOT EXISTS public.store_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_name TEXT NOT NULL DEFAULT 'AdonayMarket',
    ruc TEXT DEFAULT '20601234567',
    address TEXT DEFAULT 'Av. Principal 123',
    phone TEXT DEFAULT '999888777',
    email TEXT DEFAULT 'contacto@adonaymarket.pe',
    currency_symbol TEXT NOT NULL DEFAULT 'S/',
    ticket_footer_text TEXT DEFAULT '¡Gracias por su compra!',
    primary_color TEXT DEFAULT '#10b981',
    logo_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. Payment Methods (Métodos de Pago Dinámicos)
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL DEFAULT 'DIGITAL' CHECK (type IN ('CASH', 'DIGITAL')),
    account_info TEXT, -- e.g. "987 654 321 - María López"
    color TEXT DEFAULT '#10b981',
    icon TEXT DEFAULT 'wallet',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Permisos y estado para Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '["dashboard", "pos", "products", "inventory", "purchases", "customers", "cash-register", "settings"]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Activo';

-- RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo a autenticados en store_settings" ON public.store_settings FOR ALL USING (true);
CREATE POLICY "Permitir todo a autenticados en payment_methods" ON public.payment_methods FOR ALL USING (true);

-- Insertar métodos por defecto si no existen
INSERT INTO public.payment_methods (name, type, account_info, color, is_active)
VALUES 
  ('Efectivo', 'CASH', 'Cajón de dinero físico', '#10b981', true),
  ('Yape', 'DIGITAL', 'Billetera digital BCP', '#8b5cf6', true),
  ('Plin', 'DIGITAL', 'Billetera digital Interbank/BBVA', '#06b6d4', true),
  ('Tarjeta', 'DIGITAL', 'POS Tarjeta Izipay/Niubiz', '#3b82f6', true),
  ('Transferencia', 'DIGITAL', 'Transferencias BCP/BBVA', '#f59e0b', true)
ON CONFLICT (name) DO NOTHING;

