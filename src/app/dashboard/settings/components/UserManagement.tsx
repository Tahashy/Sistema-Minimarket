'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ALL_MODULES } from '@/utils/settings'

type UserProfile = {
  id: string
  full_name: string
  email?: string | null
  role: string
  status?: string
  permissions?: string[]
}

const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  'Administrador': ['dashboard', 'pos', 'products', 'inventory', 'purchases', 'customers', 'cash-register', 'settings'],
  'Cajero': ['pos', 'customers', 'cash-register'],
  'Almacenero': ['products', 'inventory', 'purchases'],
  'Personalizado': ['pos']
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState('')
  
  // Modal de Crear / Editar
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Formulario
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formRole, setFormRole] = useState('Cajero')
  const [formStatus, setFormStatus] = useState('Activo')
  const [formPermissions, setFormPermissions] = useState<string[]>(ROLE_DEFAULT_PERMISSIONS['Cajero'])

  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
  }, [])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name')
      if (!error && data && data.length > 0) {
        const formatted = data.map(u => ({
          ...u,
          status: u.status || 'Activo',
          permissions: Array.isArray(u.permissions) ? u.permissions : ROLE_DEFAULT_PERMISSIONS[u.role] || ROLE_DEFAULT_PERMISSIONS['Cajero']
        }))
        setUsers(formatted)
        if (typeof window !== 'undefined') {
          localStorage.setItem('adonay_profiles_cache', JSON.stringify(formatted))
        }
        setLoading(false)
        return
      }
    } catch (e) {
      console.warn('Error loading profiles from Supabase, checking local cache', e)
    }

    // Fallback a caché local o usuario demo si no hay perfiles en BD
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('adonay_profiles_cache')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setUsers(parsed)
            setLoading(false)
            return
          }
        } catch {}
      }
    }

    const defaultUsers: UserProfile[] = [
      {
        id: 'usr-admin-1',
        full_name: 'Administrador Principal',
        email: 'admin@adonaymarket.pe',
        role: 'Administrador',
        status: 'Activo',
        permissions: ROLE_DEFAULT_PERMISSIONS['Administrador']
      },
      {
        id: 'usr-cajero-1',
        full_name: 'Usuario Cajero',
        email: 'cajero1@adonaymarket.pe',
        role: 'Cajero',
        status: 'Activo',
        permissions: ROLE_DEFAULT_PERMISSIONS['Cajero']
      }
    ]
    setUsers(defaultUsers)
    if (typeof window !== 'undefined') {
      localStorage.setItem('adonay_profiles_cache', JSON.stringify(defaultUsers))
    }
    setLoading(false)
  }

  const handleOpenCreate = () => {
    setEditingUser(null)
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setShowPassword(false)
    setFormRole('Cajero')
    setFormStatus('Activo')
    setFormPermissions(ROLE_DEFAULT_PERMISSIONS['Cajero'])
    setShowModal(true)
  }

  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser(user)
    setFormName(user.full_name || '')
    setFormEmail(user.email || '')
    setFormPassword('')
    setShowPassword(false)
    setFormRole(user.role || 'Cajero')
    setFormStatus(user.status || 'Activo')
    setFormPermissions(user.permissions || ROLE_DEFAULT_PERMISSIONS[user.role] || ROLE_DEFAULT_PERMISSIONS['Cajero'])
    setShowModal(true)
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$'
    let pass = ''
    for (let i = 0; i < 9; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormPassword(pass)
    setShowPassword(true)
    showToast('🔑 Contraseña generada automáticamente')
  }

  const handleRoleChange = (newRole: string) => {
    setFormRole(newRole)
    if (ROLE_DEFAULT_PERMISSIONS[newRole]) {
      setFormPermissions(ROLE_DEFAULT_PERMISSIONS[newRole])
    }
  }

  const toggleModulePermission = (moduleId: string) => {
    if (formPermissions.includes(moduleId)) {
      setFormPermissions(formPermissions.filter(id => id !== moduleId))
    } else {
      setFormPermissions([...formPermissions, moduleId])
    }
    if (formRole !== 'Personalizado') {
      setFormRole('Personalizado')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = formName.trim()
    const email = formEmail.trim()
    const password = formPassword.trim()

    if (!name) return showToast('⚠️ Ingresa el nombre del usuario')
    if (!email) return showToast('⚠️ Ingresa el correo electrónico para el acceso')

    if (!editingUser) {
      if (!password) {
        return showToast('⚠️ Ingresa una contraseña para el nuevo usuario')
      }
      if (password.length < 6) {
        return showToast('⚠️ La contraseña debe tener al menos 6 caracteres')
      }
    } else if (password && password.length < 6) {
      return showToast('⚠️ La nueva contraseña debe tener al menos 6 caracteres')
    }

    setIsSaving(true)

    let userId = editingUser ? editingUser.id : `usr-${Date.now()}`

    // Si es un usuario nuevo, registrar en Supabase Auth mediante cliente aislado sin tocar la sesión del admin
    if (!editingUser && email && password) {
      try {
        const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
        const tempAuthClient = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
        )

        const { data: authData, error: authError } = await tempAuthClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              role: formRole
            }
          }
        })

        if (authError) {
          console.warn('Supabase Auth signUp note:', authError)
          if (authError.message.includes('already registered')) {
            setIsSaving(false)
            return showToast('❌ Este correo electrónico ya está registrado en el sistema')
          }
        } else if (authData?.user?.id) {
          userId = authData.user.id
        }
      } catch (authErr) {
        console.warn('Auth creation error:', authErr)
      }
    }

    const payload: UserProfile = {
      id: userId,
      full_name: name,
      email: email || null,
      role: formRole,
      status: formStatus,
      permissions: formPermissions
    }

    // Guardar en Supabase profiles
    try {
      if (editingUser) {
        await supabase.from('profiles').update({
          full_name: payload.full_name,
          email: payload.email,
          role: payload.role,
          status: payload.status,
          permissions: payload.permissions
        }).eq('id', editingUser.id)
      } else {
        await supabase.from('profiles').upsert([{
          id: payload.id,
          full_name: payload.full_name,
          email: payload.email,
          role: payload.role,
          status: payload.status,
          permissions: payload.permissions
        }])
      }
    } catch (e) {
      console.warn('Supabase profile save error, saving to local cache', e)
    }

    // Actualizar estado local
    setUsers(prev => {
      let updated: UserProfile[]
      if (editingUser) {
        updated = prev.map(u => u.id === editingUser.id ? payload : u)
      } else {
        updated = [...prev, payload]
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('adonay_profiles_cache', JSON.stringify(updated))
      }
      return updated
    })

    setIsSaving(false)
    setShowModal(false)
    showToast(editingUser ? '✅ Usuario y permisos actualizados' : '✅ Usuario creado con su contraseña y permisos')
  }

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('profiles').delete().eq('id', id)
    } catch (e) {
      console.warn('Supabase delete profile error', e)
    }

    setUsers(prev => {
      const updated = prev.filter(u => u.id !== id)
      if (typeof window !== 'undefined') {
        localStorage.setItem('adonay_profiles_cache', JSON.stringify(updated))
      }
      return updated
    })

    setUserToDelete(null)
    showToast('🗑️ Usuario eliminado')
  }

  return (
    <div className="max-w-4xl animate-fade-in space-y-6">
      
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-neutral-900 text-white px-5 py-3 rounded-2xl shadow-2xl z-50 font-bold text-sm border border-neutral-700 animate-fade-in-up">
          {toastMessage}
        </div>
      )}

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 font-serif">Usuarios y Permisos (Low-Code)</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Gestiona tu personal, asigna roles y configura visualmente qué módulos puede ver cada empleado.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl font-bold shadow-md shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Usuario
        </button>
      </div>

      {/* Tabla de Usuarios */}
      <div className="bg-white rounded-3xl border border-neutral-200/90 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 pl-6">Usuario</th>
                <th className="py-3.5 px-4">Rol Asignado</th>
                <th className="py-3.5 px-4">Acceso a Módulos (Low-Code)</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 pr-6 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-neutral-400 font-medium">Cargando usuarios...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-neutral-400 font-medium">No hay usuarios registrados.</td>
                </tr>
              ) : (
                users.map(u => {
                  const allowedCount = (u.permissions || []).length
                  const isTotal = allowedCount === ALL_MODULES.length

                  return (
                    <tr key={u.id} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="py-3.5 px-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            {(u.full_name || 'US').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-neutral-900 block">{u.full_name || 'Sin Nombre'}</span>
                            <span className="text-[11px] text-neutral-400 font-mono">{u.email || 'Sin correo asociado'}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          u.role === 'Administrador' 
                            ? 'bg-purple-50 text-purple-700 border-purple-200' 
                            : u.role === 'Cajero'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : u.role === 'Almacenero'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                          {isTotal ? (
                            <span className="px-2.5 py-0.5 bg-neutral-100 text-neutral-800 rounded-lg text-xs font-bold">
                              ⚡ Acceso Total ({allowedCount}/{ALL_MODULES.length} módulos)
                            </span>
                          ) : (
                            <>
                              <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded text-xs font-bold">
                                {allowedCount} de {ALL_MODULES.length} módulos:
                              </span>
                              {(u.permissions || []).slice(0, 3).map(modId => {
                                const m = ALL_MODULES.find(x => x.id === modId)
                                return m ? (
                                  <span key={modId} className="px-1.5 py-0.5 bg-neutral-50 border border-neutral-200 text-neutral-600 rounded text-[11px]">
                                    {m.icon} {m.label}
                                  </span>
                                ) : null
                              })}
                              {allowedCount > 3 && (
                                <span className="text-[11px] text-neutral-400 font-bold">+{allowedCount - 3} más</span>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                          u.status === 'Activo' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'Activo' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                          {u.status || 'Activo'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 pr-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                          >
                            Editar Permisos
                          </button>
                          {u.role !== 'Administrador' && (
                            <button
                              type="button"
                              onClick={() => setUserToDelete(u)}
                              className="p-1 hover:bg-red-50 text-neutral-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar Usuario"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================= MODAL CREAR / EDITAR CON MATRIZ LOW-CODE ======================= */}
      {showModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col border border-neutral-200">
            
            {/* Cabecera */}
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div>
                <h3 className="text-xl font-bold text-neutral-900 font-serif">
                  {editingUser ? 'Editar Usuario y Accesos' : 'Crear Nuevo Usuario'}
                </h3>
                <p className="text-xs text-neutral-500">Configura sus datos y la matriz de permisos de navegación.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-neutral-900 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Formulario con Matriz Low-Code */}
            <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto flex-1">
              
              {/* Datos Básicos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    required
                    placeholder="Ej: Ana María Torres"
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-xs sm:text-sm font-bold text-neutral-900 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Correo Electrónico (Acceso) *</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    required
                    placeholder="cajero@adonaymarket.pe"
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-xs sm:text-sm font-medium text-neutral-800 transition-all"
                  />
                </div>
              </div>

              {/* Campo de Contraseña */}
              <div className="bg-neutral-50/70 p-4 rounded-2xl border border-neutral-200/90 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wider">
                    {editingUser ? 'Nueva Contraseña (Opcional)' : 'Contraseña de Acceso *'}
                  </label>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    Generar Contraseña Segura
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                    placeholder={editingUser ? 'Dejar en blanco para mantener la actual' : 'Mínimo 6 caracteres (ej: Clave2026!)'}
                    required={!editingUser}
                    minLength={6}
                    className="w-full pl-4 pr-11 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-xs sm:text-sm font-mono text-neutral-900 transition-all font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer transition-colors"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-neutral-500">
                  {editingUser 
                    ? 'ℹ️ Solo llena este campo si deseas cambiar la contraseña de acceso de este usuario.'
                    : '🔑 Esta será la contraseña con la que el usuario ingresará en la pantalla de inicio de sesión (/login).'}
                </p>
              </div>

              {/* Selector de Rol y Estado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Rol Base</label>
                  <select
                    value={formRole}
                    onChange={e => handleRoleChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-xs sm:text-sm font-bold text-neutral-800 transition-all cursor-pointer"
                  >
                    <option value="Administrador">👑 Administrador (Acceso Completo)</option>
                    <option value="Cajero">🛒 Cajero (Ventas, Clientes y Cajas)</option>
                    <option value="Almacenero">📦 Almacenero (Productos, Inventario y Compras)</option>
                    <option value="Personalizado">⚙️ Personalizado (Elegir Módulos Manualmente)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Estado de la Cuenta</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-xs sm:text-sm font-bold text-neutral-800 transition-all cursor-pointer"
                  >
                    <option value="Activo">🟢 Activo (Puede ingresar al sistema)</option>
                    <option value="Inactivo">⚪ Inactivo (Acceso suspendido)</option>
                  </select>
                </div>
              </div>

              {/* Matriz Visual Low-Code de Permisos por Módulo */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                      Matriz de Permisos por Módulo (Low-Code)
                    </h4>
                    <p className="text-[11px] text-neutral-400">
                      Activa o desactiva qué pantallas verá este usuario en su menú superior.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    {formPermissions.length} de {ALL_MODULES.length} activos
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ALL_MODULES.map(module => {
                    const isChecked = formPermissions.includes(module.id)

                    return (
                      <button
                        key={module.id}
                        type="button"
                        onClick={() => toggleModulePermission(module.id)}
                        className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isChecked 
                            ? 'bg-emerald-50/60 border-emerald-300 shadow-2xs' 
                            : 'bg-neutral-50 border-neutral-200/80 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl shrink-0">{module.icon}</span>
                          <div>
                            <span className="font-bold text-xs text-neutral-900 block">{module.label}</span>
                            <span className="text-[10px] text-neutral-500 block leading-tight">{module.desc}</span>
                          </div>
                        </div>

                        {/* Switch Visual */}
                        <div className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${isChecked ? 'bg-emerald-600' : 'bg-neutral-300'}`}>
                          <span className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-transform ${isChecked ? 'left-4.5' : 'left-0.75'}`} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Botones */}
              <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 flex gap-3 -mx-6 -mb-6 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-200 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : (editingUser ? 'Guardar Cambios' : 'Registrar Usuario')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL CONFIRMAR ELIMINACIÓN ======================= */}
      {userToDelete && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center border border-neutral-200">
            <div className="w-14 h-14 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-neutral-900 mb-1">¿Eliminar Usuario?</h3>
            <p className="text-neutral-500 text-xs mb-6">
              Estás a punto de eliminar el acceso de <strong className="text-neutral-800">{userToDelete.full_name}</strong>.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(userToDelete.id)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-md shadow-red-200 cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
