import React from 'react';
import { auth } from '../firebase/config';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { LogIn, Store } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const loginSchema = yup.object({
  email: yup
    .string()
    .email('Email tidak valid')
    .required('Email wajib diisi'),
  password: yup
    .string()
    .min(6, 'Password minimal 6 karakter')
    .required('Password wajib diisi'),
});

function Login() {
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
  } = useForm({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data) => {
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
    } catch (err) {
      // Form validation will handle client-side errors, this is for server-side errors
      // We'll set a general error or use toast notification in a real app
      alert('Email atau Password salah. Gunakan akun merchant Anda.');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mb-4 ring-8 ring-primary/5">
            <Store className="text-primary w-10 h-10" />
          </div>
          <h1 className="text-3xl font-headline font-bold text-white tracking-tight">Aro Drive Merchant</h1>
          <p className="text-white/40 font-medium">Portal Merchant Partner</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5 ml-1">Email Merchant</label>
            <input 
              id="email"
              {...register('email')}
              type="email" 
              className={`input-field w-full ${errors.email ? 'border-destructive' : ''}`}
              placeholder="warung@aro-drive.com"
            />
            {errors.email && (
              <p className="mt-1 text-destructive text-sm">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5 ml-1">Password</label>
            <input 
              id="password"
              {...register('password')}
              type="password" 
              className={`input-field w-full ${errors.password ? 'border-destructive' : ''}`}
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1 text-destructive text-sm">{errors.password.message}</p>
            )}
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="btn-primary w-full py-4 mt-4 shadow-lg shadow-primary/20"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn size={20} />
                <span>Masuk Dashboard</span>
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-white/30 text-sm">
          Belum punya akun merchant? <a href="https://wa.me/6285748343842?text=Halo%20Admin%2C%20saya%20ingin%20mendaftar%20sebagai%20merchant%20di%20Aro%20Drive." target="_blank" rel="noreferrer" className="text-primary font-bold hover:underline">Hubungi Admin</a>
        </p>
      </div>
    </div>
  );
}

export default Login;