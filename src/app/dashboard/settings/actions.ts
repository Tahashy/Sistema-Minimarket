'use server'

import { createClient } from '@supabase/supabase-js'

export async function adminUpdateUserPassword(userId: string, newPassword: string) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return { 
      success: false, 
      error: 'Para que el Administrador pueda cambiar contraseñas de otros usuarios en Supabase, añade SUPABASE_SERVICE_ROLE_KEY en tu archivo .env.local' 
    }
  }

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Error al actualizar contraseña' }
  }
}
