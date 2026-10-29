import { createClient } from '@/utils/supabase/server'
import { logout } from './actions'
import TopNav from './components/TopNav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: { full_name: string; role: string; permissions?: string[] } = { 
    full_name: 'Usuario', 
    role: 'Administrador',
    permissions: ['dashboard', 'pos', 'products', 'inventory', 'purchases', 'customers', 'cash-register', 'settings']
  }
  if (user) {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, role, permissions')
      .eq('id', user.id)
      .single()
    if (error) {
      console.error('Error fetching profile in layout for user:', user.id, JSON.stringify(error, null, 2))
    }
    if (data) {
      profile = {
        full_name: data.full_name || 'Usuario',
        role: data.role || 'Administrador',
        permissions: Array.isArray(data.permissions) ? data.permissions : undefined
      }
    }
  }

  // Obtenemos las iniciales para el avatar de forma segura
  const safeName = profile.full_name || 'Usuario'
  const initials = safeName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-neutral-900 font-sans flex flex-col">
      {/* Top Navigation */}
      <header className="bg-neutral-950 border-b border-neutral-800 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          
          {/* Logo y Menú */}
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-3">
              {/* AdonayMarket SVG Icon */}
              <div className="bg-neutral-900 p-2 rounded-xl">
                <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M30 45 L85 45 L78 70 L35 70 Z" fill="#4ade80" />
                  <path d="M15 45 L30 45" stroke="#4ade80" strokeWidth="8" strokeLinecap="round" />
                  <circle cx="45" cy="80" r="8" fill="#4ade80" />
                  <circle cx="68" cy="80" r="8" fill="#4ade80" />
                </svg>
              </div>
              <h1 className="text-xl font-bold tracking-tight">
                <span className="text-white">Adonay</span>
                <span className="text-emerald-500">Market</span>
              </h1>
            </div>

            <TopNav userRole={profile.role} initialPermissions={profile.permissions} />
          </div>

          {/* Right Side - Profile */}
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-white">{safeName}</p>
                <p className="text-xs text-neutral-400">{profile.role}</p>
              </div>
              
              <div className="relative group cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  {initials}
                </div>
                
                {/* Dropdown Menu (Pop up) */}
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-neutral-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right">
                  <div className="p-2">
                    <form action={logout}>
                      <button type="submit" className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Cerrar Sesión
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-6">
        {children}
      </main>
    </div>
  )
}
