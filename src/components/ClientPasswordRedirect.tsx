"use client";
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function ClientPasswordRedirect() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (user && user.status === 'first_access' && pathname !== '/change-password') {
      router.replace('/change-password');
    }
  }, [user, router, pathname]);

  return null;
} 