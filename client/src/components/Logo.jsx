export default function Logo({ size = 36, showText = true, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Glowing Brand Icon */}
      <div 
        className="relative flex items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 p-2 shadow-lg shadow-blue-500/25 border border-sky-400/30 flex-shrink-0 group"
        style={{ width: size, height: size }}
      >
        {/* Glow backdrop */}
        <div className="absolute inset-0 rounded-xl bg-sky-400/20 blur-md group-hover:bg-sky-400/40 transition-colors pointer-events-none" />

        {/* Telegram Paper Plane SVG with signal arcs */}
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="w-full h-full text-white relative z-10 drop-shadow"
        >
          {/* Plane body */}
          <path d="M22 2L11 13" />
          <path d="M22 2L15 22L11 13L2 9L22 2Z" fill="rgba(255,255,255,0.2)" />
        </svg>

        {/* Pulse dot */}
        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border border-gray-950" />
        </span>
      </div>

      {/* Typography */}
      {showText && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-white leading-tight text-sm tracking-tight bg-gradient-to-r from-white via-sky-100 to-sky-300 bg-clip-text text-transparent">
              TeleBroadcast
            </span>
            <span className="px-1.5 py-0.2 rounded bg-blue-950/80 border border-blue-700/50 text-[9px] font-bold text-sky-300 uppercase tracking-wider">
              HUB
            </span>
          </div>
          <p className="text-[10px] text-gray-500 font-medium">Hệ Thống Phát Tin Đa Luồng</p>
        </div>
      )}
    </div>
  )
}
