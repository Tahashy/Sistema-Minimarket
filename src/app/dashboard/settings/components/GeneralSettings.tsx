'use client'

import { useState, useEffect } from 'react'
import { getStoreSettings, saveStoreSettings, StoreSettings } from '@/utils/settings'
import { createClient } from '@/utils/supabase/client'
import Image from 'next/image'

export default function GeneralSettings() {
  const [settings, setSettings] = useState<StoreSettings>({
    store_name: 'AdonayMarket',
    ruc: '20601234567',
    address: 'Av. Los Próceres 123, San Juan de Lurigancho',
    phone: '999 888 777',
    email: 'contacto@adonaymarket.pe',
    currency_symbol: 'S/',
    ticket_footer_text: '¡Gracias por su compra!',
    primary_color: '#10b981',
    logo_url: null
  })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')

  const supabase = createClient()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    const data = await getStoreSettings()
    setSettings(data)
    setLoading(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setSettings(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setSaving(true)
    
    const res = await saveStoreSettings(settings)
    setSaving(false)
    
    if (res.success) {
      if (res.data) setSettings(res.data)
      setSavedMessage('✅ Cambios guardados y aplicados en todo el sistema')
      setTimeout(() => setSavedMessage(''), 4000)
    } else {
      setSavedMessage('❌ Error al guardar configuración')
      setTimeout(() => setSavedMessage(''), 4000)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    
    setUploadingLogo(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `logo-${Date.now()}.${fileExt}`
    const filePath = `${fileName}`

    try {
      const { error: uploadError } = await supabase.storage
        .from('public-assets')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('public-assets').getPublicUrl(filePath)
      const newLogoUrl = data.publicUrl
      
      const updated = { ...settings, logo_url: newLogoUrl }
      setSettings(updated)
      await saveStoreSettings(updated)
      setSavedMessage('✅ Logo actualizado correctamente')
      setTimeout(() => setSavedMessage(''), 3000)
    } catch (error: any) {
      alert('Aviso al subir logo: ' + error.message)
    } finally {
      setUploadingLogo(false)
    }
  }

  if (loading) {
    return <div className="text-neutral-500 font-bold py-12 text-center animate-pulse">Cargando configuración general...</div>
  }

  return (
    <div className="max-w-4xl animate-fade-in space-y-8">
      
      {/* Toast Feedback */}
      {savedMessage && (
        <div className="fixed bottom-6 right-6 bg-neutral-900 text-white px-5 py-3 rounded-2xl shadow-2xl z-50 font-bold text-sm border border-neutral-700 animate-fade-in-up">
          {savedMessage}
        </div>
      )}

      <div>
        <h2 className="text-2xl font-black text-neutral-900 font-serif">Configuración de la Tienda</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Personaliza los datos tributarios, de contacto e impresión de comprobantes de tu minimarket.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Identidad y Logo */}
        <div className="bg-white p-6 rounded-3xl border border-neutral-200/90 shadow-2xs space-y-6">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
            <span>🏪</span> Identidad del Negocio
          </h3>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-2xl bg-neutral-50 border-2 border-dashed border-neutral-300 flex items-center justify-center overflow-hidden relative group shrink-0">
              {settings.logo_url ? (
                <Image src={settings.logo_url} alt="Logo" fill className="object-contain p-2" />
              ) : (
                <div className="text-center p-2">
                  <svg className="w-8 h-8 text-neutral-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[10px] text-neutral-400 font-bold block mt-1">Subir Logo</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <label className="cursor-pointer text-[11px] text-white font-bold px-2.5 py-1 bg-neutral-900/80 rounded-lg">
                  Cambiar
                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} />
                </label>
              </div>
            </div>

            <div className="flex-1 w-full space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Nombre Comercial *</label>
                  <input
                    type="text"
                    name="store_name"
                    value={settings.store_name}
                    onChange={handleChange}
                    required
                    placeholder="Ej: AdonayMarket"
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-sm font-bold text-neutral-900 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">RUC / Identificación Fiscal</label>
                  <input
                    type="text"
                    name="ruc"
                    value={settings.ruc || ''}
                    onChange={handleChange}
                    placeholder="Ej: 20601234567"
                    maxLength={11}
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-sm font-mono font-bold text-neutral-800 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Datos de Ubicación y Contacto */}
        <div className="bg-white p-6 rounded-3xl border border-neutral-200/90 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
            <span>📍</span> Ubicación y Contacto
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Dirección del Local</label>
              <input
                type="text"
                name="address"
                value={settings.address || ''}
                onChange={handleChange}
                placeholder="Ej: Av. Los Próceres 123, San Juan de Lurigancho"
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-sm font-medium text-neutral-800 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Teléfono / WhatsApp</label>
              <input
                type="text"
                name="phone"
                value={settings.phone || ''}
                onChange={handleChange}
                placeholder="Ej: 999 888 777"
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-sm font-medium text-neutral-800 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Moneda y Comprobantes Térmicos */}
        <div className="bg-white p-6 rounded-3xl border border-neutral-200/90 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
            <span>🧾</span> Tickets e Impresión
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Símbolo de Moneda</label>
              <input
                type="text"
                name="currency_symbol"
                value={settings.currency_symbol || 'S/'}
                onChange={handleChange}
                placeholder="S/"
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-sm font-bold text-neutral-800 transition-all"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Mensaje de Pie de Ticket</label>
              <input
                type="text"
                name="ticket_footer_text"
                value={settings.ticket_footer_text || ''}
                onChange={handleChange}
                placeholder="Ej: ¡Gracias por su compra, vuelva pronto!"
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-sm font-medium text-neutral-800 transition-all"
              />
            </div>
          </div>

          {/* Previsualización del Encabezado del Ticket */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 text-center font-mono text-xs max-w-sm mx-auto space-y-1">
            <p className="font-bold text-sm text-neutral-900 uppercase">{settings.store_name || 'MI TIENDA'}</p>
            {settings.ruc && <p className="text-neutral-500">RUC: {settings.ruc}</p>}
            {settings.address && <p className="text-neutral-500">{settings.address}</p>}
            {settings.phone && <p className="text-neutral-500">Telf: {settings.phone}</p>}
            <p className="border-t border-dashed border-neutral-300 pt-2 mt-2 text-neutral-600 italic">
              {settings.ticket_footer_text || '¡Gracias por su compra!'}
            </p>
          </div>
        </div>

        {/* Botón Guardar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-emerald-200 transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <span>Guardando cambios...</span>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                <span>Guardar y Aplicar Cambios</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
