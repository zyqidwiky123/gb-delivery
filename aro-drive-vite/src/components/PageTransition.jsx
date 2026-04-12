import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SkeletonLoader = () => (
  <div className="min-h-screen p-6 space-y-8 bg-background animate-pulse pt-24 pb-32 w-full max-w-xl mx-auto">
    {/* Header Skeleton */}
    <div className="flex items-center gap-4 mb-4">
      <div className="w-12 h-12 rounded-full bg-surface-container-high"></div>
      <div className="space-y-2 flex-1">
        <div className="w-1/3 h-4 bg-surface-container-high rounded-full"></div>
        <div className="w-1/4 h-3 bg-surface-container-high rounded-full"></div>
      </div>
    </div>
    
    {/* Banner Skeleton */}
    <div className="w-full h-40 bg-surface-container-highest rounded-[2rem]"></div>
    
    {/* Grid Skeleton */}
    <div className="grid grid-cols-2 gap-4">
      <div className="h-32 bg-surface-container-highest rounded-[2rem]"></div>
      <div className="h-32 bg-surface-container-highest rounded-[2rem]"></div>
      <div className="h-32 bg-surface-container-highest rounded-[2rem]"></div>
      <div className="h-32 bg-surface-container-highest rounded-[2rem]"></div>
    </div>
    
    {/* List Skeleton */}
    <div className="space-y-3">
      <div className="w-1/2 h-5 bg-surface-container-high rounded-full"></div>
      <div className="w-full h-20 bg-surface-container-highest rounded-[1.5rem]"></div>
      <div className="w-full h-20 bg-surface-container-highest rounded-[1.5rem]"></div>
    </div>
  </div>
);

const PageTransition = ({ children }) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Tampilkan skeleton setiap kali route berubah
    setIsTransitioning(true);
    
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 400); // 400ms duration for the skeleton effect

    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (isTransitioning) {
    return <SkeletonLoader />;
  }

  return <div className="animate-in fade-in duration-300">{children}</div>;
};

export default PageTransition;
