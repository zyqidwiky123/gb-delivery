import React from 'react';

const SkeletonAvatar = () => (
  <div className="w-16 h-16 rounded-2xl overflow-hidden border border-primary/20 bg-primary/20 flex items-center justify-center text-primary shrink-0 animate-pulse">
    <div className="w-10 h-10 bg-white/20 rounded-full"></div>
  </div>
);

const SkeletonText = ({ className = '', width = 'full' }) => {
  const widthClass = width === 'full' ? 'w-full' : `w-${width}`;
  return (
    <div className={`${widthClass} h-4 bg-white/20 rounded animate-pulse mb-2 ${className}`} />
  );
};

const SkeletonTitle = () => (
  <SkeletonText width="3/4" className="mb-1" />
);

const SkeletonCaption = () => (
  <SkeletonText width="1/2" className="text-[10px]" />
);

const SkeletonCard = ({ titleLines = 3, contentLines = 4 }) => (
  <div className="card space-y-3">
    <div className="space-y-2">
      {[...Array(titleLines)].map((_, i) => (
        <SkeletonText key={`title-${i}`} width="full" />
      ))}
    </div>
    <div className="space-y-2">
      {[...Array(contentLines)].map((_, i) => (
        <SkeletonText key={`content-${i}`} width="full" />
      ))}
    </div>
  </div>
);

export { SkeletonAvatar, SkeletonText, SkeletonTitle, SkeletonCaption, SkeletonCard };