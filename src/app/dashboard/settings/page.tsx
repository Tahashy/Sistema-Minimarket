'use client'

import { useState } from 'react'
import GeneralSettings from './components/GeneralSettings'
import UserManagement from './components/UserManagement'
import PaymentMethodsSettings from './components/PaymentMethodsSettings'
import PrinterSettings from './components/PrinterSettings'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'payments' | 'printer'>('general')

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Configuración</h1>
          <p className="text-neutral-500 mt-1">Administra la tienda, los usuarios y los dispositivos.</p>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 bg-neutral-50 border-b md:border-b-0 md:border-r border-neutral-100 p-4 space-y-2 flex flex-row md:flex-col overflow-x-auto md:overflow-visible">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all whitespace-nowrap ${
              activeTab === 'general'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'text-neutral-600 hover:bg-neutral-200/50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            General
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'text-neutral-600 hover:bg-neutral-200/50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Usuarios y Roles
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all whitespace-nowrap ${
              activeTab === 'payments'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'text-neutral-600 hover:bg-neutral-200/50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Métodos de Pago
          </button>

          <button
            onClick={() => setActiveTab('printer')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all whitespace-nowrap ${
              activeTab === 'printer'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'text-neutral-600 hover:bg-neutral-200/50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Impresora
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-6 lg:p-10 overflow-y-auto">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'payments' && <PaymentMethodsSettings />}
          {activeTab === 'printer' && <PrinterSettings />}
        </div>
      </div>
    </div>
  )
}
