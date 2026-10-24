import React, { useState } from 'react';

/**
 * Component hiển thị Avatar nhóm chợ đồng bộ trên toàn ứng dụng
 * Tự động fallback sang chữ cái đầu tiên và gradient nền sang trọng khi ảnh lỗi hoặc chưa có
 */
export default function GroupAvatar({ avatarUrl, title, identifier, size = 'md', className = '' }) {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px] rounded-lg',
    sm: 'w-7 h-7 text-[11px] rounded-xl',
    md: 'w-9 h-9 text-xs rounded-xl',
    lg: 'w-11 h-11 text-sm rounded-2xl',
  };

  const selectedSize = sizeClasses[size] || sizeClasses.md;

  // Lấy ký tự hiển thị (tên nhóm hoặc identifier)
  const displayLabel = title && title !== identifier ? title : identifier || '';
  const firstLetter = displayLabel.replace(/^(https?:\/\/t\.me\/(\+|(c\/)?)?|@)/i, '').charAt(0).toUpperCase() || 'C';

  // Gradient màu ngẫu nhiên theo ký tự để avatar fallback nhìn sống động, đẹp mắt
  const gradients = [
    'from-blue-600/30 to-indigo-600/30 text-blue-300 border-blue-500/30',
    'from-emerald-600/30 to-teal-600/30 text-emerald-300 border-emerald-500/30',
    'from-purple-600/30 to-violet-600/30 text-purple-300 border-purple-500/30',
    'from-amber-600/30 to-orange-600/30 text-amber-300 border-amber-500/30',
    'from-sky-600/30 to-cyan-600/30 text-sky-300 border-sky-500/30',
  ];
  const charCode = firstLetter.charCodeAt(0) || 0;
  const gradientCls = gradients[charCode % gradients.length];

  const showImage = Boolean(avatarUrl && !imgError);

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-tr ${gradientCls} border flex items-center justify-center font-bold flex-shrink-0 shadow-sm ${selectedSize} ${className}`}
      title={title || identifier || ''}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt={title || identifier || ''}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="select-none font-mono">
          {firstLetter}
        </span>
      )}
    </div>
  );
}
