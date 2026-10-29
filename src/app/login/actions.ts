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

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    // Redirigir con el mensaje de error exacto de Supabase para saber qué pasa
    let errorMessage = 'No se pudo iniciar sesión. Verifica tus credenciales.'
    if (error.message.includes('Email not confirmed')) {
      errorMessage = 'Debes confirmar tu correo electrónico. (Puedes apagar "Confirm email" en Supabase -> Authentication -> Providers -> Email).'
    } else {
      errorMessage = error.message;
    }
    
    redirect('/login?message=' + encodeURIComponent(errorMessage))
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
