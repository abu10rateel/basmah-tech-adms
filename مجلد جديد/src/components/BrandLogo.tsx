import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  showText?: boolean;
  showSubtitle?: boolean;
}

export default function BrandLogo({ 
  size = 'md', 
  animated = true,
  showText = true,
  showSubtitle = true
}: BrandLogoProps) {
  // Dimensions based on size
  const sizes = {
    sm: {
      container: 'gap-2.5',
      iconBox: 'w-10 h-10 rounded-xl',
      icon: 'w-6 h-6',
      title: 'text-sm font-bold',
      subtitle: 'text-[9px]',
      badge: 'px-1.5 py-0.5 text-[8px]'
    },
    md: {
      container: 'gap-3',
      iconBox: 'w-14 h-14 rounded-2xl',
      icon: 'w-8 h-8',
      title: 'text-base font-extrabold',
      subtitle: 'text-[10px]',
      badge: 'px-2 py-0.5 text-[9px]'
    },
    lg: {
      container: 'flex-col gap-3',
      iconBox: 'w-20 h-20 rounded-2xl',
      icon: 'w-12 h-12',
      title: 'text-xl font-black',
      subtitle: 'text-xs',
      badge: 'px-2.5 py-1 text-[10px]'
    },
    xl: {
      container: 'flex-col gap-4',
      iconBox: 'w-28 h-28 rounded-3xl',
      icon: 'w-16 h-16',
      title: 'text-3xl font-black tracking-tight',
      subtitle: 'text-xs tracking-wider',
      badge: 'px-3 py-1 text-xs'
    }
  };

  const current = sizes[size];

  return (
    <div className={`flex items-center justify-center ${current.container} text-right select-none`}>
      {/* Fingerprint Emblem Icon Box */}
      <div 
        className={`relative shrink-0 aspect-square ${current.iconBox} bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900 border border-emerald-500/30 flex items-center justify-center shadow-xl shadow-emerald-950/30 group overflow-hidden`}
      >
        {/* Animated ambient backdrop glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Neon green grid lines to give high-tech look */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.05)_1px,transparent_1px)] bg-[size:8px_8px] opacity-60" />

        {/* App Icon Image with object-contain & padding for perfect aspect ratio */}
        <img 
          src="/app-icon.jpg" 
          alt="بصمة تك" 
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-contain p-1 z-10 rounded-[inherit] transition-all duration-300 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />

        {/* Laser Scanner Effect */}
        {animated && (
          <div className="absolute left-0 right-0 h-[2px] bg-emerald-400 shadow-[0_0_10px_#10b981,0_0_20px_#10b981] animate-[scan_3s_ease-in-out_infinite] z-20" style={{ top: '0%' }} />
        )}

        {/* Highly professional SVG Fingerprint fallback */}
        <svg 
          className={`${current.icon} text-emerald-400 relative z-0 filter drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]`} 
          viewBox="0 0 100 100" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="3.5"
          strokeLinecap="round"
        >
          {/* Fingerprint Loops */}
          <path d="M50 85 C50 80, 52 75, 55 70 C60 62, 65 58, 65 50 C65 41, 58 35, 50 35 C42 35, 35 41, 35 50 C35 54, 37 58, 40 62" />
          <path d="M50 92 C45 88, 43 83, 42 78 C40 70, 42 64, 45 60 C47 57, 50 55, 50 50 C50 45, 46 41, 41 41 C36 41, 32 45, 32 50 C32 57, 28 62, 25 68" />
          <path d="M50 78 C53 72, 57 68, 57 60 C57 54, 53 50, 48 50 C44 50, 41 54, 41 60 C41 65, 43 70, 46 74" />
          <path d="M50 25 C63 25, 74 35, 74 48 C74 54, 71 61, 66 67 C61 73, 58 79, 58 85" />
          <path d="M50 16 C68 16, 83 30, 83 48 C83 58, 78 68, 72 76 C66 84, 62 90, 62 95" />
          <path d="M26 40 C20 45, 17 52, 17 60 C17 67, 14 74, 11 80" />
          <path d="M50 8 C74 8, 92 26, 92 48 C92 62, 85 75, 78 85 C73 92, 69 98, 68 100" />
          <path d="M50 43 C53 43, 56 46, 56 50 C56 54, 52 57, 50 62" />

          {/* Golden/Emerald Tech Center Ring representing 'بصمة تك' Signature node */}
          <circle cx="50" cy="50" r="4" fill="#34d399" className="animate-pulse" />
        </svg>

        {/* Glow corner effects */}
        <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-400" />
        <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-emerald-400" />
      </div>

      {/* Brand Text Elements */}
      {showText && (
        <div className={`flex flex-col ${size === 'sm' ? 'items-start' : 'items-center'} justify-center`}>
          <div className="flex items-center gap-1.5 flex-row-reverse">
            <span className={`${current.title} tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-100 to-emerald-400 font-extrabold`}>
              بصمة تك
            </span>
            {size !== 'sm' && (
              <span className={`${current.badge} font-black rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 tracking-wider`}>
                TECH
              </span>
            )}
          </div>
          
          {showSubtitle && (
            <span className={`${current.subtitle} font-bold text-slate-400 tracking-wide mt-0.5 block`}>
              النظام السحابي الذكي لإدارة البصمات والحضور
            </span>
          )}
        </div>
      )}

      {/* Styled inject for the scan animation */}
      <style>{`
        @keyframes scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  );
}
