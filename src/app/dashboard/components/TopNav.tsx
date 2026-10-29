'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ROLE_DEFAULT_PERMISSIONS } from '@/utils/settings'

interface TopNavProps {
  userRole?: string
  initialPermissions?: string[]
}

export default function TopNav({ userRole = 'Administrador', initialPermissions }: TopNavProps) {
  const pathname = usePathname()
  const [alertCount, setAlertCount] = useState(0)
  const [permissions, setPermissions] = useState<string[]>(() => {
    if (initialPermissions && initialPermissions.length > 0) return initialPermissions
    return ROLE_DEFAULT_PERMISSIONS[userRole] || ROLE_DEFAULT_PERMISSIONS['Administrador']
  })

  useEffect(() => {
    if (initialPermissions && initialPermissions.length > 0) {
      setPermissions(initialPermissions)
    } else {
      setPermissions(ROLE_DEFAULT_PERMISSIONS[userRole] || ROLE_DEFAULT_PERMISSIONS['Administrador'])
    }
  }, [userRole, initialPermissions])

  // Listen for low-code permission matrix changes
  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem('user_permissions')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPermissions(parsed)
          }
        } catch (e) {
          console.error(e)
        }
      }
    }
    window.addEventListener('storage', handleStorage)
    window.addEventListener('pos_permissions_changed', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('pos_permissions_changed', handleStorage)
    }
  }, [])

  useEffect(() => {
    const fetchAlerts = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('products').select('stock, min_stock')
      if (data) {
        const critical = data.filter(p => p.stock <= (p.min_stock || 20))
        setAlertCount(critical.length)
      }
    }
    fetchAlerts()
    
    // Poll every 30 seconds
    const interval = setInterval(fetchAlerts, 30000)
    return () => clearInterval(interval)
  }, [])

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname?.startsWith(path)
  }

  const activeClass = "text-emerald-500 font-semibold border-emerald-500"
  const inactiveClass = "text-neutral-400 font-medium border-transparent hover:text-white transition-colors"

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    {
      id: 'pos',
      label: 'Punto de Venta',
      href: '/dashboard/pos',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      id: 'products',
      label: 'Productos',
      href: '/dashboard/products',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    },
    {
      id: 'inventory',
      label: 'Inventario',
      href: '/dashboard/inventory',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    },
    {
      id: 'purchases',
      label: 'Compras',
      href: '/dashboard/purchases',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      )
    },
    {
      id: 'customers',
      label: 'Clientes',
      href: '/dashboard/customers',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
    {
      id: 'cash-register',
      label: 'Cajas',
      href: '/dashboard/cash-register',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      id: 'settings',
      label: 'Configuración',
      href: '/dashboard/settings',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ]

  // Filter items based on user role / low-code permission matrix
  const isSuperAdmin = userRole === 'Administrador' || userRole === 'Admin'
  const visibleNavItems = navItems.filter(item => {
    if (isSuperAdmin) return true
    return permissions.includes(item.id)
  })

  return (
    <nav className="hidden xl:flex items-center gap-5">
      {visibleNavItems.map(item => (
        <Link 
          key={item.id} 
          href={item.href} 
          className={`flex items-center gap-1.5 border-b-2 pb-1 ${isActive(item.href) ? activeClass : inactiveClass}`}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}

      {visibleNavItems.some(i => i.id === 'inventory') && (
        <Link href="/dashboard/inventory?tab=alerts" className="ml-4 relative p-2 text-neutral-400 hover:text-white transition-colors rounded-full hover:bg-neutral-800" title="Alertas de Stock">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {alertCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping-slow"></span>
          )}
          {alertCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-neutral-900"></span>
          )}
        </Link>
      )}
    </nav>
  )
}
