import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { generateOtp, sendOtpWhatsApp, normalizePhone } from './otp'
import './App.css'

// Steller Logo Component
const StellerLogo = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGradientReg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C9A227" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
      <linearGradient id="blueGradientReg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E3A8A" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <filter id="glowReg">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#glowReg)">
      <path d="M32 8L36 20H48L38 28L42 40L32 32L22 40L26 28L16 20H28L32 8Z" fill="url(#goldGradientReg)" />
    </g>
    <path d="M32 18L34 24H30L32 18Z" fill="#FFF8DC" opacity="0.8" />
    <path d="M52 10L53.8 16.2L60 18L53.8 19.8L52 26L50.2 19.8L44 18L50.2 16.2L52 10Z" fill="url(#goldGradientReg)" opacity="0.85" />
    <text x="64" y="41" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="url(#blueGradientReg)" letter-spacing="0.5">Steller</text>
  </svg>
)

// Hanya 5 produk contoh yang disalin ke toko baru
const DEMO_PRODUCT_NAMES = [
  'Beras Rojolele', 'Minyak Bimoli', 'Gula Pasir', 'Kopi Kapal Api', 'Indomie Goreng',
]

// Daftar kota & kabupaten utama Indonesia (untuk autocomplete lokasi toko)
const INDONESIAN_CITIES = [
  'Jakarta Pusat', 'Jakarta Barat', 'Jakarta Selatan', 'Jakarta Timur', 'Jakarta Utara',
  'Bandung', 'Bandung Barat', 'Cimahi', 'Sumedang', 'Garut', 'Tasikmalaya', 'Cirebon',
  'Bogor', 'Depok', 'Bekasi', 'Tangerang', 'Tangerang Selatan', 'Serang', 'Cilegon',
  'Semarang', 'Surakarta (Solo)', 'Yogyakarta', 'Sleman', 'Bantul', 'Magelang', 'Salatiga',
  'Pekalongan', 'Tegal', 'Kudus', 'Purwokerto', 'Klaten', 'Boyolali', 'Sragen',
  'Surabaya', 'Malang', 'Batu', 'Kediri', 'Madiun', 'Jember', 'Banyuwangi', 'Sidoarjo',
  'Gresik', 'Pasuruan', 'Probolinggo', 'Mojokerto', 'Blitar', 'Tulungagung',
  'Denpasar', 'Badung', 'Gianyar', 'Tabanan', 'Mataram', 'Kupang',
  'Medan', 'Binjai', 'Pematangsiantar', 'Padang', 'Bukittinggi', 'Pekanbaru', 'Batam',
  'Tanjung Pinang', 'Palembang', 'Prabumulih', 'Jambi', 'Bandar Lampung', 'Bengkulu',
  'Banda Aceh', 'Pontianak', 'Singkawang', 'Palangkaraya', 'Banjarmasin', 'Banjarbaru',
  'Samarinda', 'Balikpapan', 'Bontang', 'Tarakan', 'Makassar', 'Parepare', 'Palu',
  'Manado', 'Bitung', 'Gorontalo', 'Kendari', 'Ambon', 'Ternate', 'Jayapura', 'Sorong',
]

const PLAN_OPTIONS = [
  { name: '1 Bulan', price: 100000, days: 30, priceLabel: 'Rp 100.000' },
  { name: '3 Bulan', price: 280000, days: 90, priceLabel: 'Rp 280.000' },
  { name: '6 Bulan', price: 550000, days: 180, priceLabel: 'Rp 550.000' },
  { name: '1 Tahun', price: 1000000, days: 365, priceLabel: 'Rp 1.000.000', badge: '⭐ Paling Hemat' },
]

function Registration() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Jalur uji coba gratis: tanpa pemilihan paket berbayar & pembayaran
  const isTrial = searchParams.get('trial') === '1'
  const planParam = searchParams.get('plan')
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [form, setForm] = useState({
    ownerName: '', whatsapp: '', email: '', password: '',
    storeName: '', category: '', city: '',
  })
  const [selectedPlan, setSelectedPlan] = useState(
    PLAN_OPTIONS.some(p => p.name === planParam) ? planParam : '1 Bulan'
  )
  const [includeDemo, setIncludeDemo] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [cityFocus, setCityFocus] = useState(false)

  // Verifikasi akun via OTP — hanya WhatsApp (dikirim otomatis via gateway)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyInput, setVerifyInput] = useState('')
  const [verifyMsg, setVerifyMsg] = useState('')
  const [registeredId, setRegisteredId] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  // status pengiriman OTP: '' | 'wa' | 'email' saat loading; hasil di otpStatus
  const [otpSending, setOtpSending] = useState('')
  const [otpStatus, setOtpStatus] = useState(null) // { type: 'success'|'error'|'warn', text }

  // Wilayah berjenjang: Provinsi -> Kab/Kota -> Kecamatan (API emsifa)
  const WILAYAH_API = 'https://www.emsifa.com/api-wilayah-indonesia/api'
  const [provinces, setProvinces] = useState([])
  const [regencies, setRegencies] = useState([])
  const [districts, setDistricts] = useState([])
  const [selProvince, setSelProvince] = useState(null)
  const [selRegency, setSelRegency] = useState(null)
  const [selDistrict, setSelDistrict] = useState(null)
  const [wilayahLoading, setWilayahLoading] = useState('')
  const [wilayahError, setWilayahError] = useState(false)

  useEffect(() => {
    fetch(`${WILAYAH_API}/provinces.json`)
      .then(r => r.json())
      .then(setProvinces)
      .catch(() => setWilayahError(true))
  }, [])

  const pickProvince = (id) => {
    const prov = provinces.find(p => String(p.id) === id) || null
    setSelProvince(prov); setSelRegency(null); setSelDistrict(null)
    setRegencies([]); setDistricts([])
    update('city', '')
    if (!prov) return
    setWilayahLoading('regency')
    fetch(`${WILAYAH_API}/regencies/${prov.id}.json`)
      .then(r => r.json())
      .then(d => { setRegencies(d); setWilayahLoading('') })
      .catch(() => { setWilayahLoading(''); setWilayahError(true) })
  }

  const pickRegency = (id) => {
    const reg = regencies.find(r => String(r.id) === id) || null
    setSelRegency(reg); setSelDistrict(null); setDistricts([])
    update('city', '')
    if (!reg) return
    setWilayahLoading('district')
    fetch(`${WILAYAH_API}/districts/${reg.id}.json`)
      .then(r => r.json())
      .then(d => { setDistricts(d); setWilayahLoading('') })
      .catch(() => { setWilayahLoading(''); setWilayahError(true) })
  }

  const pickDistrict = (id) => {
    const dist = districts.find(d => String(d.id) === id) || null
    setSelDistrict(dist)
    if (dist && selRegency && selProvince) {
      update('city', `Kec. ${dist.name}, ${selRegency.name}, ${selProvince.name}`)
    }
  }

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  // Saran kota otomatis sesuai ketikan pengguna (fallback jika API wilayah gagal)
  const citySuggestions = form.city.trim()
    ? INDONESIAN_CITIES
        .filter(c => c.toLowerCase().includes(form.city.trim().toLowerCase()))
        .slice(0, 8)
    : []

  // Sandi kuat: min. 8 karakter, wajib mengandung huruf DAN angka
  const isStrongPassword = (p) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p)
  const passwordChecks = [
    { label: 'Minimal 8 karakter', ok: form.password.length >= 8 },
    { label: 'Mengandung huruf (a-z)', ok: /[A-Za-z]/.test(form.password) },
    { label: 'Mengandung angka (0-9)', ok: /\d/.test(form.password) },
  ]

  const handleNext = () => {
    setError('')
    if (!form.ownerName.trim() || !form.whatsapp.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Lengkapi Nama Pemilik, No. WhatsApp, Email, dan Kata Sandi terlebih dahulu.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Format email tidak valid.')
      return
    }
    if (!isStrongPassword(form.password)) {
      setError('Kata sandi harus minimal 8 karakter dan mengandung kombinasi huruf & angka!')
      return
    }
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.ownerName.trim() || !form.storeName.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Lengkapi Nama Pemilik, Nama Toko, Email, dan Kata Sandi terlebih dahulu.')
      return
    }
    if (!isStrongPassword(form.password)) {
      setError('Kata sandi harus minimal 8 karakter dan mengandung kombinasi huruf & angka!')
      return
    }
    if (!form.category || !form.city.trim()) {
      setError('Pilih Kategori Usaha dan lengkapi lokasi toko (Provinsi, Kabupaten/Kota, Kecamatan).')
      return
    }
    setIsSubmitting(true)

    // Tolak pendaftaran ganda: email ATAU nomor WhatsApp yang sudah terdaftar tidak boleh dipakai lagi
    const emailLower = form.email.trim().toLowerCase()
    const waIntl = normalizePhone(form.whatsapp)
    const waLocal = '0' + waIntl.slice(2)
    const waCandidates = [...new Set([form.whatsapp.trim(), waIntl, '+' + waIntl, waLocal])]
    const { data: existing } = await supabase
      .from('merchants')
      .select('email, whatsapp')
      .or(`email.eq.${emailLower},whatsapp.in.(${waCandidates.join(',')})`)
      .limit(1)
      .maybeSingle()

    if (existing) {
      setIsSubmitting(false)
      const emailTaken = existing.email?.toLowerCase() === emailLower
      const waTaken = waCandidates.includes(existing.whatsapp)
      setError(
        emailTaken && waTaken
          ? 'Email dan nomor WhatsApp ini sudah terdaftar. Silakan login atau hubungi admin.'
          : emailTaken
            ? 'Email ini sudah terdaftar. Silakan login atau gunakan email lain.'
            : 'Nomor WhatsApp ini sudah terdaftar di toko lain. Gunakan nomor yang berbeda.'
      )
      return
    }

    const plan = PLAN_OPTIONS.find(p => p.name === selectedPlan)
    const now = new Date()
    const code = generateOtp()
    const payload = {
      store_name: form.storeName.trim(),
      verification_code: code,
      is_verified: false,
      owner_name: form.ownerName.trim(),
      email: form.email.trim().toLowerCase(),
      whatsapp: form.whatsapp.trim(),
      address: form.city.trim(),
      password: form.password,
      ...(isTrial
        ? {
            plan: 'Trial 14 Hari', plan_price: 0,
            status: 'active', payment_status: 'paid',
            start_date: now.toISOString(),
            end_date: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          }
        : {
            plan: plan.name, plan_price: plan.price,
            status: 'pending', payment_status: 'unpaid',
          }),
    }
    const { data, error: err } = await supabase
      .from('merchants')
      .insert(payload)
      .select()
      .single()

    if (err) {
      setIsSubmitting(false)
      if (err.code === '23505' || err.message?.includes('duplicate')) {
        setError('Email ini sudah terdaftar. Silakan login atau gunakan email lain.')
      } else {
        setError('Gagal menyimpan pendaftaran: ' + err.message + ' — pastikan tabel merchants sudah dibuat (lihat schema.sql)')
      }
      return
    }

    // Salin maksimal 5 produk contoh (dummy) ke toko baru jika dicentang
    if (includeDemo) {
      try {
        const { data: demoCats } = await supabase.from('categories').select('id, name').is('merchant_id', null)
        const { data: demoProds } = await supabase.from('products').select('*').is('merchant_id', null)
        const pickedProds = (demoProds || []).filter(p => DEMO_PRODUCT_NAMES.includes(p.name)).slice(0, 5)
        const neededCatIds = new Set(pickedProds.map(p => p.category_id).filter(Boolean))
        const catsToCopy = (demoCats || []).filter(c => neededCatIds.has(c.id))
        let catMap = {}
        if (catsToCopy.length) {
          const { data: newCats } = await supabase.from('categories')
            .insert(catsToCopy.map(c => ({ name: c.name, merchant_id: data.id })))
            .select('id, name')
          catMap = Object.fromEntries((newCats || []).map(c => [c.name, c.id]))
        }
        const oldToName = Object.fromEntries((demoCats || []).map(c => [c.id, c.name]))
        if (pickedProds.length) {
          await supabase.from('products').insert(pickedProds.map(p => ({
            name: p.name, weight: p.weight, barcode: p.barcode,
            category_id: catMap[oldToName[p.category_id]] || null,
            buy_price: p.buy_price, sell_price: p.sell_price,
            stock: p.stock, sold: 0,
            merchant_id: data.id,
          })))
        }
      } catch { /* data contoh gagal disalin — toko tetap terdaftar kosong */ }
    }

    sessionStorage.setItem('merchantSession', JSON.stringify({
      id: data.id,
      email: data.email,
      ownerName: data.owner_name,
      storeName: data.store_name,
      plan: data.plan,
      status: data.status,
      startDate: data.start_date,
      endDate: data.end_date,
    }))
    // Lanjut ke tahap verifikasi akun (OTP via WhatsApp/email admin)
    setVerifyCode(code)
    setRegisteredId(data.id)
    setIsSubmitting(false)
    setStep(3)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    // Kirim OTP otomatis ke WhatsApp pengguna via gateway (nomor admin 085893174442)
    handleSendOtp(code)
  }

  const goNextAfterVerify = () => navigate(isTrial ? '/dashboard' : '/subscription-payment')

  // Kirim kode OTP otomatis ke WhatsApp pengguna via gateway
  const handleSendOtp = async (codeOverride) => {
    const code = codeOverride || verifyCode
    if (!code || otpSending) return
    setOtpSending('wa')
    setOtpStatus(null)
    const res = await sendOtpWhatsApp(form.whatsapp, code, form.storeName)
    setOtpSending('')
    if (res.ok) {
      setOtpStatus({
        type: 'success',
        text: `✅ Kode terkirim ke WhatsApp ${form.whatsapp} — cek pesan masuk.`,
      })
    } else if (res.unconfigured) {
      setOtpStatus({
        type: 'warn',
        text: `⚠️ Layanan otomatis belum aktif (token belum terbaca). Minta kode manual ke admin via tombol WhatsApp di bawah.`,
      })
    } else {
      setOtpStatus({ type: 'error', text: `❌ Gagal mengirim kode (${res.error}). Coba lagi atau minta manual ke admin.` })
    }
  }

  const handleVerify = async () => {
    if (verifyInput.trim().length !== 6) {
      setVerifyMsg('Masukkan kode verifikasi 6 digit.')
      return
    }
    if (verifyInput.trim() !== verifyCode) {
      setVerifyMsg('⚠️ Kode verifikasi salah. Periksa kembali kode yang dikirim admin.')
      return
    }
    setIsVerifying(true)
    await supabase.from('merchants')
      .update({ is_verified: true, verified_at: new Date().toISOString() })
      .eq('id', registeredId)
    try {
      const s = JSON.parse(sessionStorage.getItem('merchantSession'))
      if (s) sessionStorage.setItem('merchantSession', JSON.stringify({ ...s, isVerified: true }))
    } catch { /* ignore */ }
    setIsVerifying(false)
    goNextAfterVerify()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-6">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-col items-center">
            {/* Steller Logo */}
            <div className="flex items-center mb-4">
              <StellerLogo className="w-40 h-12" />
            </div>
            
            {/* Back Button */}
            <Link to="/" className="flex items-center text-gray-600 hover:text-navy-600 transition text-sm">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Uji Coba Gratis 14 Hari Tanpa Kartu Kredit
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Title Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Daftarkan Bisnis & Toko Anda</h1>
          <p className="text-gray-600">Mulai kelola inventaris, terminal kasir pintar, dan audit finansial dengan cepat dan mudah.</p>
        </div>

        {/* Stepper — dinamis mengikuti tahap aktif */}
        <div className="flex items-center justify-center mb-10">
          <div className="flex items-center space-x-4">
            {[
              { n: 1, label: 'Pemilik Usaha' },
              { n: 2, label: isTrial ? 'Profil Toko' : 'Profil Toko & Paket' },
              { n: 3, label: 'Verifikasi Akun' },
              ...(!isTrial ? [{ n: 4, label: 'Pembayaran & Aktivasi' }] : []),
            ].map((s, i, arr) => (
              <div key={s.n} className="flex items-center space-x-4">
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step > s.n
                      ? 'bg-green-500 text-white'
                      : step === s.n
                        ? 'bg-navy-600 text-white ring-4 ring-navy-100'
                        : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step > s.n ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : s.n}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    step === s.n ? 'text-navy-600 font-bold' : step > s.n ? 'text-green-600' : 'text-gray-500'
                  }`}>{s.label}</span>
                </div>
                {i < arr.length - 1 && <div className={`w-16 h-0.5 ${step > s.n ? 'bg-green-500' : 'bg-gray-300'}`}></div>}
              </div>
            ))}
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {step === 1 && (
          <>
          {/* Section 1: Owner Information */}
          <div className="mb-8">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-navy-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Informasi Pemilik Usaha</h2>
            </div>

            {/* Full Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap Pemilik *</label>
              <input
                type="text"
                placeholder="cth: Rifky Arya Firdaus"
                value={form.ownerName}
                onChange={(e) => update('ownerName', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition"
              />
            </div>

            {/* WhatsApp & Email (Two Columns) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">No. WhatsApp / HP Aktif *</label>
                <input
                  type="text"
                  placeholder="+62 812-3456-7890"
                  value={form.whatsapp}
                  onChange={(e) => update('whatsapp', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Bisnis *</label>
                <input
                  type="email"
                  placeholder="cth: owner@sinarrejeki.com"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">ⓘ Digunakan untuk verifikasi OTP & laporan</p>

            {/* Password */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Kata Sandi Baru *</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimal 8 karakter unik"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
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
            <div className="mt-2 space-y-1">
              {passwordChecks.map((c) => (
                <p key={c.label} className={`text-xs flex items-center ${c.ok ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className="mr-1.5">{c.ok ? '✓' : '○'}</span>{c.label}
                </p>
              ))}
            </div>
          </div>

          {/* Error — Tahap 1 */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              ⚠️ {error}
            </div>
          )}

          {/* Tombol Lanjut Tahap 2 */}
          <button
            onClick={handleNext}
            className="w-full py-4 bg-navy-600 text-white rounded-lg font-semibold text-lg hover:bg-navy-700 transition shadow-lg flex items-center justify-center"
          >
            Lanjut ke Profil Toko & Paket
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          </>
          )}

          {step === 2 && (
          <>
          {/* Section 2: Store Profile */}
          <div className="mb-8">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-navy-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Profil Toko / Usaha</h2>
            </div>

            {/* Store Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nama Toko / Outlet Pertama *</label>
              <input
                type="text"
                placeholder="cth: Toko Kelontong Sinar Rejeki"
                value={form.storeName}
                onChange={(e) => update('storeName', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition"
              />
            </div>

            {/* Category & Location (Two Columns) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kategori Usaha *</label>
                <select
                  value={form.category}
                  onChange={(e) => update('category', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition bg-white"
                >
                  <option value="">Pilih Bidang Usaha...</option>
                  <option>Toko Kelontong / Minimarket</option>
                  <option>Toko Elektronik</option>
                  <option>Bengkel / Spare Part Motor</option>
                  <option>Toko Listrik</option>
                  <option>Toko Bangunan</option>
                  <option>Toko Fashion</option>
                  <option>Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lokasi Toko *</label>
                {wilayahError ? (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ketik nama kota, cth: Bogor"
                      value={form.city}
                      onChange={(e) => { update('city', e.target.value); setCityFocus(true) }}
                      onFocus={() => setCityFocus(true)}
                      onBlur={() => setTimeout(() => setCityFocus(false), 150)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition pl-10"
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {cityFocus && citySuggestions.length > 0 && (
                      <ul className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-30 max-h-56 overflow-y-auto">
                        {citySuggestions.map((city) => (
                          <li key={city}>
                            <button
                              type="button"
                              onMouseDown={() => { update('city', city); setCityFocus(false) }}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-navy-50 hover:text-navy-700 transition flex items-center"
                            >
                              <span className="mr-2 text-gray-400">📍</span>{city}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-1 text-xs text-amber-600">Daftar wilayah tidak dapat dimuat — isi lokasi manual.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid sm:grid-cols-2 gap-2">
                      <select
                        value={selProvince?.id || ''}
                        onChange={(e) => pickProvince(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition bg-white text-sm"
                      >
                        <option value="">{provinces.length ? 'Pilih Provinsi...' : 'Memuat Provinsi...'}</option>
                        {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <select
                        value={selRegency?.id || ''}
                        onChange={(e) => pickRegency(e.target.value)}
                        disabled={!selProvince}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition bg-white text-sm disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        <option value="">{wilayahLoading === 'regency' ? 'Memuat...' : 'Pilih Kabupaten / Kota...'}</option>
                        {regencies.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                    <select
                      value={selDistrict?.id || ''}
                      onChange={(e) => pickDistrict(e.target.value)}
                      disabled={!selRegency}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition bg-white text-sm disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">{wilayahLoading === 'district' ? 'Memuat...' : 'Pilih Kecamatan...'}</option>
                      {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    {form.city && (
                      <p className="text-xs text-green-600 flex items-center"><span className="mr-1">📍</span>{form.city}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Info Box */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900">Kebutuhan Modul & Fasilitas Kasir</h3>
            </div>

            {/* Checkbox 1 */}
            <div className="mb-4">
              <label className="flex items-start cursor-pointer">
                <input type="checkbox" defaultChecked className="mt-1 mr-3 w-4 h-4 text-navy-600 rounded border-gray-300 focus:ring-navy-500" />
                <div>
                  <span className="text-sm font-medium text-gray-700">Modul Cetak Struk Kasir Bluetooth / Thermal 58mm & 80mm</span>
                  <p className="text-xs text-gray-500 mt-1">Langsung tersambung dengan printer kasir tanpa instalasi rumit.</p>
                </div>
              </label>
            </div>

            {/* Checkbox 2 */}
            <div className="mb-4">
              <label className="flex items-start cursor-pointer">
                <input type="checkbox" defaultChecked className="mt-1 mr-3 w-4 h-4 text-navy-600 rounded border-gray-300 focus:ring-navy-500" />
                <div>
                  <span className="text-sm font-medium text-gray-700">Aktivasi Pembayaran Digital QRIS Instan</span>
                  <p className="text-xs text-gray-500 mt-1">Terima pembayaran Gopay, OVO, ShopeePay, BCA, dan bank lainnya dalam 1 QR.</p>
                </div>
              </label>
            </div>

            {/* Checkbox 3 — Data dummy */}
            <div>
              <label className="flex items-start cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDemo}
                  onChange={(e) => setIncludeDemo(e.target.checked)}
                  className="mt-1 mr-3 w-4 h-4 text-navy-600 rounded border-gray-300 focus:ring-navy-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Sertakan Data Produk Contoh (Dummy)</span>
                  <p className="text-xs text-gray-500 mt-1">Inventaris langsung terisi produk contoh untuk uji coba. Hapus centang jika ingin mulai dari nol.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3: Paket — jalur berbayar saja; trial mendapat banner gratis */}
          {isTrial ? (
            <div className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 flex items-center space-x-4">
              <span className="text-3xl">🎉</span>
              <div>
                <h3 className="font-bold text-gray-900">Uji Coba Gratis 14 Hari</h3>
                <p className="text-sm text-gray-600">Akun langsung aktif setelah pendaftaran — tanpa kartu kredit, tanpa pembayaran. Semua fitur POS bisa dicoba penuh.</p>
              </div>
            </div>
          ) : (
          <div className="mb-8">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-navy-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-xl">💳</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Pilih Paket Langganan</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {PLAN_OPTIONS.map((plan) => (
                <button
                  key={plan.name}
                  type="button"
                  onClick={() => setSelectedPlan(plan.name)}
                  className={`relative p-4 rounded-xl border-2 text-left transition ${
                    selectedPlan === plan.name
                      ? 'border-navy-600 bg-navy-600 text-white shadow-lg'
                      : 'border-gray-200 bg-white hover:border-navy-300'
                  }`}
                >
                  {selectedPlan === plan.name && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow">✓</div>
                  )}
                  <p className={`font-bold text-sm mb-1 ${selectedPlan === plan.name ? 'text-white' : 'text-gray-900'}`}>{plan.name}</p>
                  <p className={`text-lg font-bold ${selectedPlan === plan.name ? 'text-white' : 'text-navy-600'}`}>{plan.priceLabel}</p>
                  {plan.badge && (
                    <p className={`text-xs mt-1 ${selectedPlan === plan.name ? 'text-amber-300' : 'text-amber-600'}`}>{plan.badge}</p>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              ⓘ Setelah mendaftar, Anda akan diarahkan ke halaman pembayaran untuk mengaktifkan langganan.
            </p>
          </div>
          )}

          {/* Terms Checkbox */}
          <div className="mb-6">
            <label className="flex items-start cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 mr-3 w-4 h-4 text-navy-600 rounded border-gray-300 focus:ring-navy-500"
              />
              <span className="text-sm text-gray-700">
                Saya menyetujui <span className="font-semibold">Syarat & Ketentuan</span> serta <span className="font-semibold">Kebijakan Privasi</span> yang berlaku di ekosistem Steller.
              </span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              ⚠️ {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            disabled={!agreed || isSubmitting}
            onClick={handleSubmit}
            className={`w-full py-4 rounded-lg font-semibold text-lg transition flex items-center justify-center ${
              agreed && !isSubmitting
                ? 'bg-navy-600 text-white hover:bg-navy-700 shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Menyimpan pendaftaran...' : isTrial ? '🎉 Daftar & Aktifkan Uji Coba Gratis' : `Daftar & Bayar ${selectedPlan}`}
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Tombol Kembali ke Tahap 1 */}
          <button
            type="button"
            onClick={() => { setError(''); setStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            className="w-full mt-3 py-3 bg-slate-100 text-gray-700 rounded-lg font-semibold hover:bg-slate-200 transition"
          >
            ← Kembali ke Data Pemilik
          </button>
          </>
          )}

          {/* ===== Tahap 3: Verifikasi Akun ===== */}
          {step === 3 && (
            <div className="text-center max-w-md mx-auto">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <span className="text-4xl">📩</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifikasi Akun Anda</h2>
              <p className="text-sm text-gray-600 mb-6">
                Pendaftaran <span className="font-semibold">{form.storeName}</span> berhasil disimpan!
                Kirim kode verifikasi 6 digit ke WhatsApp Anda, lalu masukkan di bawah ini.
              </p>

              <div className="mb-4">
                <button
                  onClick={() => handleSendOtp()}
                  disabled={!!otpSending}
                  className="flex items-center justify-center w-full py-3.5 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition disabled:opacity-50"
                >
                  {otpSending === 'wa' ? '⏳ Mengirim ke WhatsApp...' : `💬 Kirim OTP ke WhatsApp (${form.whatsapp})`}
                </button>
              </div>

              {otpStatus && (
                <div className={`mb-4 text-sm px-4 py-3 rounded-lg border ${
                  otpStatus.type === 'success' ? 'bg-green-50 border-green-200 text-green-700'
                  : otpStatus.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  {otpStatus.text}
                </div>
              )}

              {/* Fallback kontak admin — tombol langsung chat WA dengan pesan terisi */}
              <div className="mb-6">
                <a
                  href={`https://wa.me/6285893174442?text=${encodeURIComponent(`Halo Admin StellerPOS! Saya ${form.ownerName} dari ${form.storeName}. Mohon kirimkan kode verifikasi akun saya (${form.email} / ${form.whatsapp}). Terima kasih.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full py-3 border-2 border-green-500 text-green-600 rounded-lg font-semibold text-sm hover:bg-green-50 transition"
                >
                  💬 Minta Kode Manual via WhatsApp Admin
                </a>
                <p className="mt-2 text-xs text-gray-500">
                  Kode tidak masuk? Tekan tombol kirim ulang di atas, atau hubungi admin di{' '}
                  <span className="font-semibold text-gray-700">0858-9317-4442</span>
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Kode Verifikasi (6 digit)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyInput}
                  onChange={(e) => { setVerifyInput(e.target.value.replace(/\D/g, '')); setVerifyMsg('') }}
                  placeholder="••••••"
                  className="w-full px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition"
                />
              </div>

              {verifyMsg && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {verifyMsg}
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={isVerifying}
                className="w-full py-4 bg-navy-600 text-white rounded-lg font-semibold text-lg hover:bg-navy-700 transition shadow-lg disabled:opacity-50"
              >
                {isVerifying ? 'Memverifikasi...' : '✅ Konfirmasi Verifikasi'}
              </button>

              <button
                onClick={goNextAfterVerify}
                className="w-full mt-3 py-3 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                Lewati dulu — verifikasi nanti →
              </button>
            </div>
          )}
        </div>

        {/* Login Link */}
        <div className="text-center mt-6">
          <span className="text-gray-600">Sudah memiliki toko sebelumnya? </span>
          <Link to="/login" className="text-navy-600 font-semibold hover:text-navy-700">
            Masuk ke Sistem <span className="font-bold">Steller</span> ›
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-8">
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-5 h-5 mr-2 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Data Terenkripsi 256-bit SSL Cloud Sync
            </div>
            <a href="https://wa.me/6285893174442" target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-gray-600 hover:text-navy-700 transition">
              <svg className="w-5 h-5 mr-2 text-navy-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Bantuan CS WhatsApp: 0858-9317-4442 (24/7 Siaga)
            </a>
          </div>
          <div className="text-sm text-gray-500 text-center md:text-right">
            © 2026 <span className="font-semibold">Steller</span> POS Indonesia. Sistem Kasir Pintar & Terpercaya.
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Registration
