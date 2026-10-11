import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

// Steller Logo Component
const StellerLogo = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGradientReports" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C9A227" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
      <linearGradient id="blueGradientReports" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E3A8A" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <filter id="glowReports">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#glowReports)">
      <path d="M32 8L36 20H48L38 28L42 40L32 32L22 40L26 28L16 20H28L32 8Z" fill="url(#goldGradientReports)" />
    </g>
    <path d="M32 18L34 24H30L32 18Z" fill="#FFF8DC" opacity="0.8" />
    <path d="M52 10L53.8 16.2L60 18L53.8 19.8L52 26L50.2 19.8L44 18L50.2 16.2L52 10Z" fill="url(#goldGradientReports)" opacity="0.85" />
    <text x="64" y="41" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="url(#blueGradientReports)" letter-spacing="0.5">Steller</text>
  </svg>
)

function SalesReports() {
  const navigate = useNavigate()

  const handleMenuClick = (path) => {
    if (path === '/pos') {
      const m = (() => { try { return JSON.parse(sessionStorage.getItem('merchantSession')) } catch { return null } })()
      sessionStorage.setItem('cashierLoggedIn', 'true')
      sessionStorage.setItem('cashierName', m?.ownerName || 'Rifky Arya Firdaus')
      sessionStorage.setItem('cashierOutlet', m?.storeName || 'Pusat - Malioboro')
      sessionStorage.setItem('cashierRole', 'Owner')
    }
    navigate(path)
  }

  const [period, setPeriod] = useState('today')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [transactions, setTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const merchantId = (() => {
    try { return JSON.parse(sessionStorage.getItem('merchantSession'))?.id || null } catch { return null }
  })()

  // Merchant yang belum aktif tidak boleh membuka laporan
  useEffect(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem('merchantSession'))
      if (s && s.status !== 'active') navigate('/subscription-payment')
    } catch { /* akun demo tanpa sesi merchant */ }
  }, [navigate])

  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoading(true)
      const { data, error } = await (merchantId
        ? supabase.from('transactions').select('*, transaction_items(product_name, quantity, price, subtotal, products(buy_price))').eq('merchant_id', merchantId).order('created_at', { ascending: false })
        : supabase.from('transactions').select('*, transaction_items(product_name, quantity, price, subtotal, products(buy_price))').is('merchant_id', null).order('created_at', { ascending: false })
      )
      if (error) setLoadError(error.message)
      else setTransactions(data || [])
      setIsLoading(false)
    }
    fetchTransactions()
  }, [])

  const menuItems = [
    { icon: '📊', label: 'Beranda / Ringkasan', active: false, path: '/dashboard' },
    { icon: '🛒', label: 'Terminal Kasir', active: false, path: '/pos' },
    { icon: '📦', label: 'Inventaris Produk', active: false, path: '/inventory' },
    { icon: '📈', label: 'Laporan Penjualan', active: true, path: '/reports' },
    { icon: '👥', label: 'Manajemen Karyawan', active: false, path: '/employees' },
    { icon: '⚙️', label: 'Pengaturan Toko', active: false, path: '/settings' },
  ]

  const localDateKey = (d) => {
    const x = new Date(d)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  }

  const calcProfit = (trx) =>
    (trx.transaction_items || []).reduce(
      (sum, item) => sum + ((item.price - (item.products?.buy_price || 0)) * item.quantity), 0
    )

  const periodStart = useMemo(() => {
    const now = new Date()
    const d = new Date(now)
    if (period === 'today') d.setHours(0, 0, 0, 0)
    else if (period === 'week') { d.setDate(now.getDate() - 6); d.setHours(0, 0, 0, 0) }
    else if (period === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0) }
    else if (period === 'year') { d.setMonth(0, 1); d.setHours(0, 0, 0, 0) }
    return d
  }, [period])

  const filteredTransactions = transactions.filter(t => {
    const d = new Date(t.created_at)
    if (d < periodStart) return false
    if (filterStartDate && d < new Date(`${filterStartDate}T00:00:00`)) return false
    if (filterEndDate && d > new Date(`${filterEndDate}T23:59:59`)) return false
    return true
  })

  const totalRevenue = filteredTransactions.reduce((acc, t) => acc + (t.total || 0), 0)
  const totalProfit = filteredTransactions.reduce((acc, t) => acc + calcProfit(t), 0)
  const totalTransactions = filteredTransactions.length
  const avgOrder = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0
  const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0'

  const periodLabel = { today: 'hari ini', week: '7 hari terakhir', month: 'bulan ini', year: 'tahun ini' }

  const dailyData = (() => {
    const map = {}
    filteredTransactions.forEach(t => {
      const key = localDateKey(t.created_at)
      if (!map[key]) map[key] = { date: key, transactions: 0, revenue: 0, profit: 0 }
      map[key].transactions += 1
      map[key].revenue += t.total || 0
      map[key].profit += calcProfit(t)
    })
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  })()

  const methodBadge = (m) => ({
    tunai: { label: '💵 Tunai', cls: 'bg-green-100 text-green-700' },
    qris: { label: '📱 QRIS', cls: 'bg-blue-100 text-blue-700' },
    transfer: { label: '🏦 Transfer', cls: 'bg-purple-100 text-purple-700' },
  }[m] || { label: m, cls: 'bg-slate-100 text-slate-600' })

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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📈 Laporan Penjualan</h1>
              <p className="text-sm text-gray-500">Analisis performa penjualan Anda</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => alert('Laporan akan diunduh dalam format Excel...')}
                className="flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-medium"
              >
                <span>📊</span>
                <span>Unduh Excel</span>
              </button>
              <button
                onClick={() => alert('Laporan akan diunduh dalam format PDF...')}
                className="flex items-center space-x-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition font-medium"
              >
                <span>📄</span>
                <span>Unduh PDF</span>
              </button>
            </div>
          </div>
        </header>

        {/* Reports Content */}
        <div className="p-8">
          {/* Period Filter */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex space-x-2">
              <button
                onClick={() => setPeriod('today')}
                className={`px-6 py-3 rounded-lg font-medium transition ${
                  period === 'today'
                    ? 'bg-navy-600 text-white'
                    : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                }`}
              >
                Hari Ini
              </button>
              <button
                onClick={() => setPeriod('week')}
                className={`px-6 py-3 rounded-lg font-medium transition ${
                  period === 'week'
                    ? 'bg-navy-600 text-white'
                    : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                }`}
              >
                Minggu Ini
              </button>
              <button
                onClick={() => setPeriod('month')}
                className={`px-6 py-3 rounded-lg font-medium transition ${
                  period === 'month'
                    ? 'bg-navy-600 text-white'
                    : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                }`}
              >
                Bulan Ini
              </button>
              <button
                onClick={() => setPeriod('year')}
                className={`px-6 py-3 rounded-lg font-medium transition ${
                  period === 'year'
                    ? 'bg-navy-600 text-white'
                    : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
                }`}
              >
                Tahun Ini
              </button>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">📅 Filter Tanggal</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Mulai</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Akhir</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter Bulan</label>
                <select
                  onChange={(e) => {
                    const year = new Date().getFullYear()
                    const month = e.target.value
                    if (month) {
                      setFilterStartDate(`${year}-${month}-01`)
                      const lastDay = new Date(year, parseInt(month), 0).getDate()
                      setFilterEndDate(`${year}-${month}-${lastDay}`)
                    } else {
                      setFilterStartDate('')
                      setFilterEndDate('')
                    }
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                >
                  <option value="">Pilih Bulan</option>
                  <option value="01">Januari</option>
                  <option value="02">Februari</option>
                  <option value="03">Maret</option>
                  <option value="04">April</option>
                  <option value="05">Mei</option>
                  <option value="06">Juni</option>
                  <option value="07">Juli</option>
                  <option value="08">Agustus</option>
                  <option value="09">September</option>
                  <option value="10">Oktober</option>
                  <option value="11">November</option>
                  <option value="12">Desember</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter Tahun</label>
                <select
                  onChange={(e) => {
                    const year = e.target.value
                    if (year) {
                      setFilterStartDate(`${year}-01-01`)
                      setFilterEndDate(`${year}-12-31`)
                    } else {
                      setFilterStartDate('')
                      setFilterEndDate('')
                    }
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                >
                  <option value="">Pilih Tahun</option>
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </div>
            </div>
            <div className="flex space-x-3 mt-4">
              <button
                onClick={() => {
                  setFilterStartDate('')
                  setFilterEndDate('')
                }}
                className="px-4 py-2 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition font-medium"
              >
                Reset Filter
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <p className="text-sm text-gray-500 mb-2">Total Omset</p>
              <p className="text-3xl font-bold text-gray-900">Rp {totalRevenue.toLocaleString('id-ID')}</p>
              <p className="text-sm text-gray-500 mt-2">Rata-rata Rp {avgOrder.toLocaleString('id-ID')} / transaksi</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <p className="text-sm text-gray-500 mb-2">Total Laba</p>
              <p className="text-3xl font-bold text-gray-900">Rp {totalProfit.toLocaleString('id-ID')}</p>
              <p className="text-sm text-gray-500 mt-2">Margin {margin}% dari omset</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <p className="text-sm text-gray-500 mb-2">Total Transaksi</p>
              <p className="text-3xl font-bold text-gray-900">{totalTransactions}</p>
              <p className="text-sm text-gray-500 mt-2">Transaksi {periodLabel[period]}</p>
            </div>
          </div>

          {/* Sales Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Grafik Penjualan</h2>
            <div className="h-64 flex items-end justify-between space-x-2 px-4">
              {isLoading ? (
                <div className="w-full text-center text-gray-400 py-8">Memuat data transaksi...</div>
              ) : dailyData.length > 0 ? (
                dailyData.map((item, index) => {
                  const maxRevenue = Math.max(...dailyData.map(d => d.revenue))
                  return (
                    <div
                      key={index}
                      className="flex-1 bg-navy-200 rounded-t hover:bg-navy-600 transition cursor-pointer relative group"
                      style={{ height: `${Math.max((item.revenue / maxRevenue) * 100, 4)}%` }}
                    >
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                        Rp {item.revenue.toLocaleString('id-ID')}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="w-full text-center text-gray-500 py-8">
                  {loadError ? `Gagal memuat data: ${loadError}` : 'Belum ada transaksi — grafik akan muncul setelah transaksi pertama'}
                </div>
              )}
            </div>
            <div className="flex justify-between mt-4 text-xs text-gray-500 px-4">
              {dailyData.map((item, index) => (
                <span key={index}>{new Date(item.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
              ))}
            </div>
          </div>

          {/* Sales Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <h2 className="text-lg font-bold text-gray-900 p-6 pb-4">Riwayat Transaksi</h2>
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Kode</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Tanggal</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Kasir</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Metode</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Barang Terjual</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Item</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-400">Memuat riwayat transaksi...</td>
                  </tr>
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map((trx) => {
                    const badge = methodBadge(trx.payment_method)
                    return (
                      <tr key={trx.id} className="border-t border-slate-200 hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-navy-600">{trx.trx_code}</td>
                        <td className="px-6 py-4 text-gray-900">{new Date(trx.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="px-6 py-4 text-gray-900">{trx.cashier_name}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.cls}`}>{badge.label}</span></td>
                        <td className="px-6 py-4 text-gray-600 text-sm">
                          {(trx.transaction_items || []).length > 0
                            ? (trx.transaction_items || []).map(i => `${i.product_name} ×${i.quantity}`).join(', ')
                            : '-'}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{(trx.transaction_items || []).reduce((s, i) => s + i.quantity, 0)} pcs</td>
                        <td className="px-6 py-4 font-medium text-gray-900">Rp {(trx.total || 0).toLocaleString('id-ID')}</td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      Belum ada transaksi pada periode ini — lakukan checkout di Terminal Kasir
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

export default SalesReports
