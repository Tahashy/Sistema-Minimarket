'use client'

import { useState, useEffect } from 'react'
import qz from 'qz-tray'

export default function PrinterSettings() {
  const [paperSize, setPaperSize] = useState('80mm')
  const [autoPrint, setAutoPrint] = useState(false)
  const [printerName, setPrinterName] = useState('')
  const [saved, setSaved] = useState(false)
  
  // QZ Tray Auto-detect
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([])
  const [qzStatus, setQzStatus] = useState<'loading' | 'connected' | 'error'>('loading')

  useEffect(() => {
    const savedPaperSize = localStorage.getItem('pos_printer_size') || '80mm'
    const savedAutoPrint = localStorage.getItem('pos_printer_autoprint') === 'true'
    const savedPrinterName = localStorage.getItem('pos_printer_name') || ''
    setPaperSize(savedPaperSize)
    setAutoPrint(savedAutoPrint)
    setPrinterName(savedPrinterName)

    // Setup QZ Tray for dropdown
    const loadPrinters = async () => {
      try {
        if (!qz.websocket.isActive()) {
          await qz.websocket.connect()
        }
        setQzStatus('connected')
        const printers = await qz.printers.find()
        setAvailablePrinters(printers)
      } catch (error) {
        console.error('QZ Tray no detectado:', error)
        setQzStatus('error')
      }
    }
    
    loadPrinters()
  }, [])

  const handleSave = () => {
    localStorage.setItem('pos_printer_size', paperSize)
    localStorage.setItem('pos_printer_autoprint', String(autoPrint))
    localStorage.setItem('pos_printer_name', printerName)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="max-w-2xl animate-in fade-in duration-300">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-neutral-900">Configuración de Impresora</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Ajustes locales para la impresión directa con QZ Tray (se guarda en este navegador).
        </p>
      </div>

      <div className="space-y-6">
        {/* Printer Name */}
        <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-neutral-900">
              Impresora Destino (QZ Tray)
            </label>
            {qzStatus === 'loading' && <span className="text-xs font-bold text-amber-500 animate-pulse">Buscando QZ Tray...</span>}
            {qzStatus === 'connected' && <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>Conectado</span>}
            {qzStatus === 'error' && <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">No Detectado</span>}
          </div>
          <p className="text-xs text-neutral-500 mb-4">Selecciona tu impresora térmica de la lista. QZ Tray debe estar abierto.</p>
          
          {qzStatus === 'connected' ? (
            <select
              value={printerName}
              onChange={(e) => setPrinterName(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none font-medium text-neutral-800 appearance-none"
            >
              <option value="">-- Seleccionar Impresora --</option>
              {availablePrinters.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          ) : (
            <input 
              type="text" 
              value={printerName}
              onChange={(e) => setPrinterName(e.target.value)}
              placeholder="Ej. POS-58"
              className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none font-medium text-neutral-800"
            />
          )}
          
          {qzStatus === 'error' && (
            <p className="text-xs text-red-500 mt-2 font-medium">
              No se pudo conectar con QZ Tray. ¿Está instalado y abierto? Puedes escribir el nombre de la impresora manualmente arriba o instalar el programa.
            </p>
          )}
        </div>

        {/* Paper Size */}
        <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100">
          <label className="block text-sm font-semibold text-neutral-900 mb-4">
            Ancho del Papel (Impresora Térmica)
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setPaperSize('58mm')}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                paperSize === '58mm'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
              }`}
            >
              <span className="block text-lg font-bold mb-1">58 mm</span>
              <span className="text-xs opacity-70">Tickets pequeños</span>
            </button>
            <button
              onClick={() => setPaperSize('80mm')}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                paperSize === '80mm'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
              }`}
            >
              <span className="block text-lg font-bold mb-1">80 mm</span>
              <span className="text-xs opacity-70">Tickets estándar</span>
            </button>
          </div>
        </div>

        {/* Auto Print */}
        <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-neutral-900">Impresión Automática</h3>
            <p className="text-sm text-neutral-500 mt-1">Lanzar el ticket automáticamente al finalizar una venta</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={autoPrint}
              onChange={(e) => setAutoPrint(e.target.checked)}
            />
            <div className="w-14 h-7 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        {/* Actions */}
        <div className="pt-4 flex items-center gap-4">
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all active:scale-95 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Guardar Configuración
          </button>

          {saved && (
            <span className="text-emerald-600 text-sm font-medium animate-in fade-in flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              ¡Guardado!
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
