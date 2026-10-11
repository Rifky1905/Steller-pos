import { useState, useEffect } from 'react'
import { Routes, Route, Link, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Registration from './Registration.jsx'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'
import ProductInventory from './ProductInventory.jsx'
import SalesReports from './SalesReports.jsx'
import EmployeeManagement from './EmployeeManagement.jsx'
import StoreSettings from './StoreSettings.jsx'
import POS from './POS.jsx'
import SuperAdmin from './SuperAdmin.jsx'
import SuperAdminLogin from './SuperAdminLogin.jsx'
import SubscriptionPayment from './SubscriptionPayment.jsx'
import HardwareOrder from './HardwareOrder.jsx'
import './App.css'

// Steller Logo Component
const StellerLogo = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C9A227" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
      <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E3A8A" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    {/* Main Star with glow effect */}
    <g filter="url(#glow)">
      <path d="M32 8L36 20H48L38 28L42 40L32 32L22 40L26 28L16 20H28L32 8Z" fill="url(#goldGradient)" />
    </g>
    {/* Inner diamond */}
    <path d="M32 18L34 24H30L32 18Z" fill="#FFF8DC" opacity="0.8" />
    {/* Small sparkle accent */}
    <path d="M52 10L53.8 16.2L60 18L53.8 19.8L52 26L50.2 19.8L44 18L50.2 16.2L52 10Z" fill="url(#goldGradient)" opacity="0.85" />
    {/* Text Steller */}
    <text x="64" y="41" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="url(#blueGradient)" letter-spacing="0.5">Steller</text>
  </svg>
)

function App() {
  const [openFaq, setOpenFaq] = useState(null)
  const [reviews, setReviews] = useState([])
  const [reviewsLoaded, setReviewsLoaded] = useState(false)
  // Social proof dinamis — toko yang benar-benar terdaftar di Supabase
  const [trustedStores, setTrustedStores] = useState([])
  const [storeCount, setStoreCount] = useState(0)
  const [storesLoaded, setStoresLoaded] = useState(false)

  // Testimoni dinamis — diambil dari ulasan asli merchant di Supabase
  useEffect(() => {
    supabase.from('reviews')
      .select('rating, message, created_at, merchants(store_name, owner_name)')
      .order('created_at', { ascending: false })
      .limit(9)
      .then(({ data }) => {
        setReviews(data || [])
        setReviewsLoaded(true)
      })
    supabase.from('merchants')
      .select('store_name, avatar_url', { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data, count }) => {
        setTrustedStores(data || [])
        setStoreCount(count || 0)
        setStoresLoaded(true)
      })
  }, [])

  const avgRating = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  return (
    <Routes>
      <Route path="/" element={
        <div className="min-h-screen bg-white">
          {/* Header & Hero Section */}
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm z-50 border-b border-gray-100">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <a href="#" className="flex items-center shrink-0">
              <StellerLogo className="w-36 sm:w-40 h-12" />
            </a>
            <div className="hidden lg:flex items-center space-x-6 xl:space-x-8">
              <a href="#features" className="text-gray-600 hover:text-navy-600 transition font-medium whitespace-nowrap">Fitur Unggulan</a>
              <a href="#solutions" className="text-gray-600 hover:text-navy-600 transition font-medium whitespace-nowrap">Solusi Usaha</a>
              <a href="#pricing" className="text-gray-600 hover:text-navy-600 transition font-medium whitespace-nowrap">Paket Harga</a>
              <a href="#testimonials" className="text-gray-600 hover:text-navy-600 transition font-medium whitespace-nowrap">Testimoni</a>
              <a href="#faq" className="text-gray-600 hover:text-navy-600 transition font-medium whitespace-nowrap">Tanya Jawab</a>
            </div>
            <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
              <Link to="/login" className="hidden sm:inline-block text-gray-600 hover:text-navy-600 transition font-medium whitespace-nowrap">Masuk Akun</Link>
              <Link to="/register?trial=1" className="bg-navy-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-navy-700 transition flex items-center space-x-2 font-semibold whitespace-nowrap">
                <span className="hidden md:inline">Coba Gratis 14 Hari</span>
                <span className="md:hidden">Coba Gratis</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Software POS Fleksibel untuk Semua Jenis Toko & UMKM Indonesia
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Kelola Toko Jadi Lebih Ringan, Omset & Keuntungan Makin Nyata.
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Aplikasi kasir pintar berbasis cloud tanpa ribet install. Pantau stok barang kritis, bebas antrean kasir, cetak struk cepat, dan pantau keuangan cabang dari HP kapan saja.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link to="/register?trial=1" className="bg-navy-600 text-white px-8 py-4 rounded-lg hover:bg-navy-700 transition font-semibold text-lg w-full sm:w-auto shadow-lg hover:shadow-xl text-center">
                Mulai Coba Gratis
              </Link>
              <a href="https://wa.me/6285893174442" target="_blank" rel="noopener noreferrer" className="bg-green-500 text-white px-8 py-4 rounded-lg hover:bg-green-600 transition font-semibold text-lg w-full sm:w-auto flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span>Konsultasi WhatsApp</span>
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Tanpa Perlu Kartu Kredit</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Setup Cepat 5 Menit</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Bantuan Teknis Siaga 24/7</span>
              </div>
            </div>
          </div>

          {/* Mockup Dashboard Owner + Terminal Kasir */}
          <div className="mt-16 relative max-w-5xl mx-auto">
            {/* Browser Window - Dashboard Owner */}
            <div className="bg-gradient-to-b from-gray-100 to-white rounded-2xl p-4 shadow-2xl">
              <div className="bg-white rounded-xl overflow-hidden shadow-lg">
                <div className="bg-gray-100 px-4 py-3 flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <div className="flex-1 text-center text-sm text-gray-500">Steller POS - Dashboard Owner</div>
                </div>
                <div className="flex">
                  {/* Mini Sidebar */}
                  <div className="hidden md:block w-56 shrink-0 bg-white border-r border-slate-200 p-4">
                    <div className="flex items-center space-x-2 mb-5 px-1">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-sm">★</div>
                      <span className="text-base font-bold text-gray-900">Steller POS</span>
                    </div>
                    <nav className="space-y-1.5 text-sm">
                      <div className="flex items-center space-x-2.5 px-3 py-2.5 rounded-lg bg-navy-50 text-navy-700 font-semibold"><span>📊</span><span>Beranda</span></div>
                      <div className="flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-gray-500"><span>🛒</span><span>Terminal Kasir</span></div>
                      <div className="flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-gray-500"><span>📦</span><span>Inventaris</span></div>
                      <div className="flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-gray-500"><span>📈</span><span>Laporan</span></div>
                      <div className="flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-gray-500"><span>👥</span><span>Karyawan</span></div>
                      <div className="flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-gray-500"><span>⚙️</span><span>Pengaturan</span></div>
                    </nav>
                  </div>
                  {/* Main Dashboard Area */}
                  <div className="flex-1 min-w-0 bg-slate-50 p-4">
                    {/* Topbar */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-base font-bold text-gray-900">Halo, Rifky Arya Firdaus <span className="text-gray-500 font-normal">(Owner)</span></p>
                        <p className="text-xs text-gray-500">Pusat - Malioboro</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="flex items-center text-xs text-green-600 font-medium"><span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>Online</span>
                        <div className="w-8 h-8 bg-navy-600 rounded-full flex items-center justify-center text-white text-xs font-bold">HW</div>
                      </div>
                    </div>
                    {/* Metric Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      <div className="bg-white rounded-lg border border-slate-200 p-3.5">
                        <p className="text-xs text-gray-500">Omset Hari Ini</p>
                        <p className="text-base font-bold text-gray-900">Rp 4.250.000</p>
                        <p className="text-xs text-green-600 font-semibold">▲ +12%</p>
                      </div>
                      <div className="bg-white rounded-lg border border-slate-200 p-3.5">
                        <p className="text-xs text-gray-500">Laba Bersih</p>
                        <p className="text-base font-bold text-gray-900">Rp 1.120.000</p>
                        <p className="text-xs text-green-600 font-semibold">▲ +8%</p>
                      </div>
                      <div className="bg-white rounded-lg border border-slate-200 p-3.5">
                        <p className="text-xs text-gray-500">Total Transaksi</p>
                        <p className="text-base font-bold text-gray-900">48</p>
                        <p className="text-xs text-green-600 font-semibold">▲ +5</p>
                      </div>
                      <div className="bg-white rounded-lg border border-slate-200 p-3.5">
                        <p className="text-xs text-gray-500">Rata-rata Keranjang</p>
                        <p className="text-base font-bold text-gray-900">Rp 88.500</p>
                        <p className="text-xs text-green-600 font-semibold">▲ +3%</p>
                      </div>
                    </div>
                    {/* Chart + Top Products */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-gray-800 mb-3">Tren Penjualan Mingguan</p>
                        <div className="flex items-end justify-between space-x-2 h-32">
                          {[40, 65, 50, 80, 60, 95, 75].map((h, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center">
                              <div className={`w-full rounded-t ${i === 5 ? 'bg-navy-600' : 'bg-navy-200'}`} style={{ height: `${h}%` }}></div>
                              <span className="text-xs text-gray-400 mt-1">{['Sn','Sl','Rb','Km','Jm','Sb','Mg'][i]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg border border-slate-200 p-3.5">
                        <p className="text-sm font-semibold text-gray-800 mb-2">Produk Terlaris</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-gray-600">🍚 Beras Rojolele</span><span className="font-semibold text-gray-900">25</span></div>
                          <div className="flex justify-between"><span className="text-gray-600">🫗 Minyak Bimoli</span><span className="font-semibold text-gray-900">18</span></div>
                          <div className="flex justify-between"><span className="text-gray-600">🍬 Gula Pasir</span><span className="font-semibold text-gray-900">15</span></div>
                        </div>
                        <div className="mt-3 p-2 bg-red-50 rounded-lg flex items-center space-x-1.5">
                          <span className="text-sm">⚠️</span>
                          <span className="text-xs text-red-600 font-medium">Beras sisa 2 pcs - Restock!</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Card - Terminal Kasir */}
            <div className="hidden lg:block absolute -right-8 -bottom-10 w-[28rem] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              <div className="bg-navy-600 px-4 py-3 flex items-center justify-between">
                <span className="text-white text-sm font-bold">🛒 Terminal Kasir</span>
                <span className="text-navy-200 text-xs">Transaksi #TRX-88402</span>
              </div>
              <div className="p-3.5 flex space-x-3">
                {/* Product Grid Mini */}
                <div className="flex-1 grid grid-cols-3 gap-2">
                  {[
                    { e: '🍚', p: '50rb' }, { e: '🫗', p: '40rb' }, { e: '☕', p: '15rb' },
                    { e: '🍜', p: '3,5rb' }, { e: '🧼', p: '5,5rb' }, { e: '🍵', p: '12rb' },
                  ].map((item, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center">
                      <div className="text-2xl">{item.e}</div>
                      <p className="text-xs font-bold text-navy-600">Rp {item.p}</p>
                    </div>
                  ))}
                </div>
                {/* Cart Panel Mini */}
                <div className="w-40 shrink-0 flex flex-col">
                  <div className="space-y-1.5 flex-1">
                    <div className="bg-slate-50 rounded-lg p-2 text-xs flex justify-between"><span>🍚 Beras x1</span><span className="font-semibold">50rb</span></div>
                    <div className="bg-slate-50 rounded-lg p-2 text-xs flex justify-between"><span>☕ Kopi x2</span><span className="font-semibold">30rb</span></div>
                    <div className="bg-slate-50 rounded-lg p-2 text-xs flex justify-between"><span>🍜 Indomie x2</span><span className="font-semibold">7rb</span></div>
                  </div>
                  <div className="flex justify-between text-xs border-t border-slate-200 pt-2 mt-2">
                    <span className="text-gray-500">Total</span>
                    <span className="font-bold text-navy-600">Rp 87.000</span>
                  </div>
                  <div className="bg-navy-600 text-white text-center text-xs font-bold rounded-lg py-2.5 mt-2">Bayar & Cetak Struk</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section — dinamis dari merchant aktif di Supabase */}
      {storesLoaded && storeCount > 0 && (
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-600 font-semibold mb-8 text-lg">
            DIPERCAYA OLEH {storeCount} TOKO & UMKM DI SELURUH INDONESIA
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {trustedStores.map((store, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm flex items-center justify-center">
                <div className="text-center">
                  {store.avatar_url ? (
                    <img src={store.avatar_url} alt={store.store_name} className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
                  ) : (
                    <div className="w-16 h-16 bg-navy-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                      <span className="text-2xl">{['🏪', '🔧', '⚡', '📦', '🧺', '🛒', '💊', '🍞'][i % 8]}</span>
                    </div>
                  )}
                  <p className="font-semibold text-gray-800">{store.store_name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block bg-navy-50 text-navy-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              FITUR & KEUNGGULAN UNGGULAN
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Semua Kebutuhan Toko Ritel dalam Satu Ekosistem
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Steller diciptakan dari pengalaman nyata juragan toko di lapangan. Bukan sekadar kasir biasa, tapi asisten bisnis otomatis Anda.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-xl transition group">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Pencatatan Transaksi Cepat</h3>
              <p className="text-gray-600">Checkout kilat di Terminal Kasir — cari produk, hitung total & kembalian otomatis, lalu cetak struk dalam hitungan detik.</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-xl transition group">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Manajemen Stok Pintar</h3>
              <p className="text-gray-600">Notifikasi otomatis saat stok menipis. Pantau persediaan di semua cabang dari satu dashboard.</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-xl transition group">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Laporan Keuangan Lengkap</h3>
              <p className="text-gray-600">Laporan laba rugi, arus kas, dan performa produk real-time. Ekspor ke Excel dengan satu klik.</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-xl transition group">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Pembayaran QRIS</h3>
              <p className="text-gray-600">Terima pembayaran non-tunai dengan QRIS otomatis. Uang langsung masuk rekening Anda.</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-xl transition group">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Multi-User & Multi-Cabang</h3>
              <p className="text-gray-600">Kelola banyak cabang dengan hak akses berbeda untuk kasir, supervisor, dan owner.</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-xl transition group">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Tutup Shift Otomatis</h3>
              <p className="text-gray-600">Laporan penjualan shift kasir otomatis terbentuk. Tidak perlu hitung manual lagi.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Lihat perbedaan nyata bagaimana pemilik toko menghentikan kebocoran modal setelah beralih ke Steller.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-red-50 p-8 rounded-xl border-2 border-red-200">
              <h3 className="text-2xl font-bold text-red-700 mb-6 flex items-center">
                <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cara Lama / Manual
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-red-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-gray-700">Struk sering hilang, data penjualan tidak tercatat</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-red-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-gray-700">Stok habis mendadak, pelanggan kecewa</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-red-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-gray-700">Tutup toko malam-malam hitung kalkulator</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-red-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-gray-700">Pemilik terikat di kasir, tidak bisa lepas</span>
                </li>
              </ul>
              <div className="mt-6 bg-red-100 p-4 rounded-lg">
                <p className="text-red-800 font-semibold text-center">
                  ⚠️ Kehilangan 5-10% omset setiap bulan
                </p>
              </div>
            </div>
            <div className="bg-green-50 p-8 rounded-xl border-2 border-green-200">
              <h3 className="text-2xl font-bold text-green-700 mb-6 flex items-center">
                <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Cara Pintar Steller
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Kasir kilat scan barcode, proses 3 detik</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Notifikasi stok menipis, pesan otomatis</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Laporan tutup shift otomatis, akurat</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Owner pantau omset via HP dari mana saja</span>
                </li>
              </ul>
              <div className="mt-6 bg-green-100 p-4 rounded-lg">
                <p className="text-green-800 font-semibold text-center">
                  ✅ Hasil Teruji: Hemat 3+ Jam Operasional Tiap Hari
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block bg-navy-50 text-navy-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              PILIHAN INVESTASI BISNIS
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Paket Langganan Transparan, Balik Modal Sejak Bulan Pertama
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Satu harga untuk semua fitur lengkap. Pilih durasi yang sesuai dengan kebutuhan bisnis Anda.
            </p>
            <div className="bg-gradient-to-r from-navy-50 to-blue-50 rounded-xl p-6 mb-8 max-w-4xl mx-auto">
              <p className="text-lg font-semibold text-gray-800 mb-3">Semua paket sudah mencakup:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-700">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Akses Multi-User
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Unlimited SKU Produk
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Checkout Kasir Kilat & Struk Cepat
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Laporan Laba/Rugi
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Cetak Struk Thermal
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Manajemen Stok Kritis
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Manajemen Kategori Produk
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Dukungan Prioritas 24/7
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-xl transition">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Paket 1 Bulan</h3>
              <p className="text-gray-600 mb-4 text-sm">Cocok untuk uji coba fleksibel</p>
              <div className="mb-6">
                <span className="text-3xl font-bold text-gray-900">Rp100.000</span>
                <span className="text-gray-600 text-sm">/bulan</span>
              </div>
              <Link to="/register?plan=1%20Bulan" className="w-full bg-gray-100 text-gray-800 py-3 rounded-lg hover:bg-gray-200 transition font-semibold text-center block">
                Pilih Paket
              </Link>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-xl transition">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Paket 3 Bulan</h3>
              <p className="text-gray-600 mb-4 text-sm">Hemat Rp20.000 dari paket bulanan</p>
              <div className="mb-6">
                <span className="text-3xl font-bold text-gray-900">Rp280.000</span>
                <span className="text-gray-600 text-sm">/3 bulan</span>
              </div>
              <Link to="/register?plan=3%20Bulan" className="w-full bg-gray-100 text-gray-800 py-3 rounded-lg hover:bg-gray-200 transition font-semibold text-center block">
                Pilih Paket
              </Link>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-xl transition">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Paket 6 Bulan</h3>
              <p className="text-gray-600 mb-4 text-sm">Hemat Rp50.000 dari paket bulanan</p>
              <div className="mb-6">
                <span className="text-3xl font-bold text-gray-900">Rp550.000</span>
                <span className="text-gray-600 text-sm">/6 bulan</span>
              </div>
              <Link to="/register?plan=6%20Bulan" className="w-full bg-gray-100 text-gray-800 py-3 rounded-lg hover:bg-gray-200 transition font-semibold text-center block">
                Pilih Paket
              </Link>
            </div>
            <div className="bg-white p-6 rounded-xl border-2 border-navy-500 shadow-xl relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-navy-600 to-navy-700 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                  ⭐ Paling Hemat
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Paket 1 Tahun</h3>
              <p className="text-gray-600 mb-4 text-sm">Hemat Rp200.000 dari paket bulanan</p>
              <div className="mb-6">
                <span className="text-3xl font-bold text-gray-900">Rp1.000.000</span>
                <span className="text-gray-600 text-sm">/tahun</span>
              </div>
              <Link to="/register?plan=1%20Tahun" className="w-full bg-navy-600 text-white py-3 rounded-lg hover:bg-navy-700 transition font-semibold shadow-lg text-center block">
                Pilih Paket
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Hardware Bundle Section */}
      <section id="hardware" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 bg-navy-100 text-navy-700 rounded-full text-sm font-semibold mb-4">🖥️ HARDWARE BUNDLE</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Paket Siap Pakai Kasir</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Perangkat lengkap langsung jalan — tablet kasir + printer thermal, sudah teruji & ter-pairing sebelum dikirim. Tinggal nyalakan, login, dan mulai jualan.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              {
                key: '1bulan',
                name: 'Paket Device + Langganan 1 Bulan',
                price: 'Rp 1.800.000',
                note: 'Sudah termasuk perangkat lengkap + langganan aplikasi 1 bulan.',
                featured: false,
              },
              {
                key: '3bulan',
                name: 'Paket Device + Langganan 3 Bulan',
                price: 'Rp 2.000.000',
                note: 'Sudah termasuk perangkat lengkap + langganan aplikasi 3 bulan.',
                featured: true,
              },
            ].map((bundle) => (
              <div
                key={bundle.name}
                className={`bg-white rounded-2xl p-6 flex flex-col ${
                  bundle.featured ? 'border-2 border-navy-500 shadow-xl relative' : 'border border-slate-200 shadow-sm hover:shadow-lg transition'
                }`}
              >
                {bundle.featured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-navy-600 to-navy-700 text-white px-4 py-1 rounded-full text-xs font-semibold shadow-lg whitespace-nowrap">
                      ⭐ Paling Diminati
                    </span>
                  </div>
                )}

                {/* Foto perangkat */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-slate-50 rounded-xl p-2 flex items-center justify-center">
                    <img src="/images/hardware-tablet.jpg" alt="Tablet Android kasir" className="w-full h-36 object-contain" />
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2 flex items-center justify-center">
                    <img src="/images/hardware-printer.jpg" alt="Printer thermal kasir" className="w-full h-36 object-contain" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900">{bundle.name}</h3>
                <p className="text-sm text-gray-500 mt-1 mb-4">{bundle.note}</p>
                <div className="mb-5">
                  <span className="text-3xl font-bold text-navy-700">{bundle.price}</span>
                </div>

                <ul className="space-y-2.5 text-sm text-gray-600 mb-5">
                  <li className="flex items-start"><span className="text-green-500 mr-2 mt-0.5">✓</span><span><span className="font-semibold text-gray-800">Tablet Android</span> — Xiaomi Pad Pro 10.8" OLED, RAM 16GB / 256GB, baterai 12.000mAh, Android 14</span></li>
                  <li className="flex items-start"><span className="text-green-500 mr-2 mt-0.5">✓</span><span><span className="font-semibold text-gray-800">Pilihan warna:</span> Putih ⚪ · Biru 🔵 · Hitam ⚫</span></li>
                  <li className="flex items-start"><span className="text-green-500 mr-2 mt-0.5">✓</span><span><span className="font-semibold text-gray-800">Printer Thermal Bluetooth</span> — PUTIANPOS 58mm RPP02N, support cash drawer, cetak struk cepat</span></li>
                  <li className="flex items-start"><span className="text-green-500 mr-2 mt-0.5">✓</span><span><span className="font-semibold text-gray-800">Bonus</span> — Rol kertas thermal &amp; aksesori</span></li>
                  <li className="flex items-start"><span className="text-navy-500 mr-2 mt-0.5">🚚</span><span><span className="font-semibold text-gray-800">Estimasi kirim 5–10 hari</span> — proses setup, pairing printer &amp; uji coba sebelum kirim. Pesanan bisa datang lebih cepat sesuai kurir</span></li>
                </ul>

                <Link
                  to={`/hardware-order?paket=${bundle.key}`}
                  className={`mt-auto w-full py-3 rounded-lg font-semibold text-center transition block ${
                    bundle.featured
                      ? 'bg-navy-600 text-white hover:bg-navy-700 shadow-lg'
                      : 'bg-slate-100 text-gray-800 hover:bg-slate-200'
                  }`}
                >
                  � Pesan Sekarang
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-500 mt-8">
            🔧 Semua perangkat di-setup &amp; diuji oleh tim kami — garansi toko berlaku.
          </p>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block bg-navy-50 text-navy-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              CERITA SUKSES PENGGUNA
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Kata Juragan Toko yang Sudah Membuktikan
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {reviews.length > 0 && avgRating
                ? <>Rating <span className="font-bold text-amber-500">★ {avgRating}/5</span> dari {reviews.length} merchant yang telah memakai StellerPOS.</>
                : 'Mendengar langsung pengalaman nyata dari para pemilik toko pengguna StellerPOS.'}
            </p>
          </div>
          {!reviewsLoaded ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-white p-8 rounded-xl shadow-sm animate-pulse">
                  <div className="flex space-x-1 mb-4">
                    {[...Array(5)].map((_, j) => <div key={j} className="w-5 h-5 bg-slate-200 rounded" />)}
                  </div>
                  <div className="h-4 bg-slate-200 rounded mb-2" />
                  <div className="h-4 bg-slate-200 rounded mb-2 w-5/6" />
                  <div className="h-4 bg-slate-200 rounded mb-6 w-4/6" />
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-slate-200 rounded-full mr-4" />
                    <div className="flex-1">
                      <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="max-w-2xl mx-auto bg-white border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Belum Ada Ulasan</h3>
              <p className="text-gray-500 text-sm">
                StellerPOS baru saja diluncurkan — jadilah merchant pertama yang berbagi pengalaman melalui menu <span className="font-semibold">Pengaturan Toko → Ulasan</span>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {reviews.map((r, i) => {
                const owner = r.merchants?.owner_name || 'Pengguna Steller'
                const store = r.merchants?.store_name || 'Toko Steller'
                const initials = owner.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
                return (
                  <div key={i} className="bg-white p-8 rounded-xl shadow-sm">
                    <div className="flex items-center mb-4">
                      {[...Array(5)].map((_, j) => (
                        <svg key={j} className={`w-5 h-5 ${j < r.rating ? 'text-yellow-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <p className="text-gray-700 mb-6">"{r.message}"</p>
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-navy-100 rounded-full flex items-center justify-center mr-4">
                        <span className="text-navy-600 font-bold">{initials || 'S'}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{owner}</p>
                        <p className="text-sm text-gray-500">{store}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block bg-navy-50 text-navy-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              PUSAT BANTUAN
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Pertanyaan yang Sering Diajukan
            </h2>
            <p className="text-xl text-gray-600">
              Semua hal yang perlu Anda ketahui sebelum menggunakan Steller di toko Anda.
            </p>
          </div>
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleFaq(0)}
                className="w-full px-6 py-4 text-left flex items-center justify-between bg-white hover:bg-gray-50 transition"
              >
                <span className="font-semibold text-gray-900">Apakah Steller tetap bisa digunakan saat internet mati?</span>
                <svg className={`w-5 h-5 text-gray-500 transition-transform ${openFaq === 0 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaq === 0 && (
                <div className="px-6 py-4 bg-gray-50 text-gray-700">
                  Ya! Steller memiliki mode offline yang memungkinkan Anda tetap melakukan transaksi meskipun internet mati. Data akan disinkronkan secara otomatis saat koneksi kembali tersedia.
                </div>
              )}
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleFaq(1)}
                className="w-full px-6 py-4 text-left flex items-center justify-between bg-white hover:bg-gray-50 transition"
              >
                <span className="font-semibold text-gray-900">Perangkat keras (hardware) dan printer apa saja yang didukung?</span>
                <svg className={`w-5 h-5 text-gray-500 transition-transform ${openFaq === 1 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaq === 1 && (
                <div className="px-6 py-4 bg-gray-50 text-gray-700">
                  Steller mendukung berbagai jenis printer thermal (58mm dan 80mm), barcode scanner USB, dan kasir standar. Kami juga mendukung perangkat Android, iOS, Windows, dan browser web.
                </div>
              )}
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleFaq(2)}
                className="w-full px-6 py-4 text-left flex items-center justify-between bg-white hover:bg-gray-50 transition"
              >
                <span className="font-semibold text-gray-900">Seberapa aman data toko dan catatan keuangan saya?</span>
                <svg className={`w-5 h-5 text-gray-500 transition-transform ${openFaq === 2 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaq === 2 && (
                <div className="px-6 py-4 bg-gray-50 text-gray-700">
                  Data Anda dilindungi dengan enkripsi 256-bit SSL dan disimpan di server cloud yang aman. Kami melakukan backup harian dan memiliki kebijakan privasi yang ketat untuk melindungi informasi bisnis Anda.
                </div>
              )}
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleFaq(3)}
                className="w-full px-6 py-4 text-left flex items-center justify-between bg-white hover:bg-gray-50 transition"
              >
                <span className="font-semibold text-gray-900">Apakah ada biaya tambahan untuk pembaruan sistem di masa depan?</span>
                <svg className={`w-5 h-5 text-gray-500 transition-transform ${openFaq === 3 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaq === 3 && (
                <div className="px-6 py-4 bg-gray-50 text-gray-700">
                  Tidak ada! Semua update fitur dan pembaruan sistem disertakan dalam paket langganan Anda tanpa biaya tambahan. Kami terus mengembangkan fitur baru untuk membantu bisnis Anda berkembang.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <svg className="w-11 h-11" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="goldGradientFooter" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#C9A227" />
                      <stop offset="50%" stopColor="#FFD700" />
                      <stop offset="100%" stopColor="#B8860B" />
                    </linearGradient>
                  </defs>
                  <path d="M32 10L37 24H51L40 33L45 47L32 38L19 47L24 33L13 24H27L32 10Z" fill="url(#goldGradientFooter)" />
                  <path d="M54 12L55 16L59 18L55 20L54 24L53 20L49 18L53 16L54 12Z" fill="url(#goldGradientFooter)" opacity="0.85" />
                </svg>
                <span className="text-2xl font-bold text-white tracking-wide" style={{ fontFamily: 'Georgia, serif' }}>Steller</span>
              </div>
              <p className="text-gray-400">Aplikasi kasir pintar serbaguna yang fleksibel dan andal untuk mengelola segala jenis toko, grosir, ritel, bengkel, hingga UMKM di Indonesia.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produk</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition">Fitur</a></li>
                <li><a href="#" className="hover:text-white transition">Harga</a></li>
                <li><a href="#" className="hover:text-white transition">Integrasi</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Perusahaan</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition">Tentang Kami</a></li>
                <li><a href="#" className="hover:text-white transition">Karir</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Hubungi Kami</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="mailto:steller.pos2026@gmail.com" className="hover:text-white transition">steller.pos2026@gmail.com</a></li>
                <li><a href="https://wa.me/6285893174442" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">+62 858-9317-4442 (WhatsApp)</a></li>
                <li>Jakarta, Indonesia</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>&copy; 2026 Steller POS Indonesia. Semua hak dilindungi.</p>
          </div>
        </div>
      </footer>
        </div>
      } />
      <Route path="/register" element={<Registration />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/inventory" element={<ProductInventory />} />
      <Route path="/reports" element={<SalesReports />} />
      <Route path="/employees" element={<EmployeeManagement />} />
      <Route path="/settings" element={<StoreSettings />} />
      <Route path="/pos" element={<POS />} />
      <Route path="/cashier-login" element={<Navigate to="/login" replace />} />
      <Route path="/superadmin" element={<SuperAdmin />} />
      <Route path="/super-admin" element={<SuperAdmin />} />
      <Route path="/super-admin-login" element={<SuperAdminLogin />} />
      <Route path="/subscription-payment" element={<SubscriptionPayment />} />
      <Route path="/hardware-order" element={<HardwareOrder />} />
    </Routes>
  )
}

export default App
