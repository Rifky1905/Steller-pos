import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { sendPasswordWhatsApp, normalizePhone } from './otp'
import './App.css'

// Steller Logo Component
const StellerLogo = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGradientLogin" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C9A227" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
      <linearGradient id="blueGradientLogin" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E3A8A" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <filter id="glowLogin">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#glowLogin)">
      <path d="M32 8L36 20H48L38 28L42 40L32 32L22 40L26 28L16 20H28L32 8Z" fill="url(#goldGradientLogin)" />
    </g>
    <path d="M32 18L34 24H30L32 18Z" fill="#FFF8DC" opacity="0.8" />
    <path d="M52 10L53.8 16.2L60 18L53.8 19.8L52 26L50.2 19.8L44 18L50.2 16.2L52 10Z" fill="url(#goldGradientLogin)" opacity="0.85" />
    <text x="64" y="41" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="url(#blueGradientLogin)" letter-spacing="0.5">Steller</text>
  </svg>
)

// Kasir demo — hanya dipakai pada mode demo (tanpa sesi merchant)
const DEMO_CASHIERS = [
  { name: 'Rika Amelia', role: 'Kasir', email: 'rika@demo.steller.id', password: 'kasir123' },
  { name: 'Budi Santoso', role: 'Kasir', email: 'budi@demo.steller.id', password: 'kasir123' },
  { name: 'Dewi Lestari', role: 'Supervisor', email: 'dewi@demo.steller.id', password: 'kasir123' },
]

const getMerchantSession = () => {
  try { return JSON.parse(sessionStorage.getItem('merchantSession')) } catch { return null }
}

// Cari karyawan di tabel Supabase — kasir bisa login dari perangkat mana pun
const findCashierByEmail = async (email) => {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .ilike('email', email)
    .limit(1)
  if (error) return { error }
  if (data && data.length > 0) return { emp: data[0], merchantId: data[0].merchant_id }
  // Fallback kasir demo — hanya saat mode demo (tanpa sesi merchant)
  if (!getMerchantSession()) {
    const demo = DEMO_CASHIERS.find(c => c.email === email.toLowerCase())
    if (demo) return { emp: demo, merchantId: null }
  }
  return null
}

function Login() {
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState('owner')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  // Lupa kata sandi — kirim sandi via WhatsApp (Fonnte)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotPhone, setForgotPhone] = useState('')
  const [forgotState, setForgotState] = useState(null) // { type:'loading'|'success'|'error', text }

  const handleForgotPassword = async () => {
    const raw = forgotPhone.trim()
    if (!raw) { setForgotState({ type: 'error', text: 'Masukkan nomor WhatsApp Anda terlebih dahulu.' }); return }
    setForgotState({ type: 'loading', text: 'Mencari akun...' })

    // Toleransi format nomor: 08xx, 62xx, +62xx, atau variasi lainnya
    const digits = raw.replace(/\D/g, '')
    const intl = normalizePhone(raw)
    const local = '0' + intl.slice(2)
    const candidates = [...new Set([digits, intl, '+' + intl, local])]

    const { data, error } = await supabase
      .from('merchants')
      .select('owner_name, store_name, email, whatsapp, password')
      .in('whatsapp', candidates)
      .limit(1)
      .maybeSingle()

    if (error) {
      setForgotState({ type: 'error', text: 'Gagal memeriksa data: ' + error.message })
      return
    }
    if (!data) {
      setForgotState({ type: 'error', text: 'Nomor WhatsApp tidak terdaftar. Gunakan nomor yang sama saat mendaftar.' })
      return
    }

    setForgotState({ type: 'loading', text: 'Mengirim kata sandi ke WhatsApp Anda...' })
    const res = await sendPasswordWhatsApp(data.whatsapp, data.password, data.email, data.owner_name, data.store_name)
    if (res.ok) {
      setForgotState({ type: 'success', text: `✅ Kata sandi telah dikirim ke WhatsApp ${data.whatsapp}. Silakan cek pesan masuk Anda.` })
    } else if (res.unconfigured) {
      setForgotState({ type: 'error', text: 'Layanan pengiriman WhatsApp belum aktif. Hubungi admin 0858-9317-4442.' })
    } else {
      setForgotState({ type: 'error', text: `Gagal mengirim pesan: ${res.error}` })
    }
  }

  const handleCashierLogin = async () => {
    setIsChecking(true)
    const match = await findCashierByEmail(email.trim())
    if (match?.error) {
      setIsChecking(false)
      setLoginError('Gagal memeriksa akun: ' + match.error.message)
      return
    }
    if (!match) {
      setIsChecking(false)
      setLoginError('Email kasir tidak terdaftar. Minta owner membuat akun Anda.')
      return
    }
    const { emp, merchantId } = match
    if (emp.status && emp.status !== 'active') {
      setIsChecking(false)
      setLoginError('Akun kasir ini telah dinonaktifkan. Hubungi owner toko Anda.')
      return
    }
    if (emp.password && String(emp.password) !== password) {
      setIsChecking(false)
      setLoginError('Sandi kasir salah. Silakan periksa kembali.')
      return
    }
    let outlet = 'Pusat - Malioboro'
    if (merchantId) {
      try {
        const { data } = await supabase.from('merchants').select('store_name').eq('id', merchantId).maybeSingle()
        if (data?.store_name) outlet = data.store_name
      } catch { /* tetap outlet default */ }
    } else {
      const merchant = getMerchantSession()
      if (merchant?.storeName) outlet = merchant.storeName
    }

    sessionStorage.setItem('cashierLoggedIn', 'true')
    sessionStorage.setItem('cashierName', emp.name)
    sessionStorage.setItem('cashierOutlet', outlet)
    sessionStorage.setItem('cashierRole', emp.role || 'Kasir')
    // Simpan merchant_id toko pemilik akun kasir — dipakai POS untuk scope katalog
    if (merchantId) sessionStorage.setItem('cashierMerchantId', String(merchantId))
    else sessionStorage.removeItem('cashierMerchantId')
    setIsChecking(false)
    navigate('/pos')
  }

  const handleLogin = async () => {
    // Validasi ketat: form kosong tidak boleh lolos (owner & kasir)
    if (!email.trim() || !password.trim()) {
      setLoginError('Email dan sandi wajib diisi!')
      return
    }
    // Bersihkan sesi kasir lama agar scope toko tidak tertukar
    sessionStorage.removeItem('cashierMerchantId')
    sessionStorage.removeItem('cashierLoggedIn')
    sessionStorage.removeItem('cashierName')
    sessionStorage.removeItem('cashierOutlet')
    sessionStorage.removeItem('cashierRole')
    if (selectedRole === 'kasir') {
      await handleCashierLogin()
      return
    }

    setIsChecking(true)
    setLoginError('')
    const { data: merchant, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()
    setIsChecking(false)

    if (error) {
      setLoginError('Gagal memeriksa akun: ' + error.message)
      return
    }
    if (!merchant) {
      setLoginError('Email belum terdaftar sebagai merchant. Silakan daftar dulu.')
      return
    }
    if (merchant.password && merchant.password !== password) {
      setLoginError('Kata sandi salah.')
      return
    }

    sessionStorage.setItem('merchantSession', JSON.stringify({
      id: merchant.id, email: merchant.email, ownerName: merchant.owner_name,
      storeName: merchant.store_name, plan: merchant.plan, status: merchant.status,
      startDate: merchant.start_date, endDate: merchant.end_date,
      avatar: merchant.avatar_url || '',
    }))

    if (merchant.status === 'inactive') {
      setLoginError('Akun toko dinonaktifkan. Hubungi admin platform StellerPOS.')
      return
    }
    if (merchant.status !== 'active') {
      navigate('/subscription-payment')
      return
    }
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Back to Landing Page */}
        <div className="mb-4">
          <Link to="/" className="inline-flex items-center text-sm text-slate-300 hover:text-white transition">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Kembali ke Halaman Utama
          </Link>
        </div>

        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4 bg-white rounded-2xl py-3 px-6 inline-flex">
            <StellerLogo className="w-48 h-14" />
          </div>

          {/* Badge */}
          <div className="inline-block bg-white/10 text-amber-300 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 border border-white/20">
            SISTEM KASIR PINTAR & TERPERCAYA
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-2">Masuk ke Akun Toko</h1>
          <p className="text-slate-300 text-sm">
            Silahkan pilih peran dan masukan kredensial untuk membuka sesi kasir atau manajemen toko.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Role Selection */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => { setSelectedRole('kasir'); setLoginError('') }}
              className={`p-4 rounded-xl border-2 transition ${
                selectedRole === 'kasir'
                  ? 'border-navy-500 bg-navy-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex flex-col items-center text-center">
                <svg className="w-8 h-8 mb-2 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="font-semibold text-sm text-gray-900">Kasir / Pegawai</span>
                <span className="text-xs text-gray-500 mt-1">Terminal POS & Penjualan</span>
              </div>
            </button>
            <button
              onClick={() => { setSelectedRole('owner'); setLoginError('') }}
              className={`p-4 rounded-xl border-2 transition ${
                selectedRole === 'owner'
                  ? 'border-navy-500 bg-navy-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex flex-col items-center text-center">
                <svg className="w-8 h-8 mb-2 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="font-semibold text-sm text-gray-900">Owner / Pemilik</span>
                <span className="text-xs text-gray-500 mt-1">Manajemen & Laporan</span>
              </div>
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Username/Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {selectedRole === 'kasir' ? 'Email Kasir' : 'Nama Pengguna / Email'}
              </label>
              <input
                type="text"
                placeholder={selectedRole === 'kasir' ? 'contoh: kasir@tokoanda.id' : 'contoh: owner@sinarrejeki.co.id'}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setLoginError('') }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kata Sandi</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={selectedRole === 'kasir' ? 'Sandi kasir dari owner' : 'Masukan kata sandi'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setLoginError('') }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition pr-12"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="mr-2 w-4 h-4 text-navy-600 rounded border-gray-300 focus:ring-navy-500"
                />
                <span className="text-sm text-gray-700">Ingat Sesi Perangkat Ini</span>
              </label>
              <button
                type="button"
                onClick={() => { setShowForgot(true); setForgotState(null); setForgotPhone('') }}
                className="text-sm text-navy-600 hover:text-navy-700 font-medium"
              >
                Lupa Kata Sandi?
              </button>
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                ⚠️ {loginError}
              </div>
            )}

            {/* Login Button */}
            <button
              onClick={handleLogin}
              disabled={isChecking}
              className="w-full bg-navy-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-navy-700 transition shadow-lg flex items-center justify-center disabled:opacity-60"
            >
              {isChecking ? 'Memeriksa akun...' : selectedRole === 'kasir' ? 'Mulai Shift & Buka Kasir' : 'Masuk ke Sistem Steller'}
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Register Link */}
            <div className="text-center pt-4 border-t border-gray-200 space-y-2">
              <div>
                <span className="text-sm text-gray-600">Belum punya akun Steller? </span>
                <Link to="/register" className="text-sm font-bold text-navy-600 hover:text-navy-700">
                  Daftar Akun Baru Sekarang
                </Link>
              </div>
              <button
                onClick={() => {
                  sessionStorage.removeItem('merchantSession')
                  sessionStorage.removeItem('cashierMerchantId')
                  navigate('/dashboard')
                }}
                className="text-xs text-gray-400 hover:text-navy-600 transition"
              >
                🎭 Masuk Mode Demo (tanpa akun)
              </button>
            </div>
          </div>
        </div>

        {/* Security Footer */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-center text-sm text-slate-300">
            <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Terkoneksi Aman dengan Cloud Sync 256-bit SSL
          </div>
          <div className="flex items-center justify-center text-sm text-slate-300">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            Mode Offline Tersedia jika Internet Terputus
          </div>
          <div className="text-center">
            <Link to="/super-admin" className="text-xs text-slate-400 hover:text-amber-400 transition">
              👑 Masuk sebagai Super Admin (Platform Owner)
            </Link>
          </div>
          <div className="text-center text-xs text-slate-500 mt-4">
            Hak Cipta © 2026 Steller POS Indonesia. Versi Aplikasi v2.4.0-rilis.
          </div>
        </div>
      </div>

      {/* Modal Lupa Kata Sandi — kirim sandi ke WA terdaftar via Fonnte */}
      {showForgot && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">🔑 Lupa Kata Sandi</h2>
              <button onClick={() => setShowForgot(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Masukkan nomor WhatsApp yang Anda daftarkan — kata sandi akan dikirim otomatis ke nomor tersebut.
            </p>
            <input
              type="tel"
              value={forgotPhone}
              onChange={(e) => { setForgotPhone(e.target.value); setForgotState(null) }}
              onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()}
              placeholder="cth: 0812-3456-7890"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition mb-4"
            />
            {forgotState && forgotState.type !== 'loading' && (
              <div className={`mb-4 text-sm px-4 py-3 rounded-lg border ${
                forgotState.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {forgotState.text}
              </div>
            )}
            <button
              onClick={handleForgotPassword}
              disabled={forgotState?.type === 'loading'}
              className="w-full py-3 bg-navy-600 text-white rounded-lg font-semibold hover:bg-navy-700 transition disabled:opacity-50"
            >
              {forgotState?.type === 'loading' ? `⏳ ${forgotState.text}` : '💬 Kirim Kata Sandi ke WhatsApp'}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              Nomor harus sama dengan yang diisi saat registrasi toko.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default Login
