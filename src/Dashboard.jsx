import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from './supabaseClient'
import { buildDynamicQris, DEFAULT_PLATFORM_QRIS_PAYLOAD } from './qris'
import { sendOtpWhatsApp, notifyAdminPayment, notifySubscriptionReminder } from './otp'

// Steller Logo Component
const StellerLogo = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGradientDashboard" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C9A227" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
      <linearGradient id="blueGradientDashboard" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E3A8A" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <filter id="glowDashboard">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#glowDashboard)">
      <path d="M32 8L36 20H48L38 28L42 40L32 32L22 40L26 28L16 20H28L32 8Z" fill="url(#goldGradientDashboard)" />
    </g>
    <path d="M32 18L34 24H30L32 18Z" fill="#FFF8DC" opacity="0.8" />
    <path d="M52 10L53.8 16.2L60 18L53.8 19.8L52 26L50.2 19.8L44 18L50.2 16.2L52 10Z" fill="url(#goldGradientDashboard)" opacity="0.85" />
    <text x="64" y="41" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="url(#blueGradientDashboard)" letter-spacing="0.5">Steller</text>
  </svg>
)

function Dashboard() {
  const navigate = useNavigate()

  // Data merchant yang login (fallback ke akun demo)
  const merchant = (() => {
    try { return JSON.parse(sessionStorage.getItem('merchantSession')) } catch { return null }
  })()
  const ownerName = merchant?.ownerName || 'Rifky Arya Firdaus'
  const storeName = merchant?.storeName || 'Toko Sinar Rejeki'
  const merchantId = merchant?.id || null
  // Foto profil owner — dari sesi atau localStorage per-merchant
  const ownerAvatar = merchant?.avatar
    || (merchantId ? localStorage.getItem(`ownerAvatar_${merchantId}`) : '')
    || ''
  const scope = (q) => merchantId ? q.eq('merchant_id', merchantId) : q.is('merchant_id', null)

  const handleMenuClick = (path) => {
    if (path === '/pos') {
      sessionStorage.setItem('cashierLoggedIn', 'true')
      sessionStorage.setItem('cashierName', ownerName)
      sessionStorage.setItem('cashierOutlet', storeName)
      sessionStorage.setItem('cashierRole', 'Owner')
    }
    navigate(path)
  }

  const [activeTab, setActiveTab] = useState('week')
  const [isOnline, setIsOnline] = useState(true)
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpMsg, setOtpMsg] = useState('')
  const [otpInput, setOtpInput] = useState('')
  const [verifiedNow, setVerifiedNow] = useState(false)

  // Kirim OTP verifikasi akun ke WA owner via gateway
  const handleSendVerifyOtp = async () => {
    if (!merchant?.verifyCode || otpSending) return
    setOtpSending(true)
    setOtpMsg('')
    const res = await sendOtpWhatsApp(merchant.whatsapp, merchant.verifyCode, merchant.storeName)
    setOtpSending(false)
    setOtpMsg(res.ok ? `✅ Kode verifikasi terkirim ke WhatsApp ${merchant.whatsapp}` : `❌ Gagal mengirim: ${res.error}`)
  }

  const handleSubmitVerifyOtp = async () => {
    if (otpInput.trim().length !== 6) { setOtpMsg('Masukkan kode 6 digit.'); return }
    if (otpInput.trim() !== merchant?.verifyCode) { setOtpMsg('⚠️ Kode verifikasi salah.'); return }
    await supabase.from('merchants')
      .update({ is_verified: true, verified_at: new Date().toISOString() })
      .eq('id', merchant.id)
    sessionStorage.setItem('merchantSession', JSON.stringify({ ...merchant, isVerified: true }))
    setVerifiedNow(true)
    setOtpMsg('')
  }
  const [selectedPlan, setSelectedPlan] = useState('1 Tahun')
  const [renewStep, setRenewStep] = useState('plan')
  const [payMethod, setPayMethod] = useState('qris')
  const [platformPay, setPlatformPay] = useState({ transfer: true, qris: true, ewallet: false, qrisImage: '' })
  const [dynamicQrisUrl, setDynamicQrisUrl] = useState('')
  const [staticQrisUrl, setStaticQrisUrl] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [payError, setPayError] = useState('')
  const [proofUrl, setProofUrl] = useState('')
  const [proofPreview, setProofPreview] = useState('')
  const [proofUploading, setProofUploading] = useState(false)
  const [isSubmittingPay, setIsSubmittingPay] = useState(false)

  // Subscription info — dari data merchant jika login, fallback demo
  const PLAN_PRICES = { '1 Bulan': 'Rp 100.000', '3 Bulan': 'Rp 280.000', '6 Bulan': 'Rp 550.000', '1 Tahun': 'Rp 1.000.000' }
  const subscription = (() => {
    if (merchant?.endDate) {
      const end = new Date(merchant.endDate)
      const days = Math.max(0, Math.ceil((end - new Date()) / 86400000))
      return {
        plan: merchant.plan,
        price: PLAN_PRICES[merchant.plan] || '-',
        startDate: merchant.startDate || end.toISOString(),
        endDate: merchant.endDate,
        daysRemaining: days,
      }
    }
    return {
      plan: '1 Tahun',
      price: 'Rp 1.000.000',
      startDate: '2024-01-01',
      endDate: '2025-01-01',
      daysRemaining: 345,
    }
  })()

  const plans = [
    { name: '1 Bulan', price: 'Rp 100.000', priceValue: 100000, discount: null },
    { name: '3 Bulan', price: 'Rp 280.000', priceValue: 280000, discount: 'Hemat Rp 20.000' },
    { name: '6 Bulan', price: 'Rp 550.000', priceValue: 550000, discount: 'Hemat Rp 50.000' },
    { name: '1 Tahun', price: 'Rp 1.000.000', priceValue: 1000000, discount: 'Hemat Rp 200.000 (Paling Hemat)' },
  ]

  const selectedPlanData = plans.find(p => p.name === selectedPlan)

  // Metode pembayaran langganan difilter sesuai pengaturan platform (Super Admin)
  const paymentMethods = [
    ...(platformPay.qris ? [{ id: 'qris', label: 'QRIS', desc: 'Scan semua e-wallet & m-banking', icon: '📱' }] : []),
    ...(platformPay.transfer ? [
      { id: 'bca', label: 'Transfer BCA', desc: 'Virtual Account BCA', icon: '🏦' },
      { id: 'mandiri', label: 'Transfer Mandiri', desc: 'Virtual Account Mandiri', icon: '🏦' },
      { id: 'bni', label: 'Transfer BNI', desc: 'Virtual Account BNI', icon: '🏦' },
    ] : []),
    ...(platformPay.ewallet ? [{ id: 'ewallet', label: 'e-Wallet', desc: 'GoPay / OVO / DANA', icon: '👛' }] : []),
  ]
  const activePayMethod = paymentMethods.some(m => m.id === payMethod) ? payMethod : paymentMethods[0]?.id || 'qris'

  // QRIS dinamis: nominal paket terpilih tertanam — fallback ke QRIS resmi platform
  useEffect(() => {
    const payload = platformPay.qrisPayload || DEFAULT_PLATFORM_QRIS_PAYLOAD
    QRCode.toDataURL(payload, { width: 300, margin: 1 }).then(setStaticQrisUrl).catch(() => setStaticQrisUrl(''))
    const dyn = buildDynamicQris(payload, selectedPlanData?.priceValue || 0)
    if (!dyn) { setDynamicQrisUrl(''); return }
    QRCode.toDataURL(dyn, { width: 512, margin: 2 })
      .then(setDynamicQrisUrl)
      .catch(() => setDynamicQrisUrl(''))
  }, [platformPay.qrisPayload, selectedPlanData?.priceValue])
  const qrisDisplayUrl = dynamicQrisUrl || platformPay.qrisImage

  // Nominal dibayar otomatis mengikuti paket yang dipilih
  useEffect(() => {
    if (selectedPlanData?.priceValue) setPaidAmount(String(selectedPlanData.priceValue))
  }, [selectedPlan])

  const closeRenewModal = () => {
    setShowRenewModal(false)
    setRenewStep('plan')
    setPayMethod('qris')
    setPayError('')
    setProofUrl('')
    setProofPreview('')
  }

  // Upload bukti transfer ke storage platform-assets (fallback: data URL)
  const handleProofUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setPayError('File bukti harus berupa gambar!'); return }
    setPayError('')
    setProofUploading(true)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `proofs/merchant-${merchantId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('platform-assets')
      .upload(path, file, { contentType: file.type })
    if (!error) {
      const { data } = supabase.storage.from('platform-assets').getPublicUrl(path)
      setProofUrl(data.publicUrl)
      setProofPreview(data.publicUrl)
    } else {
      const reader = new FileReader()
      reader.onloadend = () => { setProofPreview(reader.result); setProofUrl(reader.result) }
      reader.readAsDataURL(file)
    }
    setProofUploading(false)
    e.target.value = ''
  }

  const handleRenewPaid = async () => {
    const paid = parseInt(paidAmount) || 0
    const expected = selectedPlanData?.priceValue || 0
    if (!paid) { setPayError('Isi nominal pembayaran yang Anda transfer.'); return }
    if (paid < expected) {
      setPayError(`Nominal kurang Rp ${(expected - paid).toLocaleString('id-ID')} — tagihan paket ${selectedPlan} adalah ${selectedPlanData?.price}.`)
      return
    }
    if (!proofUrl) {
      setPayError('Upload bukti transfer terlebih dahulu — wajib untuk setiap pembayaran langganan.')
      return
    }
    if (!merchantId) {
      alert('Mode demo — pembayaran tidak disimpan.')
      closeRenewModal()
      return
    }
    setIsSubmittingPay(true)
    const { error } = await supabase.from('merchants').update({
      payment_status: 'pending_confirmation',
      payment_proof: proofUrl,
      plan: selectedPlan,
      plan_price: expected,
      paid_amount: paid,
    }).eq('id', merchantId)
    setIsSubmittingPay(false)
    if (error) {
      setPayError('Gagal mengirim konfirmasi: ' + error.message)
      return
    }
    alert(`Konfirmasi pembayaran ${selectedPlanData?.price} (${selectedPlan}) terkirim!\nMenunggu verifikasi Super Admin — langganan otomatis diperpanjang setelah disetujui.`)
    // Notifikasi WA ke admin — fire-and-forget
    notifyAdminPayment({
      type: 'Perpanjangan Langganan',
      name: `${ownerName} (${storeName})`,
      contact: merchant?.whatsapp || merchant?.email,
      detail: selectedPlan,
      amount: paid,
    })
    closeRenewModal()
  }

  const menuItems = [
    { icon: '📊', label: 'Beranda / Ringkasan', active: true, path: '/dashboard' },
    { icon: '🛒', label: 'Terminal Kasir', active: false, path: '/pos' },
    { icon: '📦', label: 'Inventaris Produk', active: false, path: '/inventory' },
    { icon: '📈', label: 'Laporan Penjualan', active: false, path: '/reports' },
    { icon: '👥', label: 'Manajemen Karyawan', active: false, path: '/employees' },
    { icon: '⚙️', label: 'Pengaturan Toko', active: false, path: '/settings' },
  ]

  const [transactions, setTransactions] = useState([])
  const [products, setProducts] = useState([])

  // Guard: merchant yang belum aktif langganannya diarahkan ke halaman pembayaran
  useEffect(() => {
    try {
      const session = JSON.parse(sessionStorage.getItem('merchantSession'))
      if (session && session.status !== 'active') {
        navigate('/subscription-payment')
        return
      }
      // Verifikasi ulang status merchant ke database (sesi bisa basi)
      if (session?.id) {
        supabase.from('merchants')
          .select('status, store_name, owner_name, email, whatsapp, plan, start_date, end_date, avatar_url, is_verified, verification_code, last_reminder_days')
          .eq('id', session.id)
          .maybeSingle()
          .then(({ data }) => {
            if (!data) return
            sessionStorage.setItem('merchantSession', JSON.stringify({
              id: session.id, email: data.email, ownerName: data.owner_name,
              storeName: data.store_name, plan: data.plan, status: data.status,
              startDate: data.start_date, endDate: data.end_date,
              avatar: data.avatar_url || '',
              isVerified: data.is_verified || false,
              whatsapp: data.whatsapp || '',
              verifyCode: data.verification_code || '',
            }))
            // Reminder WA ke owner: sisa masa aktif 10 / 3 / 1 hari — sekali per milestone
            if (data.status === 'active' && data.end_date && data.whatsapp) {
              const daysLeft = Math.ceil((new Date(data.end_date) - new Date()) / 86400000)
              const milestone = daysLeft <= 1 ? 1 : daysLeft <= 3 ? 3 : daysLeft <= 10 ? 10 : null
              const lastSent = data.last_reminder_days
              if (milestone && (lastSent == null || milestone < lastSent)) {
                notifySubscriptionReminder(
                  data.whatsapp, data.store_name, daysLeft,
                  new Date(data.end_date).toLocaleDateString('id-ID')
                )
                supabase.from('merchants')
                  .update({ last_reminder_days: milestone })
                  .eq('id', session.id)
              }
            }
            if (data.status !== 'active') navigate('/subscription-payment')
          })
      }
    } catch { /* tidak ada sesi merchant = mode demo */ }
  }, [navigate])

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: trx }, { data: prod }] = await Promise.all([
        scope(supabase
          .from('transactions')
          .select('*, transaction_items(quantity, price, product_name, products(buy_price))')
          .order('created_at', { ascending: false })),
        scope(supabase.from('products').select('id, name, stock, buy_price, sell_price')),
      ])
      setTransactions(trx || [])
      setProducts(prod || [])

      // Pengaturan pembayaran platform dari Super Admin (fallback localStorage)
      try {
        const { data: ps } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'payment')
          .maybeSingle()
        if (ps?.value) setPlatformPay(prev => ({ ...prev, ...ps.value }))
        else {
          const local = JSON.parse(localStorage.getItem('platformPaymentSettings'))
          if (local) setPlatformPay(prev => ({ ...prev, ...local }))
        }
      } catch {
        try {
          const local = JSON.parse(localStorage.getItem('platformPaymentSettings'))
          if (local) setPlatformPay(prev => ({ ...prev, ...local }))
        } catch { /* ignore */ }
      }
    }
    fetchData()
  }, [])

  const localDateKey = (d) => {
    const x = new Date(d)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  }

  const calcProfit = (trx) =>
    (trx.transaction_items || []).reduce(
      (sum, item) => sum + ((item.price - (item.products?.buy_price || 0)) * item.quantity), 0
    )

  const todayTrx = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return transactions.filter(t => new Date(t.created_at) >= start)
  }, [transactions])

  const omsetToday = todayTrx.reduce((a, t) => a + (t.total || 0), 0)
  const profitToday = todayTrx.reduce((a, t) => a + calcProfit(t), 0)
  const trxCount = todayTrx.length
  const itemsSoldToday = todayTrx.reduce((a, t) => a + (t.transaction_items || []).reduce((s, i) => s + i.quantity, 0), 0)
  const avgOrder = trxCount > 0 ? Math.round(omsetToday / trxCount) : 0

  const metrics = [
    { label: 'Omset Hari Ini', value: `Rp ${omsetToday.toLocaleString('id-ID')}`, change: `${trxCount} transaksi`, positive: true },
    { label: 'Laba Bersih', value: `Rp ${profitToday.toLocaleString('id-ID')}`, change: omsetToday > 0 ? `Margin ${((profitToday / omsetToday) * 100).toFixed(1)}%` : '-', positive: true },
    { label: 'Total Transaksi', value: `${trxCount} Transaksi`, change: `${itemsSoldToday} item terjual`, positive: true },
    { label: 'Rata-rata Keranjang', value: `Rp ${avgOrder.toLocaleString('id-ID')}`, change: 'per transaksi', positive: true },
  ]

  // Grafik tren penjualan sesuai tab aktif (data nyata dari transaksi)
  const chartData = useMemo(() => {
    const now = new Date()
    const buckets = []
    if (activeTab === 'today') {
      for (let h = 0; h < 24; h++) buckets.push({ label: `${String(h).padStart(2, '0')}`, revenue: 0, hour: h })
      todayTrx.forEach(t => { buckets[new Date(t.created_at).getHours()].revenue += t.total || 0 })
    } else if (activeTab === 'week') {
      const map = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(now.getDate() - i)
        map[localDateKey(d)] = { label: d.toLocaleDateString('id-ID', { weekday: 'short' }), revenue: 0 }
      }
      transactions.forEach(t => {
        const b = map[localDateKey(t.created_at)]
        if (b) b.revenue += t.total || 0
      })
      return Object.values(map)
    } else {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      for (let d = 1; d <= daysInMonth; d++) buckets.push({ label: String(d), revenue: 0, day: d })
      transactions.forEach(t => {
        const dt = new Date(t.created_at)
        if (dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()) {
          buckets[dt.getDate() - 1].revenue += t.total || 0
        }
      })
    }
    return buckets
  }, [activeTab, transactions, todayTrx])

  const chartMax = Math.max(...chartData.map(b => b.revenue), 1)

  // Produk terlaris 7 hari terakhir dari transaction_items
  const topProducts = useMemo(() => {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 6)
    weekStart.setHours(0, 0, 0, 0)
    const map = {}
    transactions
      .filter(t => new Date(t.created_at) >= weekStart)
      .forEach(t => (t.transaction_items || []).forEach(i => {
        const name = i.product_name || 'Produk'
        if (!map[name]) map[name] = { name, sold: 0, revenue: 0 }
        map[name].sold += i.quantity
        map[name].revenue += i.quantity * i.price
      }))
    return Object.values(map).sort((a, b) => b.sold - a.sold).slice(0, 5)
  }, [transactions])

  const stockAlerts = products.filter(p => p.stock < 10)

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 fixed left-0 top-0 bottom-0 z-40">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center">
            <StellerLogo className="w-32 h-10" />
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => handleMenuClick(item.path)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition w-full text-left ${
                item.active
                  ? 'bg-navy-600 text-white'
                  : 'text-gray-600 hover:bg-slate-100'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200">
          <button
            onClick={() => {
              sessionStorage.removeItem('merchantSession')
              sessionStorage.removeItem('cashierLoggedIn')
              sessionStorage.removeItem('cashierName')
              sessionStorage.removeItem('cashierOutlet')
              sessionStorage.removeItem('cashierRole')
              navigate('/')
            }}
            className="flex items-center space-x-3 px-4 py-3 text-gray-600 hover:bg-slate-100 rounded-lg transition w-full"
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
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Halo, {ownerName} (Owner)</h1>
                <p className="text-sm text-gray-500">🏪 {storeName} — Selamat datang kembali di dashboard Steller POS</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Online Status */}
              <div className="flex items-center space-x-2 bg-green-50 px-3 py-2 rounded-lg">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-sm font-medium text-green-700">{isOnline ? 'Online' : 'Offline'}</span>
              </div>

              {/* Profile Button */}
              <button
                onClick={() => setShowProfileModal(true)}
                className="flex items-center space-x-2 bg-navy-600 text-white px-4 py-2 rounded-lg hover:bg-navy-700 transition"
              >
                {ownerAvatar ? (
                  <img src={ownerAvatar} alt="Profil" className="w-6 h-6 rounded-full object-cover border border-white/40" />
                ) : (
                  <span className="text-lg">👤</span>
                )}
                <span className="font-medium">Profil</span>
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-8">
          {/* Subscription Info Banner */}
          <div className="bg-gradient-to-r from-navy-600 to-navy-700 rounded-xl p-6 mb-8">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="text-white mb-4 md:mb-0">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-2xl">⭐</span>
                  <h3 className="text-xl font-bold">Paket Berlangganan: {subscription.plan}</h3>
                </div>
                <p className="text-blue-50 text-sm">
                  Berlaku dari {new Date(subscription.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} sampai {new Date(subscription.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <p className="text-blue-50 text-sm mb-1">Sisa Hari</p>
                  <p className="text-3xl font-bold text-white">{subscription.daysRemaining}</p>
                </div>
                <div className="text-center">
                  <p className="text-blue-50 text-sm mb-1">Harga Paket</p>
                  <p className="text-2xl font-bold text-white">{subscription.price}</p>
                </div>
                <button
                  onClick={() => setShowRenewModal(true)}
                  className="bg-white text-navy-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition"
                >
                  Perpanjang Langganan
                </button>
              </div>
            </div>
          </div>

          {/* Executive Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {metrics.map((metric, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-500">{metric.label}</span>
                  <span className={`text-sm font-semibold ${metric.positive ? 'text-green-600' : 'text-red-600'}`}>
                    {metric.change}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
              </div>
            ))}
          </div>

          {/* Chart & Analysis Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Sales Trend Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">Tren Penjualan</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setActiveTab('today')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      activeTab === 'today'
                        ? 'bg-navy-600 text-white'
                        : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                    }`}
                  >
                    Hari Ini
                  </button>
                  <button
                    onClick={() => setActiveTab('week')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      activeTab === 'week'
                        ? 'bg-navy-600 text-white'
                        : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                    }`}
                  >
                    Minggu Ini
                  </button>
                  <button
                    onClick={() => setActiveTab('month')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      activeTab === 'month'
                        ? 'bg-navy-600 text-white'
                        : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                    }`}
                  >
                    Bulan Ini
                  </button>
                </div>
              </div>

              {/* Simple Chart Visualization */}
              <div className="h-64 flex items-end justify-between space-x-2 px-4">
                {chartData.map((bucket, index) => (
                  <div
                    key={index}
                    className="flex-1 bg-navy-200 rounded-t hover:bg-navy-600 transition cursor-pointer relative group"
                    style={{ height: `${bucket.revenue > 0 ? Math.max((bucket.revenue / chartMax) * 100, 4) : 2}%`, opacity: bucket.revenue > 0 ? 1 : 0.3 }}
                  >
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                      Rp {bucket.revenue.toLocaleString('id-ID')}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-4 text-xs text-gray-500 px-4">
                {chartData.map((bucket, index) => (
                  <span key={index} className="flex-1 text-center">{bucket.label}</span>
                ))}
              </div>
              {transactions.length === 0 && (
                <p className="text-center text-sm text-gray-400 mt-4">Belum ada transaksi — grafik akan terisi otomatis setelah checkout pertama</p>
              )}
            </div>

            {/* Top Selling Products */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Produk Terlaris Minggu Ini</h2>
              <div className="space-y-4">
                {topProducts.length > 0 ? (
                  topProducts.map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-navy-100 rounded-full flex items-center justify-center text-navy-600 font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.sold} terjual</p>
                        </div>
                      </div>
                      <span className="font-semibold text-navy-600 text-sm">Rp {product.revenue.toLocaleString('id-ID')}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 py-8 text-sm">
                    Belum ada penjualan minggu ini
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stock Alerts */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">⚠️ Peringatan Stok Menipis</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stockAlerts.length > 0 ? (
                stockAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <span className="text-2xl">📦</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{alert.name}</p>
                      <p className="text-sm text-red-600 font-semibold">Sisa {alert.stock} pcs - Segera Restock!</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center text-gray-400 py-4 text-sm">✅ Semua stok produk aman</div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Aksi Cepat</h2>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/inventory')}
                className="flex items-center space-x-2 bg-navy-600 text-white px-6 py-3 rounded-lg hover:bg-navy-700 transition font-medium"
              >
                <span>➕</span>
                <span>Tambah Produk Baru</span>
              </button>
              <button
                onClick={() => {
                  alert('Laporan akan diunduh dalam format Excel...')
                }}
                className="flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-medium"
              >
                <span>📊</span>
                <span>Unduh Laporan Excel</span>
              </button>
              <button
                onClick={() => navigate('/employees')}
                className="flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition font-medium"
              >
                <span>👥</span>
                <span>Tambah Karyawan</span>
              </button>
              <button
                onClick={() => handleMenuClick('/pos')}
                className="flex items-center space-x-2 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition font-medium"
              >
                <span>🛒</span>
                <span>Mulai Transaksi</span>
              </button>
            </div>
          </div>
        </div>

        {/* Renew Subscription Modal */}
        {showRenewModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {renewStep === 'plan' ? '⭐ Perpanjang Langganan Steller POS' : '💳 Pembayaran Langganan'}
                </h2>
                <button
                  onClick={closeRenewModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Step Indicator */}
              <div className="flex items-center mb-6">
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${renewStep === 'plan' ? 'bg-navy-600 text-white' : 'bg-green-500 text-white'}`}>
                    {renewStep === 'plan' ? '1' : '✓'}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${renewStep === 'plan' ? 'text-navy-700' : 'text-green-600'}`}>Pilih Paket</span>
                </div>
                <div className={`flex-1 h-1 mx-3 rounded ${renewStep === 'payment' ? 'bg-navy-600' : 'bg-slate-200'}`}></div>
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${renewStep === 'payment' ? 'bg-navy-600 text-white' : 'bg-slate-200 text-gray-500'}`}>
                    2
                  </div>
                  <span className={`ml-2 text-sm font-medium ${renewStep === 'payment' ? 'text-navy-700' : 'text-gray-400'}`}>Pembayaran</span>
                </div>
              </div>

              {renewStep === 'plan' && (
                <>
                  <div className="mb-6 p-4 bg-navy-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      Langganan Anda saat ini: <span className="font-semibold text-navy-700">{subscription.plan}</span> berakhir pada <span className="font-semibold text-navy-700">{new Date(subscription.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </p>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-4">Pilih Paket Perpanjangan</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {plans.map((plan, index) => (
                      <div
                        key={index}
                        onClick={() => setSelectedPlan(plan.name)}
                        className={`relative p-4 rounded-xl border-2 cursor-pointer transition ${
                          selectedPlan === plan.name
                            ? 'border-navy-600 bg-navy-600 text-white shadow-lg'
                            : 'border-slate-200 bg-white hover:border-navy-300'
                        }`}
                      >
                        {selectedPlan === plan.name && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow">
                            ✓
                          </div>
                        )}
                        <h4 className={`font-bold mb-2 ${selectedPlan === plan.name ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h4>
                        <p className={`text-2xl font-bold mb-1 ${selectedPlan === plan.name ? 'text-white' : 'text-navy-600'}`}>{plan.price}</p>
                        {plan.discount && (
                          <p className={`text-sm font-medium ${selectedPlan === plan.name ? 'text-green-300' : 'text-green-600'}`}>{plan.discount}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Ringkasan Pembayaran</h4>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Paket yang dipilih:</span>
                      <span className="font-semibold text-gray-900">{selectedPlan}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Harga:</span>
                      <span className="font-semibold text-gray-900">{selectedPlanData?.price}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-300 pt-2 mt-2">
                      <span className="font-semibold text-gray-900">Total:</span>
                      <span className="font-bold text-xl text-navy-600">{selectedPlanData?.price}</span>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={closeRenewModal}
                      className="flex-1 px-4 py-3 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition font-medium"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => setRenewStep('payment')}
                      className="flex-1 px-4 py-3 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition font-medium"
                    >
                      Lanjutkan Pembayaran →
                    </button>
                  </div>
                </>
              )}

              {renewStep === 'payment' && (
                <>
                  {/* Order Summary */}
                  <div className="bg-navy-50 rounded-xl p-4 mb-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Paket Perpanjangan</p>
                        <p className="font-bold text-gray-900 text-lg">Steller POS — {selectedPlan}</p>
                      </div>
                      <p className="text-2xl font-bold text-navy-600">{selectedPlanData?.price}</p>
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <h3 className="font-bold text-gray-900 mb-3">Pilih Metode Pembayaran</h3>
                  {paymentMethods.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      {paymentMethods.map((method) => (
                        <button
                          key={method.id}
                          onClick={() => setPayMethod(method.id)}
                          className={`p-3 rounded-xl border-2 text-left transition ${
                            activePayMethod === method.id
                              ? 'border-navy-600 bg-navy-50'
                              : 'border-slate-200 hover:border-navy-300'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{method.icon}</span>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">{method.label}</p>
                              <p className="text-xs text-gray-500">{method.desc}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-5 text-sm text-amber-700">
                      ⚠️ Semua metode pembayaran sedang dinonaktifkan oleh platform. <a href="https://wa.me/6285893174442" target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-amber-900">Hubungi admin StellerPOS via WhatsApp</a>.
                    </div>
                  )}

                  {/* Payment Instructions */}
                  {activePayMethod === 'qris' && (
                    <div className="border border-slate-200 rounded-xl p-5 mb-5 text-center">
                      <p className="text-sm text-gray-600 mb-3">Scan kode QR di bawah dengan aplikasi e-wallet atau m-banking Anda:</p>
                      {qrisDisplayUrl ? (
                        <img src={qrisDisplayUrl} alt="QRIS StellerPOS" className="w-64 h-64 sm:w-72 sm:h-72 mx-auto object-contain mb-3 border-4 border-slate-800 rounded-lg bg-white" />
                      ) : (
                        <div className="w-64 h-64 mx-auto bg-slate-100 border-4 border-slate-800 rounded-lg flex items-center justify-center mb-3">
                          <p className="text-xs text-gray-400 px-4">QRIS belum diupload oleh Super Admin</p>
                        </div>
                      )}
                      <p className="font-bold text-gray-900 text-xl">{selectedPlanData?.price}</p>
                      <p className="text-xs text-gray-500">QRIS · Steller POS Indonesia</p>
                      {dynamicQrisUrl ? (
                        <p className="mt-3 text-xs bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-left">
                          ✅ <span className="font-semibold">QRIS dinamis:</span> nominal <span className="font-bold">{selectedPlanData?.price}</span> sudah tertanam otomatis — cukup scan &amp; bayar tanpa input manual.
                        </p>
                      ) : (
                        <p className="mt-3 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2 text-left">
                          ⚠️ <span className="font-semibold">Catatan:</span> QRIS ini statis — saat scan, masukkan nominal <span className="font-bold">{selectedPlanData?.price}</span> secara manual di aplikasi e-wallet / m-banking Anda sesuai harga paket {selectedPlan}.
                        </p>
                      )}
                      {dynamicQrisUrl && staticQrisUrl && (
                        <details className="mt-3 text-left">
                          <summary className="text-xs text-gray-500 cursor-pointer hover:text-navy-600">
                            QR tidak bisa di-scan / ditolak aplikasi? Gunakan QR statis
                          </summary>
                          <img src={staticQrisUrl} alt="QRIS Statis" className="w-40 h-40 mx-auto mt-3 object-contain border border-slate-200 rounded-lg bg-white" />
                          <p className="text-xs text-amber-600 mt-2 text-center">Scan QR ini lalu masukkan nominal {selectedPlanData?.price} secara manual.</p>
                        </details>
                      )}
                      {qrisDisplayUrl && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(qrisDisplayUrl)
                              const blob = await res.blob()
                              const a = document.createElement('a')
                              a.href = URL.createObjectURL(blob)
                              a.download = `QRIS-StellerPOS-Rp${selectedPlanData?.priceValue || ''}.png`
                              a.click()
                              URL.revokeObjectURL(a.href)
                            } catch {
                              window.open(qrisDisplayUrl, '_blank')
                            }
                          }}
                          className="mt-3 px-5 py-2.5 bg-navy-600 text-white rounded-lg text-sm font-semibold hover:bg-navy-700 transition"
                        >
                          ⬇ Unduh QRIS
                        </button>
                      )}
                    </div>
                  )}
                  {activePayMethod === 'ewallet' && (
                    <div className="border border-slate-200 rounded-xl p-5 mb-5">
                      <p className="text-sm text-gray-600 mb-3">Kirim pembayaran ke e-Wallet platform:</p>
                      <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 mb-3">
                        <div>
                          <p className="text-xs text-gray-500 uppercase">GoPay / OVO / DANA</p>
                          <p className="text-xl font-bold text-gray-900 tracking-widest">0858-9317-4442</p>
                        </div>
                        <button
                          onClick={() => alert('Nomor e-Wallet disalin!')}
                          className="px-3 py-2 bg-navy-100 text-navy-700 rounded-lg text-sm font-semibold hover:bg-navy-200 transition"
                        >
                          Salin
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">a.n. PT Steller Indonesia — Sertakan nama toko di catatan transfer</p>
                    </div>
                  )}
                  {(activePayMethod === 'bca' || activePayMethod === 'mandiri' || activePayMethod === 'bni') && (
                    <div className="border border-slate-200 rounded-xl p-5 mb-5">
                      <p className="text-sm text-gray-600 mb-3">Transfer ke {activePayMethod === 'bca' ? 'BCA' : activePayMethod === 'mandiri' ? 'Mandiri' : 'BNI'}:</p>
                      <div className="bg-slate-50 rounded-lg px-4 py-4 mb-3 text-center">
                        <p className="text-sm text-gray-700 mb-3">Nomor rekening / Virtual Account akan diberikan oleh admin. Hubungi kami untuk instruksi pembayaran:</p>
                        <a
                          href="https://wa.me/6285893174442?text=Halo%20Admin%20StellerPOS,%20saya%20ingin%20membayar%20langganan%20via%20transfer%20bank."
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-5 py-2.5 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition"
                        >
                          💬 Hubungi Admin via WhatsApp
                        </a>
                      </div>
                      <p className="text-xs text-gray-500">a.n. PT Steller Indonesia — Sertakan nama toko di catatan transfer</p>
                    </div>
                  )}

                  {/* Nominal yang dibayar — otomatis terisi sesuai paket */}
                  <div className="mb-5">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Nominal yang Dibayar</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">Rp</span>
                      <input
                        type="number"
                        min="0"
                        value={paidAmount}
                        onChange={(e) => { setPaidAmount(e.target.value); setPayError('') }}
                        className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 font-bold text-lg"
                        placeholder="100000"
                      />
                    </div>
                    {paidAmount && parseInt(paidAmount) !== (selectedPlanData?.priceValue || 0) && (
                      <p className={`mt-2 text-xs rounded-lg px-3 py-2 border ${
                        parseInt(paidAmount) < (selectedPlanData?.priceValue || 0)
                          ? 'bg-red-50 border-red-200 text-red-600'
                          : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}>
                        {parseInt(paidAmount) < (selectedPlanData?.priceValue || 0)
                          ? `⚠️ Nominal kurang Rp ${((selectedPlanData?.priceValue || 0) - parseInt(paidAmount)).toLocaleString('id-ID')} dari tagihan.`
                          : `⚠️ Nominal lebih Rp ${(parseInt(paidAmount) - (selectedPlanData?.priceValue || 0)).toLocaleString('id-ID')} dari tagihan — kelebihan akan diverifikasi admin.`}
                      </p>
                    )}
                    {payError && <p className="mt-2 text-xs text-red-600">⚠️ {payError}</p>}
                  </div>

                  {/* Upload bukti transfer — wajib */}
                  <div className="mb-5">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Bukti Transfer <span className="text-red-500">*</span></label>
                    <label className="block border-2 border-dashed border-slate-300 rounded-xl p-5 text-center cursor-pointer hover:border-navy-400 transition">
                      <input type="file" accept="image/*" onChange={handleProofUpload} className="hidden" />
                      {proofPreview ? (
                        <img src={proofPreview} alt="Bukti Transfer" className="w-32 h-32 mx-auto object-contain rounded-lg" />
                      ) : (
                        <>
                          <span className="text-3xl">📤</span>
                          <p className="text-sm text-gray-500 mt-2">{proofUploading ? 'Mengupload...' : 'Klik untuk upload screenshot/bukti transfer'}</p>
                        </>
                      )}
                      <p className="text-xs text-gray-400 mt-1">Wajib diisi — pembayaran baru diverifikasi setelah bukti dicek admin</p>
                    </label>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => setRenewStep('plan')}
                      className="flex-1 px-4 py-3 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition font-medium"
                    >
                      ← Kembali
                    </button>
                    <button
                      onClick={handleRenewPaid}
                      disabled={isSubmittingPay}
                      className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold disabled:opacity-50"
                    >
                      {isSubmittingPay ? '⏳ Mengirim...' : '✓ Saya Sudah Bayar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Profile Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowProfileModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Profil Akun</h2>
                <button onClick={() => setShowProfileModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="flex flex-col items-center text-center mb-5">
                {ownerAvatar ? (
                  <img src={ownerAvatar} alt="Foto profil" className="w-20 h-20 rounded-full object-cover border-2 border-navy-200 mb-3" />
                ) : (
                  <div className="w-20 h-20 bg-navy-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-3">
                    {ownerName.charAt(0).toUpperCase()}
                  </div>
                )}
                <h3 className="text-xl font-bold text-gray-900">{ownerName}</h3>
                <p className="text-sm text-gray-500">{merchant ? 'Owner / Pemilik Toko' : 'Akun Demo'}</p>
              </div>
              <div className="space-y-3 text-sm">
                {[
                  ['📧 Email Bisnis', merchant?.email || 'demo@steller.id'],
                  ['🏪 Nama Toko', storeName],
                  ['⭐ Paket', subscription.plan],
                  [
                    '📅 Status Langganan',
                    merchant
                      ? (merchant.status === 'active' ? `Aktif — sisa ${subscription.daysRemaining} hari` : merchant.status)
                      : 'Demo (tidak terbatas)',
                  ],
                  ['🗓 Berakhir', new Date(subscription.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2.5">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-900 text-right">{value}</span>
                  </div>
                ))}
                {/* Status verifikasi akun */}
                <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2.5">
                  <span className="text-gray-500">🛡 Verifikasi Akun</span>
                  {merchant?.isVerified || verifiedNow ? (
                    <span className="font-semibold text-green-600">✅ Terverifikasi</span>
                  ) : merchant ? (
                    <span className="font-semibold text-amber-600">⏳ Belum terverifikasi</span>
                  ) : (
                    <span className="font-semibold text-gray-400">-</span>
                  )}
                </div>
              </div>

              {/* Alur verifikasi OTP — kode dikirim otomatis ke WA owner via gateway */}
              {merchant && !merchant.isVerified && !verifiedNow && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800 mb-3">
                    Kirim kode verifikasi 6 digit ke WhatsApp Anda, lalu masukkan di sini:
                  </p>
                  <button
                    onClick={handleSendVerifyOtp}
                    disabled={otpSending}
                    className="w-full py-2.5 bg-green-500 text-white rounded-lg font-semibold text-sm hover:bg-green-600 transition disabled:opacity-50"
                  >
                    {otpSending ? '⏳ Mengirim...' : `💬 Kirim OTP ke WhatsApp (${merchant.whatsapp || '-'})`}
                  </button>
                  {otpMsg && <p className="mt-2 text-xs text-amber-800">{otpMsg}</p>}
                  <div className="flex gap-2 mt-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="Kode 6 digit"
                      className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-center font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button
                      onClick={handleSubmitVerifyOtp}
                      className="px-4 py-2 bg-navy-600 text-white rounded-lg font-semibold text-sm hover:bg-navy-700 transition"
                    >
                      Verifikasi
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={() => { setShowProfileModal(false); navigate('/settings') }}
                className="w-full mt-5 px-4 py-3 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition font-medium"
              >
                ⚙️ Buka Pengaturan Toko
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default Dashboard
