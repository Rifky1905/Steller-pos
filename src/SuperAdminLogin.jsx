import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

// Steller Logo Component (versi terang untuk latar gelap)
const StellerLogo = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGradientAdminLogin" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C9A227" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
      <filter id="glowAdminLogin">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#glowAdminLogin)">
      <path d="M32 8L36 20H48L38 28L42 40L32 32L22 40L26 28L16 20H28L32 8Z" fill="url(#goldGradientAdminLogin)" />
    </g>
    <path d="M32 18L34 24H30L32 18Z" fill="#FFF8DC" opacity="0.8" />
    <path d="M52 10L53.8 16.2L60 18L53.8 19.8L52 26L50.2 19.8L44 18L50.2 16.2L52 10Z" fill="url(#goldGradientAdminLogin)" opacity="0.85" />
    <text x="64" y="41" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="#FFFFFF" letter-spacing="0.5">Steller</text>
  </svg>
)

// Kredensial demo Super Admin (platform owner)
const SUPER_ADMIN = {
  email: 'admin@steller.id',
  password: 'admin123',
  name: 'Rifky Arya Firdaus',
}

function SuperAdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (email.trim().toLowerCase() === SUPER_ADMIN.email && password === SUPER_ADMIN.password) {
      sessionStorage.setItem('superAdminLoggedIn', 'true')
      sessionStorage.setItem('superAdminName', SUPER_ADMIN.name)
      navigate('/super-admin')
    } else {
      setError('Email atau password salah. Silakan coba lagi.')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <StellerLogo className="w-44 h-14" />
          </div>
          <p className="text-amber-400 text-xs font-semibold tracking-[0.3em] uppercase">Platform Admin</p>
          <h1 className="text-2xl font-bold text-white mt-3">Super Admin Access</h1>
          <p className="text-slate-400 text-sm mt-1">Area khusus pemilik platform StellerPOS</p>
        </div>

        {/* Login Card */}
        <div className={`bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-8 shadow-2xl ${shake ? 'animate-pulse' : ''}`}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email Admin</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                placeholder="admin@steller.id"
                className="w-full px-4 py-3 bg-slate-900/70 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 bg-slate-900/70 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm px-4 py-3 rounded-lg">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-bold rounded-lg hover:from-amber-400 hover:to-amber-500 transition shadow-lg shadow-amber-500/20"
            >
              🔐 Masuk ke Dashboard Platform
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-6 pt-5 border-t border-slate-700 text-center">
            <p className="text-xs text-slate-500">
              Demo: <span className="text-slate-300 font-mono">admin@steller.id</span> / <span className="text-slate-300 font-mono">admin123</span>
            </p>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center mt-6">
          <Link to="/login" className="text-sm text-slate-400 hover:text-slate-200 transition">
            ← Kembali ke Login Toko
          </Link>
        </div>
      </div>
    </div>
  )
}

export default SuperAdminLogin
