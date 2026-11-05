'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { data: authData, error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    // Redirigir con el mensaje de error exacto de Supabase para saber qué pasa
    let errorMessage = 'No se pudo iniciar sesión. Verifica tus credenciales.'
    if (error.message.includes('Email not confirmed')) {
      errorMessage = 'Debes confirmar tu correo electrónico. (Puedes apagar "Confirm email" en Supabase -> Authentication -> Providers -> Email).'
    } else if (error.message.includes('Invalid login credentials')) {
      errorMessage = 'Credenciales incorrectas. Verifica tu correo y contraseña.'
    } else {
      errorMessage = error.message;
    }
    
    redirect('/login?message=' + encodeURIComponent(errorMessage))
  }

  // Verificar si la cuenta está inactiva
  if (authData?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', authData.user.id)
      .maybeSingle()

    const status = profile?.status || authData.user.user_metadata?.status || 'Activo'
    if (status === 'Inactivo') {
      await supabase.auth.signOut()
      redirect('/login?message=' + encodeURIComponent('Tu cuenta ha sido desactivada por el administrador.'))
    }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
