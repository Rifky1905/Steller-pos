import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import jsQR from 'jsqr'
import { supabase } from './supabaseClient'
import { notifySubscriptionApproved, notifyHardwareApproved, notifyHardwareShipped } from './otp'

// Steller Logo Component (versi terang untuk sidebar gelap)
const StellerLogo = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGradientAdmin" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C9A227" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
      <filter id="glowAdmin">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#glowAdmin)">
      <path d="M32 8L36 20H48L38 28L42 40L32 32L22 40L26 28L16 20H28L32 8Z" fill="url(#goldGradientAdmin)" />
    </g>
    <path d="M32 18L34 24H30L32 18Z" fill="#FFF8DC" opacity="0.8" />
    <path d="M52 10L53.8 16.2L60 18L53.8 19.8L52 26L50.2 19.8L44 18L50.2 16.2L52 10Z" fill="url(#goldGradientAdmin)" opacity="0.85" />
    <text x="64" y="41" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="#FFFFFF" letter-spacing="0.5">Steller</text>
  </svg>
)

const EXTEND_OPTIONS = [
  { label: '+7 Hari', days: 7 },
  { label: '+30 Hari', days: 30 },
  { label: '+90 Hari', days: 90 },
  { label: '+365 Hari', days: 365 },
]

const PLAN_DAYS = { '1 Bulan': 30, '3 Bulan': 90, '6 Bulan': 180, '1 Tahun': 365 }

const mapDbMerchant = (m) => ({
  id: m.id, storeName: m.store_name, owner: m.owner_name,
  email: m.email, whatsapp: m.whatsapp, plan: m.plan,
  planPrice: m.plan_price, endDate: m.end_date,
  status: m.status, paymentStatus: m.payment_status,
  paymentProof: m.payment_proof,
  paidAmount: m.paid_amount,
  isVerified: m.is_verified || false,
  verifyCode: m.verification_code || '',
})

function SuperAdmin() {
  const navigate = useNavigate()
  const adminName = sessionStorage.getItem('superAdminName') || 'Super Admin'

  // Proteksi: wajib login super admin dulu
  useEffect(() => {
    if (sessionStorage.getItem('superAdminLoggedIn') !== 'true') {
      navigate('/super-admin-login')
    }
  }, [navigate])

  const handleLogout = () => {
    sessionStorage.removeItem('superAdminLoggedIn')
    sessionStorage.removeItem('superAdminName')
    navigate('/')
  }

  const [merchants, setMerchants] = useState([])
  const [isLoadingMerchants, setIsLoadingMerchants] = useState(true)
  const [extendTarget, setExtendTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [orders, setOrders] = useState([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(true)

  // ===== Pengaturan Pembayaran Platform =====
  const [activeSection, setActiveSection] = useState('dashboard')
  const [paySettings, setPaySettings] = useState({ transfer: true, qris: true, ewallet: false, qrisImage: '' })
  const [isSavingPay, setIsSavingPay] = useState(false)
  const [paySaveMsg, setPaySaveMsg] = useState('')
  const [isUploadingQr, setIsUploadingQr] = useState(false)

  // Muat pengaturan pembayaran dari Supabase (fallback localStorage)
  useEffect(() => {
    const loadPaySettings = async () => {
      try {
        const { data } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'payment')
          .maybeSingle()
        if (data?.value) {
          setPaySettings(prev => ({ ...prev, ...data.value }))
          localStorage.setItem('platformPaymentSettings', JSON.stringify(data.value))
          return
        }
      } catch { /* tabel belum ada → fallback lokal */ }
      try {
        const local = JSON.parse(localStorage.getItem('platformPaymentSettings'))
        if (local) setPaySettings(prev => ({ ...prev, ...local }))
      } catch { /* ignore */ }
    }
    loadPaySettings()
  }, [])

  // Decode gambar QR → ambil payload EMV mentah (untuk QRIS dinamis ber-nominal)
  const decodeQrPayload = (file) => new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const decoded = jsQR(data, width, height)
      URL.revokeObjectURL(img.src)
      resolve(decoded?.data || null)
    }
    img.onerror = () => resolve(null)
    img.src = URL.createObjectURL(file)
  })

  const handleQrUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingQr(true)
    setPaySaveMsg('')

    // Otomatis ekstrak payload EMV dari gambar QRIS → QR dinamis aktif di semua halaman bayar
    const payload = await decodeQrPayload(file)
    const isQrisPayload = payload && payload.startsWith('000201')

    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `qris-payment.${ext}`
    const { error } = await supabase.storage
      .from('platform-assets')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (!error) {
      const { data } = supabase.storage.from('platform-assets').getPublicUrl(path)
      setPaySettings(prev => ({
        ...prev,
        qrisImage: `${data.publicUrl}?t=${Date.now()}`,
        ...(isQrisPayload ? { qrisPayload: payload } : {}),
      }))
      setPaySaveMsg(isQrisPayload
        ? '✅ QRIS terupload & payload terbaca otomatis — QR dinamis ber-nominal AKTIF. Klik "Simpan Pengaturan" untuk menerapkan'
        : '⚠️ QRIS terupload tapi payload tidak terbaca — QR akan tampil statis. Coba gambar QR lebih tajam, atau tempel payload manual di kolom bawah')
    } else {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPaySettings(prev => ({
          ...prev,
          qrisImage: reader.result,
          ...(isQrisPayload ? { qrisPayload: payload } : {}),
        }))
        setPaySaveMsg('⚠️ Bucket Supabase belum ada — QRIS disimpan sementara secara lokal. Jalankan blok SQL platform_settings di schema.sql')
      }
      reader.readAsDataURL(file)
    }
    setIsUploadingQr(false)
  }

  const savePaySettings = async () => {
    setIsSavingPay(true)
    setPaySaveMsg('')
    localStorage.setItem('platformPaymentSettings', JSON.stringify(paySettings))
    const { error } = await supabase
      .from('platform_settings')
      .upsert({ key: 'payment', value: paySettings, updated_at: new Date().toISOString() })
    setPaySaveMsg(error
      ? '⚠️ Tersimpan lokal saja — tabel platform_settings belum ada. Jalankan blok SQL baru di schema.sql'
      : '✅ Pengaturan pembayaran tersimpan — langsung dipakai di halaman pembayaran member')
    setIsSavingPay(false)
    setTimeout(() => setPaySaveMsg(''), 5000)
  }

  // Ambil merchant asli dari Supabase (fallback daftar demo lokal)
  useEffect(() => {
    const fetchMerchants = async () => {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error && data) setMerchants(data.map(mapDbMerchant))
      setIsLoadingMerchants(false)
    }
    fetchMerchants()

    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('hardware_orders')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error && data) setOrders(data)
      setIsLoadingOrders(false)
    }
    fetchOrders()
  }, [])

  const isExpired = (m) => m.endDate && new Date(m.endDate) < new Date()
  const displayStatus = (m) => {
    if (m.status === 'inactive') return 'nonaktif'
    if (m.paymentStatus === 'pending_confirmation') return 'menunggu'
    if (m.status === 'pending' || m.paymentStatus === 'unpaid') return 'pending'
    if (isExpired(m)) return 'expired'
    return 'aktif'
  }
  const daysLeft = (m) => m.endDate ? Math.ceil((new Date(m.endDate) - new Date()) / 86400000) : null

  // Semua data merchant murni dari Supabase — tidak ada fallback dummy
  const persist = (list) => setMerchants(list)

  const toggleStatus = async (m) => {
    const next = m.status === 'inactive' ? 'active' : 'inactive'
    await supabase.from('merchants').update({ status: next }).eq('id', m.id)
    persist(merchants.map(x => x.id === m.id ? { ...x, status: next } : x))
  }

  const approveMerchant = async (m) => {
    const days = PLAN_DAYS[m.plan] || 30
    const now = new Date()
    // Perpanjangan: tambahkan dari sisa masa aktif; aktivasi baru: dari sekarang
    const base = m.endDate && new Date(m.endDate) > now ? new Date(m.endDate) : now
    const end = new Date(base)
    end.setDate(end.getDate() + days)
    const update = { status: 'active', payment_status: 'paid', end_date: end.toISOString(), last_reminder_days: null }
    if (!m.endDate || new Date(m.endDate) < now) update.start_date = now.toISOString()
    await supabase.from('merchants').update(update).eq('id', m.id)
    persist(merchants.map(x => x.id === m.id
      ? { ...x, status: 'active', paymentStatus: 'paid', endDate: end.toISOString() }
      : x
    ))
    // Notifikasi WA ke owner: pembayaran terverifikasi & akun aktif
    notifySubscriptionApproved(m.whatsapp, m.storeName, m.plan, end.toLocaleDateString('id-ID'))
  }

  // ===== Pesanan Hardware Bundle =====
  const HW_PLAN = { '1 Bulan': { plan: '1 Bulan', days: 30 }, '3 Bulan': { plan: '3 Bulan', days: 90 } }
  const hwPlanOf = (o) => o.package_name?.includes('3 Bulan') ? HW_PLAN['3 Bulan'] : HW_PLAN['1 Bulan']

  const approveOrder = async (o) => {
    const hp = hwPlanOf(o)
    // 1) Update status pesanan → Diproses (estimasi kirim 5–10 hari)
    await supabase.from('hardware_orders')
      .update({ status: 'diproses', updated_at: new Date().toISOString() })
      .eq('id', o.id)
    setOrders(orders.map(x => x.id === o.id ? { ...x, status: 'diproses' } : x))

    // 2) Aktifkan/perpanjang langganan merchant yang tertaut
    const m = merchants.find(x => x.id === o.merchant_id)
    if (m) {
      const now = new Date()
      const base = m.endDate && new Date(m.endDate) > now ? new Date(m.endDate) : now
      const end = new Date(base)
      end.setDate(end.getDate() + hp.days)
      const update = {
        status: 'active', payment_status: 'paid',
        plan: hp.plan, plan_price: o.package_price,
        paid_amount: o.paid_amount, end_date: end.toISOString(),
        last_reminder_days: null,
      }
      if (!m.endDate || new Date(m.endDate) < now) update.start_date = now.toISOString()
      await supabase.from('merchants').update(update).eq('id', m.id)
      persist(merchants.map(x => x.id === m.id
        ? { ...x, status: 'active', paymentStatus: 'paid', plan: hp.plan, planPrice: o.package_price, endDate: end.toISOString() }
        : x
      ))
      alert(`✅ Pesanan disetujui & diproses.\nLangganan ${hp.plan} toko "${m.storeName}" aktif s/d ${end.toLocaleDateString('id-ID')}.`)
    } else {
      alert('✅ Pesanan disetujui & diproses.\n⚠️ Nomor WA tidak cocok dengan merchant manapun — langganan tidak diaktifkan otomatis.')
    }
    // Notifikasi WA ke pemesan: pembayaran terverifikasi & pesanan diproses
    notifyHardwareApproved(o.whatsapp, o.customer_name, o.package_name, o.color, !!m)
  }

  const markOrderShipped = async (o) => {
    await supabase.from('hardware_orders')
      .update({ status: 'dikirim', updated_at: new Date().toISOString() })
      .eq('id', o.id)
    setOrders(orders.map(x => x.id === o.id ? { ...x, status: 'dikirim' } : x))
    // Notifikasi WA ke pemesan: pesanan sudah dikirim
    notifyHardwareShipped(o.whatsapp, o.customer_name, o.package_name)
  }

  const extendSubscription = async (days) => {
    const m = extendTarget
    const base = (!m.endDate || isExpired(m)) ? new Date() : new Date(m.endDate)
    const next = new Date(base)
    next.setDate(next.getDate() + days)
    await supabase.from('merchants').update({
      end_date: next.toISOString(), status: 'active', payment_status: 'paid',
      last_reminder_days: null,
    }).eq('id', m.id)
    persist(merchants.map(x => x.id === m.id
      ? { ...x, endDate: next.toISOString(), status: 'active', paymentStatus: 'paid' }
      : x
    ))
    setExtendTarget(null)
  }

  const confirmDelete = async () => {
    const m = deleteTarget
    if (!m) return
    // Hapus file bukti bayar di storage (best-effort) lalu hapus row merchant
    if (m.paymentProof && m.paymentProof.includes('/platform-assets/')) {
      const path = m.paymentProof.split('/platform-assets/')[1]?.split('?')[0]
      if (path) await supabase.storage.from('platform-assets').remove([path])
    }
    await supabase.from('merchants').delete().eq('id', m.id)
    persist(merchants.filter(x => x.id !== m.id))
    setDeleteTarget(null)
  }

  const stats = useMemo(() => ({
    revenue: merchants.reduce((a, m) => a + (m.paymentStatus === 'paid' ? m.planPrice : 0), 0),
    active: merchants.filter(m => displayStatus(m) === 'aktif').length,
    expired: merchants.filter(m => displayStatus(m) === 'expired').length,
    inactive: merchants.filter(m => displayStatus(m) === 'nonaktif').length,
    pending: merchants.filter(m => ['pending', 'menunggu'].includes(displayStatus(m))).length,
  }), [merchants])

  const filteredMerchants = merchants.filter(m => {
    const q = search.toLowerCase()
    const matchSearch = !q || m.storeName.toLowerCase().includes(q) || m.owner.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || displayStatus(m) === statusFilter
    return matchSearch && matchStatus
  })

  const statusBadge = {
    aktif: 'bg-green-100 text-green-700 border border-green-200',
    pending: 'bg-amber-100 text-amber-700 border border-amber-200',
    menunggu: 'bg-blue-100 text-blue-700 border border-blue-200',
    expired: 'bg-red-100 text-red-700 border border-red-200',
    nonaktif: 'bg-slate-200 text-slate-600 border border-slate-300',
  }
  const statusLabel = {
    aktif: '● Aktif',
    pending: '● Belum Bayar',
    menunggu: '● Menunggu Konfirmasi',
    expired: '● Expired',
    nonaktif: '● Nonaktif',
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar - gelap untuk membedakan dari admin toko */}
      <aside className="w-64 bg-slate-900 fixed left-0 top-0 bottom-0 z-40 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <StellerLogo className="w-32 h-10" />
          <p className="text-xs text-amber-400 mt-2 font-semibold tracking-widest">PLATFORM ADMIN</p>
        </div>

        <nav className="p-4 space-y-2 flex-1">
          <button
            onClick={() => setActiveSection('dashboard')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg w-full text-left transition ${
              activeSection === 'dashboard' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <span className="text-xl">👑</span>
            <span className="font-medium">Dashboard Platform</span>
          </button>
          <button
            onClick={() => setActiveSection('payment')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg w-full text-left transition ${
              activeSection === 'payment' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <span className="text-xl">💳</span>
            <span className="font-medium">Pengaturan Pembayaran</span>
          </button>
          <button
            onClick={() => setActiveSection('orders')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg w-full text-left transition ${
              activeSection === 'orders' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <span className="text-xl">📦</span>
            <span className="font-medium">Pesanan Hardware</span>
            {orders.filter(o => o.status === 'pending_confirmation').length > 0 && (
              <span className="ml-auto bg-amber-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">
                {orders.filter(o => o.status === 'pending_confirmation').length}
              </span>
            )}
          </button>
          <div className="pt-4 px-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Ringkasan</p>
            <div className="space-y-1 text-sm text-slate-400">
              <p>Total Merchant: {merchants.length}</p>
              <p>Aktif: {stats.active} · Expired: {stats.expired}</p>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="px-4 py-2 mb-2">
            <p className="text-xs text-slate-500">Login sebagai</p>
            <p className="text-sm font-medium text-slate-300">{adminName}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-red-400 rounded-lg transition w-full"
          >
            <span className="text-xl">🚪</span>
            <span className="font-medium">Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">👑 Super Admin Dashboard</h1>
              <p className="text-sm text-gray-500">Kelola merchant & langganan platform StellerPOS</p>
            </div>
            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold border border-amber-200">
              Platform Owner
            </span>
          </div>
        </header>

        <div className="p-8">
          {activeSection === 'dashboard' && (
          <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">Total Pendapatan Langganan</p>
                <span className="text-2xl">💰</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">Rp {stats.revenue.toLocaleString('id-ID')}</p>
              <p className="text-sm text-gray-400 mt-2">dari {merchants.length} merchant terdaftar</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">Toko Aktif</p>
                <span className="text-2xl">🏪</span>
              </div>
              <p className="text-3xl font-bold text-green-600">{stats.active}</p>
              <p className="text-sm text-gray-400 mt-2">{stats.pending} menunggu bayar · {stats.inactive} nonaktif</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">Langganan Expired</p>
                <span className="text-2xl">⚠️</span>
              </div>
              <p className="text-3xl font-bold text-red-600">{stats.expired}</p>
              <p className="text-sm text-gray-400 mt-2">perlu perpanjangan / penagihan</p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-col md:flex-row gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama toko, pemilik, atau email..."
              className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
            <div className="flex gap-2">
              {[
                { key: 'all', label: 'Semua' },
                { key: 'aktif', label: 'Aktif' },
                { key: 'pending', label: 'Belum Bayar' },
                { key: 'menunggu', label: 'Menunggu Konfirmasi' },
                { key: 'expired', label: 'Expired' },
                { key: 'nonaktif', label: 'Nonaktif' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    statusFilter === f.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Merchant Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 pb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Daftar Member / Merchant</h2>
              <span className="text-sm text-gray-500">{filteredMerchants.length} merchant</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Toko & Pemilik</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Kontak</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Paket</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Berakhir</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingMerchants ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-gray-400">Memuat data merchant...</td>
                    </tr>
                  ) : filteredMerchants.length > 0 ? (
                    filteredMerchants.map((m) => {
                      const st = displayStatus(m)
                      const left = daysLeft(m)
                      return (
                        <tr key={m.id} className="border-t border-slate-200 hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900">{m.storeName}</p>
                            <p className="text-sm text-gray-500">{m.owner}</p>
                            {m.isVerified ? (
                              <p className="text-xs text-green-600 font-medium mt-1">✅ Terverifikasi</p>
                            ) : (
                              <p className="text-xs text-amber-600 font-medium mt-1">
                                ⏳ Belum verifikasi{m.verifyCode ? ` — kode: ${m.verifyCode}` : ''}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-900">{m.email}</p>
                            <p className="text-sm text-gray-500">WA: {m.whatsapp}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-navy-100 text-navy-700 rounded-full text-sm font-medium">{m.plan}</span>
                            <p className="text-xs text-gray-400 mt-1">Rp {m.planPrice.toLocaleString('id-ID')}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadge[st]}`}>
                              {statusLabel[st]}
                            </span>
                            {m.paymentProof && m.paymentStatus === 'pending_confirmation' && (
                              <a href={m.paymentProof} target="_blank" rel="noreferrer" className="block mt-2">
                                <img
                                  src={m.paymentProof}
                                  alt="Bukti transfer"
                                  className="w-14 h-14 object-cover rounded border border-slate-200 hover:border-navy-500 transition"
                                />
                                <span className="text-xs text-blue-600 hover:underline">📎 Lihat bukti</span>
                              </a>
                            )}
                            {m.paymentStatus === 'pending_confirmation' && m.paidAmount != null && (
                              <div className="mt-2 text-xs rounded-lg px-2 py-1.5 bg-slate-50 border border-slate-200 space-y-0.5">
                                <p className="text-gray-500">Tagihan: <span className="font-semibold text-gray-800">Rp {(m.planPrice || 0).toLocaleString('id-ID')}</span></p>
                                <p className="text-gray-500">Dibayar: <span className="font-semibold text-gray-800">Rp {m.paidAmount.toLocaleString('id-ID')}</span></p>
                                {m.paidAmount !== m.planPrice && (
                                  <p className={m.paidAmount < m.planPrice ? 'text-red-600 font-semibold' : 'text-amber-600 font-semibold'}>
                                    {m.paidAmount < m.planPrice
                                      ? `⚠️ Kurang Rp ${(m.planPrice - m.paidAmount).toLocaleString('id-ID')}`
                                      : `⚠️ Lebih Rp ${(m.paidAmount - m.planPrice).toLocaleString('id-ID')}`}
                                  </p>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {m.endDate ? (
                              <>
                                <p className="text-sm font-medium text-gray-900">
                                  {new Date(m.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                                <p className={`text-xs ${left < 0 ? 'text-red-600' : left <= 14 ? 'text-amber-600' : 'text-gray-400'}`}>
                                  {left < 0 ? `lewat ${Math.abs(left)} hari` : `${left} hari lagi`}
                                </p>
                              </>
                            ) : (
                              <p className="text-sm text-gray-400">— belum aktif</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              {(st === 'pending' || st === 'menunggu') && (
                                <button
                                  onClick={() => approveMerchant(m)}
                                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                                  title="Setujui pembayaran & aktifkan langganan"
                                >
                                  ✓ Setujui
                                </button>
                              )}
                              <button
                                onClick={() => setExtendTarget(m)}
                                className="px-3 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition text-sm font-medium"
                                title="Perpanjang masa aktif"
                              >
                                + Perpanjang
                              </button>
                              <button
                                onClick={() => toggleStatus(m)}
                                className={`px-3 py-2 rounded-lg transition text-sm font-medium ${
                                  m.status === 'inactive'
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                                }`}
                                title={m.status === 'inactive' ? 'Aktifkan kembali' : 'Nonaktifkan akun'}
                              >
                                {m.status === 'inactive' ? 'Aktifkan' : 'Nonaktifkan'}
                              </button>
                              <button
                                onClick={() => setDeleteTarget(m)}
                                className="px-3 py-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-red-600 hover:text-white transition text-sm font-medium"
                                title="Hapus toko dari platform"
                              >
                                🗑 Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                        Tidak ada merchant yang cocok dengan filter
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </>
          )}

          {/* ===== Pengaturan Metode Pembayaran & QRIS ===== */}
          {activeSection === 'payment' && (
            <div className="space-y-6 max-w-3xl">
              {/* Toggle metode pembayaran */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-1">💳 Metode Pembayaran Aktif</h2>
                <p className="text-sm text-gray-500 mb-5">
                  Metode yang aktif akan tampil di halaman pembayaran langganan member (owner toko).
                </p>
                <div className="space-y-3">
                  {[
                    { key: 'transfer', icon: '🏦', label: 'Transfer Bank', desc: 'Virtual Account BCA / Mandiri / BNI' },
                    { key: 'qris', icon: '📱', label: 'QRIS', desc: 'Scan kode QR semua e-wallet & m-banking' },
                    { key: 'ewallet', icon: '👛', label: 'e-Wallet', desc: 'GoPay / OVO / DANA' },
                  ].map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setPaySettings(prev => ({ ...prev, [m.key]: !prev[m.key] }))}
                      className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition ${
                        paySettings[m.key]
                          ? 'bg-slate-50 border-transparent hover:border-amber-300'
                          : 'bg-slate-50 border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center space-x-3 text-left">
                        <span className="text-2xl">{m.icon}</span>
                        <div>
                          <h3 className="font-bold text-gray-900">{m.label}</h3>
                          <p className="text-sm text-gray-500">{m.desc}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        paySettings[m.key] ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {paySettings[m.key] ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload QRIS */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-1">📱 QRIS Pembayaran Langganan</h2>
                <p className="text-sm text-gray-500 mb-5">
                  Gambar QRIS milik platform — tersimpan ke Supabase Storage dan ditampilkan saat member memilih pembayaran QRIS.
                </p>
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kode QRIS (payload) — opsional, untuk nominal otomatis
                  </label>
                  <textarea
                    value={paySettings.qrisPayload || ''}
                    onChange={(e) => setPaySettings(prev => ({ ...prev, qrisPayload: e.target.value.trim() }))}
                    rows="3"
                    placeholder="00020101021126570011ID.CO..."
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-xs"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Terisi <span className="font-semibold text-gray-600">otomatis saat Anda upload gambar QRIS</span> di atas (sistem membaca kode QR-nya). Jika kosong, tempel manual string yang diawali <span className="font-mono">000201</span>.
                    Selama terisi, sistem menggenerate ulang QRIS dengan <span className="font-semibold text-gray-600">nominal tagihan otomatis tertanam</span> di semua halaman pembayaran — member cukup scan, tidak perlu ketik nominal.
                  </p>
                  {paySettings.qrisPayload && (
                    <p className="text-xs text-green-600 font-semibold mt-1">✅ Payload terdeteksi — QRIS dinamis aktif.</p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <label className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-amber-500 transition cursor-pointer block">
                    <input type="file" accept="image/*" onChange={handleQrUpload} className="hidden" />
                    {isUploadingQr ? (
                      <p className="text-sm text-gray-500">Mengupload ke Supabase Storage...</p>
                    ) : paySettings.qrisImage ? (
                      <img src={paySettings.qrisImage} alt="QRIS" className="w-40 h-40 mx-auto object-contain" />
                    ) : (
                      <div>
                        <span className="text-4xl">📷</span>
                        <p className="text-sm text-gray-500 mt-2">Klik untuk upload gambar QRIS</p>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-3">Format: PNG, JPG (maks 2MB)</p>
                  </label>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Preview di halaman member:</p>
                    <div className="border border-slate-200 rounded-lg p-4 text-center bg-slate-50 min-h-[180px] flex flex-col items-center justify-center">
                      {paySettings.qrisImage ? (
                        <>
                          <img src={paySettings.qrisImage} alt="QRIS Preview" className="w-36 h-36 object-contain" />
                          <p className="text-xs text-gray-400 mt-2">QRIS · Steller POS Indonesia</p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">Belum ada QRIS — member akan melihat placeholder</p>
                      )}
                    </div>
                    {paySettings.qrisImage && (
                      <button
                        onClick={() => setPaySettings(prev => ({ ...prev, qrisImage: '' }))}
                        className="w-full mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm font-medium"
                      >
                        Hapus QRIS
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Simpan */}
              <div className="flex items-center gap-4">
                <button
                  onClick={savePaySettings}
                  disabled={isSavingPay}
                  className="px-8 py-3 bg-amber-500 text-slate-900 font-bold rounded-lg hover:bg-amber-400 transition disabled:opacity-50 shadow-lg shadow-amber-500/20"
                >
                  {isSavingPay ? 'Menyimpan...' : '💾 Simpan Pengaturan'}
                </button>
                {paySaveMsg && <p className="text-sm text-gray-600">{paySaveMsg}</p>}
              </div>
            </div>
          )}

          {/* ===== Pesanan Hardware Bundle ===== */}
          {activeSection === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">📦 Pesanan Hardware Bundle</h2>
                  <p className="text-sm text-gray-500 mt-1">Setujui setelah dana masuk — pesanan diproses (estimasi kirim 5–10 hari) & langganan pemesan otomatis aktif.</p>
                </div>
              </div>

              {isLoadingOrders ? (
                <div className="bg-white rounded-xl p-10 text-center text-gray-500 border border-slate-200">Memuat pesanan...</div>
              ) : orders.length === 0 ? (
                <div className="bg-white rounded-xl p-10 text-center text-gray-500 border border-slate-200">
                  Belum ada pesanan hardware masuk.
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map(o => (
                    <div key={o.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <p className="font-bold text-gray-900 text-lg">{o.customer_name}</p>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                              o.status === 'pending_confirmation' ? 'bg-amber-100 text-amber-700 border-amber-200'
                              : o.status === 'diproses' ? 'bg-blue-100 text-blue-700 border-blue-200'
                              : 'bg-green-100 text-green-700 border-green-200'
                            }`}>
                              {o.status === 'pending_confirmation' ? '● Menunggu Verifikasi'
                               : o.status === 'diproses' ? '● Diproses — estimasi kirim 5–10 hari'
                               : '● Dikirim'}
                            </span>
                            {!o.merchant_id && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200" title="Nomor WA tidak cocok dengan akun merchant — langganan tidak otomatis aktif">
                                ⚠️ Non-member
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            📱 {o.whatsapp} {o.email ? `· ✉️ ${o.email}` : ''} · Order #{o.id} · {new Date(o.created_at).toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {o.status === 'pending_confirmation' && (
                            <button
                              onClick={() => approveOrder(o)}
                              className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition text-sm shadow"
                            >
                              ✓ Setujui & Proses
                            </button>
                          )}
                          {o.status === 'diproses' && (
                            <button
                              onClick={() => markOrderShipped(o)}
                              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition text-sm"
                            >
                              🚚 Tandai Dikirim
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 text-sm">
                        <div>
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Paket & Warna</p>
                          <p className="font-semibold text-gray-900">{o.package_name}</p>
                          <p className="text-navy-700 font-bold">Rp {(o.package_price || 0).toLocaleString('id-ID')}</p>
                          <p className="text-gray-600 mt-1">Warna: <span className="font-semibold">{o.color}</span></p>
                          {o.paid_amount != null && (
                            <p className="text-gray-600">Dibayar: <span className="font-semibold">Rp {Number(o.paid_amount).toLocaleString('id-ID')}</span></p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Alamat Pengiriman</p>
                          <p className="text-gray-900 font-medium">{o.recipient_name}</p>
                          <p className="text-gray-600 whitespace-pre-line">{o.shipping_address}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Bukti Transfer</p>
                          {o.status === 'pending_confirmation' && o.payment_proof ? (
                            <a href={o.payment_proof} target="_blank" rel="noopener noreferrer" className="block">
                              <img src={o.payment_proof} alt="Bukti transfer" className="w-24 h-24 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition" />
                              <p className="text-xs text-navy-600 mt-1">Klik untuk lihat penuh</p>
                            </a>
                          ) : o.payment_proof ? (
                            <a href={o.payment_proof} target="_blank" rel="noopener noreferrer" className="text-xs text-navy-600 hover:underline">📎 Lihat bukti (riwayat)</a>
                          ) : (
                            <p className="text-xs text-gray-400">Tidak ada bukti</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal Perpanjang Langganan */}
      {extendTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Perpanjang Langganan</h2>
              <button onClick={() => setExtendTarget(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <p className="font-semibold text-gray-900">{extendTarget.storeName}</p>
              <p className="text-sm text-gray-500">{extendTarget.owner} · Paket {extendTarget.plan}</p>
              <p className="text-sm text-gray-500 mt-1">
                {extendTarget.endDate
                  ? `Berakhir: ${new Date(extendTarget.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
                  : 'Belum ada masa aktif — durasi dihitung mulai hari ini'}
                {isExpired(extendTarget) && <span className="text-red-600 font-medium"> (sudah expired — dihitung dari hari ini)</span>}
              </p>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-3">Pilih durasi perpanjangan:</p>
            <div className="grid grid-cols-2 gap-3">
              {EXTEND_OPTIONS.map(opt => (
                <button
                  key={opt.days}
                  onClick={() => extendSubscription(opt.days)}
                  className="px-4 py-4 border-2 border-slate-200 rounded-lg font-bold text-gray-700 hover:border-navy-500 hover:bg-navy-50 hover:text-navy-700 transition"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setExtendTarget(null)}
              className="w-full mt-4 px-4 py-3 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition font-medium"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Toko */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🗑️</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Hapus Toko Ini?</h2>
            <p className="text-sm text-gray-600 text-center mb-2">
              <span className="font-semibold">{deleteTarget.storeName}</span> ({deleteTarget.owner})
            </p>
            <p className="text-xs text-red-600 text-center mb-6">
              Akun merchant, data langganan, dan bukti pembayaran akan dihapus permanen dari database. Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-3 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition font-medium"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-bold"
              >
                🗑 Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperAdmin
