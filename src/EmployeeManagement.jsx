import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

// Steller Logo Component
const StellerLogo = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGradientEmployees" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C9A227" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
      <linearGradient id="blueGradientEmployees" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E3A8A" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <filter id="glowEmployees">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#glowEmployees)">
      <path d="M32 8L36 20H48L38 28L42 40L32 32L22 40L26 28L16 20H28L32 8Z" fill="url(#goldGradientEmployees)" />
    </g>
    <path d="M32 18L34 24H30L32 18Z" fill="#FFF8DC" opacity="0.8" />
    <path d="M52 10L53.8 16.2L60 18L53.8 19.8L52 26L50.2 19.8L44 18L50.2 16.2L52 10Z" fill="url(#goldGradientEmployees)" opacity="0.85" />
    <text x="64" y="41" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="url(#blueGradientEmployees)" letter-spacing="0.5">Steller</text>
  </svg>
)

function EmployeeManagement() {
  const navigate = useNavigate()

  // Merchant yang belum aktif tidak boleh membuka manajemen karyawan
  useEffect(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem('merchantSession'))
      if (s && s.status !== 'active') navigate('/subscription-payment')
    } catch { /* akun demo tanpa sesi merchant */ }
  }, [navigate])

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

  const [searchTerm, setSearchTerm] = useState('')
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false)
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    role: 'Kasir',
    email: '',
    phone: '',
    password: ''
  })
  const [detailEmployee, setDetailEmployee] = useState(null)

  const menuItems = [
    { icon: '📊', label: 'Beranda / Ringkasan', active: false, path: '/dashboard' },
    { icon: '🛒', label: 'Terminal Kasir', active: false, path: '/pos' },
    { icon: '📦', label: 'Inventaris Produk', active: false, path: '/inventory' },
    { icon: '📈', label: 'Laporan Penjualan', active: false, path: '/reports' },
    { icon: '👥', label: 'Manajemen Karyawan', active: true, path: '/employees' },
    { icon: '⚙️', label: 'Pengaturan Toko', active: false, path: '/settings' },
  ]

  // Data karyawan tersimpan permanen di Supabase (tabel employees, per merchant)
  const merchantId = (() => {
    try { return JSON.parse(sessionStorage.getItem('merchantSession'))?.id || null } catch { return null }
  })()

  // Karyawan demo — hanya tampil saat mode demo (tanpa sesi merchant)
  const DEMO_EMPLOYEES = [
    { id: 1, name: 'Budi Santoso', role: 'Kasir', email: 'budi@stellar.com', phone: '081234567890', password: 'kasir123', status: 'active', joinDate: '2024-01-01' },
    { id: 2, name: 'Siti Rahayu', role: 'Kasir', email: 'siti@stellar.com', phone: '081234567891', password: 'kasir123', status: 'active', joinDate: '2024-01-05' },
    { id: 3, name: 'Ahmad Wijaya', role: 'Supervisor', email: 'ahmad@stellar.com', phone: '081234567892', password: 'kasir123', status: 'active', joinDate: '2023-12-01' },
    { id: 4, name: 'Dewi Lestari', role: 'Kasir', email: 'dewi@stellar.com', phone: '081234567893', password: 'kasir123', status: 'inactive', joinDate: '2024-01-10' },
    { id: 5, name: 'Eko Prasetyo', role: 'Kasir', email: 'eko@stellar.com', phone: '081234567894', password: 'kasir123', status: 'active', joinDate: '2024-01-15' },
  ]

  const mapEmployee = (e) => ({
    id: e.id, name: e.name, role: e.role, email: e.email, phone: e.phone || '-',
    password: e.password, status: e.status, joinDate: e.join_date,
  })

  const [employees, setEmployees] = useState(merchantId ? [] : DEMO_EMPLOYEES)
  const [isLoading, setIsLoading] = useState(!!merchantId)
  const [isSaving, setIsSaving] = useState(false)

  // Muat karyawan milik merchant ini dari Supabase
  useEffect(() => {
    if (!merchantId) return
    const load = async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('id')
      if (!error && data) setEmployees(data.map(mapEmployee))
      else if (error) console.error('Gagal memuat karyawan:', error.message)
      setIsLoading(false)
    }
    load()
  }, [merchantId])

  const handleAddEmployee = async () => {
    if (!newEmployee.name.trim() || !newEmployee.email.trim() || newEmployee.password.length < 4) {
      alert('Nama, Email (untuk login kasir), dan Sandi (min. 4 karakter) wajib diisi dengan benar!')
      return
    }
    const payload = {
      name: newEmployee.name.trim(),
      role: newEmployee.role,
      email: newEmployee.email.trim().toLowerCase(),
      phone: newEmployee.phone.trim() || '-',
      password: newEmployee.password,
      status: 'active',
    }
    if (!merchantId) {
      // Mode demo — simpan lokal saja
      setEmployees([...employees, { id: Date.now(), ...payload, joinDate: new Date().toISOString().slice(0, 10) }])
    } else {
      setIsSaving(true)
      const { data, error } = await supabase
        .from('employees')
        .insert({ ...payload, merchant_id: merchantId, join_date: new Date().toISOString().slice(0, 10) })
        .select()
        .single()
      setIsSaving(false)
      if (error) {
        alert(error.code === '23505'
          ? 'Email sudah dipakai karyawan lain. Gunakan email berbeda.'
          : 'Gagal menyimpan karyawan: ' + error.message)
        return
      }
      setEmployees([...employees, mapEmployee(data)])
    }
    setShowAddEmployeeModal(false)
    setNewEmployee({ name: '', role: 'Kasir', email: '', phone: '', password: '' })
  }

  const handleDeleteEmployee = async (employee) => {
    if (!confirm(`Hapus karyawan "${employee.name}" secara permanen?`)) return
    if (merchantId) {
      const { error } = await supabase.from('employees').delete().eq('id', employee.id).eq('merchant_id', merchantId)
      if (error) { alert('Gagal menghapus karyawan: ' + error.message); return }
    }
    setEmployees(employees.filter(e => e.id !== employee.id))
  }

  const handleToggleStatus = async (employee) => {
    const next = employee.status === 'active' ? 'inactive' : 'active'
    if (merchantId) {
      const { error } = await supabase.from('employees').update({ status: next }).eq('id', employee.id)
      if (error) { alert('Gagal mengubah status: ' + error.message); return }
    }
    setEmployees(employees.map(e => e.id === employee.id ? { ...e, status: next } : e))
  }

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
              <h1 className="text-2xl font-bold text-gray-900">👥 Manajemen Karyawan</h1>
              <p className="text-sm text-gray-500">Kelola akun kasir dan supervisor</p>
            </div>
            <button
              onClick={() => setShowAddEmployeeModal(true)}
              className="flex items-center space-x-2 bg-navy-600 text-white px-6 py-3 rounded-lg hover:bg-navy-700 transition font-medium"
            >
              <span>➕</span>
              <span>Tambah Karyawan</span>
            </button>
          </div>
        </header>

        {/* Employees Content */}
        <div className="p-8">
          {/* Search */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <input
              type="text"
              placeholder="Cari karyawan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-gray-500 mb-1">Total Karyawan</p>
              <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-gray-500 mb-1">Kasir Aktif</p>
              <p className="text-2xl font-bold text-green-600">{employees.filter(e => e.status === 'active' && e.role === 'Kasir').length}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-gray-500 mb-1">Supervisor</p>
              <p className="text-2xl font-bold text-gray-900">{employees.filter(e => e.role === 'Supervisor').length}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-gray-500 mb-1">Offline</p>
              <p className="text-2xl font-bold text-red-600">{employees.filter(e => e.status === 'inactive').length}</p>
            </div>
          </div>

          {/* Employees Grid */}
          {isLoading ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-gray-400">
              Memuat data karyawan...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <span className="text-4xl">👥</span>
              <p className="text-gray-500 mt-3 font-medium">Belum ada karyawan terdaftar.</p>
              <p className="text-sm text-gray-400 mt-1">Klik "Tambah Karyawan" untuk membuat akun kasir baru.</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEmployees.map((employee) => (
              <div key={employee.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-navy-100 rounded-full flex items-center justify-center text-navy-600 font-bold text-xl">
                      {employee.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{employee.name}</h3>
                      <p className="text-sm text-gray-500">{employee.role}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    employee.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {employee.status === 'active' ? 'Aktif' : 'Offline'}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2 text-gray-600">
                    <span>📧</span>
                    <span>{employee.email}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-600">
                    <span>📱</span>
                    <span>{employee.phone}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-600">
                    <span>📅</span>
                    <span>Bergabung: {new Date(employee.joinDate).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
                <div className="flex space-x-2 mt-4 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => setDetailEmployee(employee)}
                    className="flex-1 px-3 py-2 bg-slate-100 text-gray-700 rounded hover:bg-slate-200 transition text-sm font-medium"
                  >
                    Detail
                  </button>
                  <button
                    onClick={() => handleToggleStatus(employee)}
                    className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition text-sm font-medium"
                  >
                    {employee.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button
                    onClick={() => handleDeleteEmployee(employee)}
                    className="px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition text-sm font-medium"
                    title="Hapus karyawan"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Add Employee Modal */}
        {showAddEmployeeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Tambah Karyawan Baru</h2>
                <button
                  onClick={() => setShowAddEmployeeModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap *</label>
                  <input
                    type="text"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                    placeholder="Contoh: Budi Santoso"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                  <select
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                  >
                    <option value="Kasir">Kasir</option>
                    <option value="Supervisor">Supervisor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                    placeholder="budi@stellar.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">No. HP *</label>
                  <input
                    type="text"
                    value={newEmployee.phone}
                    onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                    placeholder="081234567890"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sandi / Password Kasir *</label>
                  <input
                    type="password"
                    value={newEmployee.password}
                    onChange={(e) => setNewEmployee({...newEmployee, password: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                    placeholder="Min. 4 karakter — dipakai kasir untuk login"
                  />
                </div>
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowAddEmployeeModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition font-medium"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleAddEmployee}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition font-medium disabled:opacity-60"
                  >
                    {isSaving ? 'Menyimpan...' : 'Simpan Karyawan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detail Employee Modal */}
        {detailEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Detail Karyawan</h2>
                <button
                  onClick={() => setDetailEmployee(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-14 h-14 bg-navy-100 rounded-full flex items-center justify-center text-navy-600 font-bold text-2xl">
                  {detailEmployee.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{detailEmployee.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    detailEmployee.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {detailEmployee.status === 'active' ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>
              <dl className="space-y-3 text-sm">
                {[
                  ['Role', detailEmployee.role],
                  ['Email', detailEmployee.email],
                  ['No. HP', detailEmployee.phone],
                  ['Sandi / Password', detailEmployee.password || '-'],
                  ['Bergabung', new Date(detailEmployee.joinDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="font-semibold text-gray-900 font-mono">{value}</dd>
                  </div>
                ))}
              </dl>
              <button
                onClick={() => setDetailEmployee(null)}
                className="w-full mt-6 py-3 bg-navy-600 text-white rounded-lg font-semibold hover:bg-navy-700 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default EmployeeManagement
