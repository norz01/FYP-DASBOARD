import { useState } from 'react'
import { useNavigate } from 'react-router-dom';
import { getDashboardPathForRole, storeUser } from '../utils/auth';

export default function Login() {
    const [email, setEmail] = useState('admin@ikmb.edu.my');
    const [password, setPassword] = useState('password123');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage('');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Login gagal.');
            }

            storeUser(result.user);
            localStorage.setItem('ikmbToken', result.token);
            setIsLoading(false);
            navigate(getDashboardPathForRole(result.user.role));
        } catch (error) {
            setIsLoading(false);
            setErrorMessage(error.message);
        }
    };

    return (
        <div className="bg-slate-50 h-screen w-full flex overflow-hidden font-sans text-slate-900">
            {/* BAHAGIAN KIRI */}
            <div className="hidden lg:flex w-1/2 bg-blue-600 relative items-center justify-center overflow-hidden">
                <img 
                    src="https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070&auto=format&fit=crop" 
                    className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
                    alt="AI Background"
                />
                <div className="relative z-10 text-white p-12 max-w-lg">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-6">
                        <i className="ph-bold ph-brain text-2xl"></i>
                    </div>
                    <h1 className="text-4xl font-bold mb-4 leading-tight">Revolusi Bakat TVET dengan Kuasa AI.</h1>
                    <p className="text-blue-100 text-lg leading-relaxed">
                        Platform analitik termaju untuk memacu kebolehpasaran graduan TVETMARA Besut melalui data dan kecerdasan buatan.
                    </p>
                </div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-50"></div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-30"></div>
            </div>

            {/* BAHAGIAN KANAN */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center lg:text-left">
                        <img src="/logo-tvetmara.jpg" alt="Logo IKMB" className="w-64 h-auto mb-8 mx-auto lg:mx-0 object-contain" />
                        <h2 className="text-3xl font-bold text-slate-900">Selamat Kembali</h2>
                        <p className="text-slate-500 mt-2">Sila log masuk untuk akses papan pemuka.</p>
                        <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                            Akaun default: <strong>admin@ikmb.edu.my</strong> atau <strong>user@ikmb.edu.my</strong>.
                            Akaun pelajar dari dummy database guna format <strong>ikm001@student.ikmb.edu.my</strong>.
                            Semua kata laluan ialah <strong>password123</strong>.
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Emel Pengguna</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i className="ph ph-envelope text-slate-400 text-lg"></i>
                                </div>
                                <input 
                                    type="email" 
                                    required 
                                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <label className="text-sm font-semibold text-slate-700">Kata Laluan</label>
                                <a href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Lupa kata laluan?</a>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i className="ph ph-lock-key text-slate-400 text-lg"></i>
                                </div>
                                <input 
                                    type="password" 
                                    required 
                                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className={`w-full flex justify-center py-3 px-4 rounded-xl text-sm font-bold text-white transition-all transform hover:scale-[1.02] ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            {isLoading ? "Memproses..." : "Log Masuk Dashboard"}
                        </button>
                        {errorMessage && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                                {errorMessage}
                            </p>
                        )}
                    </form>
                </div>
            </div>
        </div>
    )
}