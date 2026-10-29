import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>
}) {
  const resolvedSearchParams = await searchParams;
  
  return (
    <div 
      className="flex items-center justify-center min-h-screen font-sans relative"
    >
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=2000&auto=format&fit=crop')" }}
      ></div>
      <div className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm"></div>
      
      {/* Login Card */}
      <div className="relative z-10 w-full max-w-[420px] p-8 bg-[#111318] border border-[#232730] rounded-2xl shadow-2xl flex flex-col">
        
        {/* Header / Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            {/* Custom Shopping Cart SVG Logo */}
            <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="52" y="30" width="14" height="20" rx="2" fill="#eab308" />
              <rect x="68" y="26" width="10" height="24" rx="2" fill="#9ca3af" />
              <path d="M42 35 L48 35 L52 25 L65 25" stroke="#f97316" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M30 45 L85 45 L78 70 L35 70 Z" fill="#4ade80" />
              <path d="M15 45 L30 45" stroke="#4ade80" strokeWidth="6" strokeLinecap="round" />
              <path d="M22 35 L32 35" stroke="#4ade80" strokeWidth="4" strokeLinecap="round" />
              <path d="M18 55 L28 55" stroke="#4ade80" strokeWidth="4" strokeLinecap="round" />
              <circle cx="45" cy="80" r="6" fill="#4ade80" />
              <circle cx="68" cy="80" r="6" fill="#4ade80" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-white">MINI</span>
            <span className="text-[#4ade80]">MARKET</span>
          </h1>
          <p className="text-[#8c94a3] text-sm mt-1">Gestión inteligente de tu negocio</p>
        </div>

        {/* Welcome Text */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-white">Bienvenido</h2>
          <p className="text-[#8c94a3] text-sm mt-1">Inicia sesión para continuar</p>
        </div>

        <form action={login} className="space-y-4">
          {/* Email Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-[#8c94a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Usuario o correo electrónico"
              required
              className="w-full pl-11 pr-4 py-3.5 bg-[#1c1f26] border border-[#2a2d36] rounded-xl text-white placeholder-[#8c94a3] focus:outline-none focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80] transition-colors"
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-[#8c94a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Contraseña"
              required
              className="w-full pl-11 pr-11 py-3.5 bg-[#1c1f26] border border-[#2a2d36] rounded-xl text-white placeholder-[#8c94a3] focus:outline-none focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80] transition-colors"
            />
            <button type="button" className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#8c94a3] hover:text-white transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>

          {/* Options Row */}
          <div className="flex items-center justify-between text-sm py-1">
            <label className="flex items-center space-x-2 cursor-pointer group">
              <div className="w-5 h-5 rounded border border-[#2a2d36] bg-[#1c1f26] flex items-center justify-center group-hover:border-[#4ade80] transition-colors">
                 <svg className="w-3.5 h-3.5 text-[#4ade80] hidden group-has-[:checked]:block" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                 </svg>
                 <input type="checkbox" className="hidden" />
              </div>
              <span className="text-white">Recordarme</span>
            </label>
            <a href="#" className="text-[#4ade80] hover:text-[#22c55e] transition-colors">
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          {/* Error Message */}
          {resolvedSearchParams?.message && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {resolvedSearchParams.message}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-[#50b848] hover:bg-[#43a047] text-white font-medium transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Iniciar sesión
          </button>
        </form>
        
        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-[#232730] flex items-start gap-3">
          <div className="p-2 bg-[#1c1f26] rounded-lg">
            <svg className="h-6 w-6 text-[#4ade80]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h4 className="text-white text-sm font-medium">Acceso seguro y protegido</h4>
            <p className="text-[#8c94a3] text-xs mt-0.5">Tus datos están encriptados y protegidos</p>
          </div>
        </div>
      </div>
    </div>
  )
}
