import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { 
  BookOpen, GraduationCap, User, FileText, UploadCloud, BrainCircuit,
  LogOut, Activity, ChevronDown, ChevronUp, CheckCircle2, ListChecks, Quote, Sparkles, 
  AlertCircle, Image as ImageIcon, Target, ArrowRight, XCircle, CheckCircle,
  Timer, RotateCcw, ChevronLeft, ChevronRight, FileQuestion, Star, Lock,
  TrendingUp, Layers, PenTool, Database, Clock, Bell
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";

// ============================================================================
// HELPERS — formatting, validation, and shared utility functions
// ============================================================================
const formatName = (name) => {
  return name.replace(/\b\w/g, char => char.toUpperCase());
};

const validatePassword = (val) => {
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!re.test(val)) {
    return "Requires 8+ chars, 1 uppercase, 1 lowercase, 1 number, and 1 special symbol.";
  }
  return "";
};

export const getNextRevisionInterval = (revisionCount) => {
  const intervals = [1, 3, 7, 14, 30]; 
  return intervals[Math.min(revisionCount, intervals.length - 1)];
};

// ============================================================================
// MATH RENDERING — KaTeX-backed inline/block math + AI-text formatting
// ============================================================================
const MathRenderer = ({ math, block }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const renderMath = () => {
      if (window.katex && containerRef.current) {
        let cleanMath = typeof math === 'string'
          ? math.trim().replace(/^\${1,2}/, '').replace(/\${1,2}$/, '').trim()
          : '';
        try {
          window.katex.render(cleanMath, containerRef.current, { 
            displayMode: block, 
            throwOnError: false, 
            strict: false
          });
        } catch (e) {
          containerRef.current.innerText = cleanMath; 
        }
      }
    };

    if (!window.katex) {
      if (!document.getElementById('katex-css')) {
        const link = document.createElement('link');
        link.id = 'katex-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
        document.head.appendChild(link);
      }
      if (!document.getElementById('katex-js')) {
        const script = document.createElement('script');
        script.id = 'katex-js';
        script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js';
        script.onload = renderMath;
        document.head.appendChild(script);
      } else {
         const checkInterval = setInterval(() => {
           if (window.katex) {
             clearInterval(checkInterval);
             renderMath();
           }
         }, 100);
         setTimeout(() => clearInterval(checkInterval), 5000);
      }
    } else {
      renderMath();
    }
  }, [math, block]);

  return <span ref={containerRef} className={`math-container max-w-full ${block ? 'block my-2 text-center overflow-x-auto overflow-y-visible py-1' : 'inline-block align-middle'}`}>{math}</span>;
};

const FormattedText = ({ content }) => {
  if (typeof content !== 'string') return null;
  
  const parts = content.split(/(\$\$[\s\S]+?\$\$|\$[^$]+\$)/g);
  
  return (
    <div className="whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          return <MathRenderer key={index} math={part} block={true} />;
        } else if (part.startsWith('$') && part.endsWith('$')) {
          return <MathRenderer key={index} math={part} block={false} />;
        }
        
        let textPart = part.replace(/\*\*(.*?)\*\*/g, '$1');
        textPart = textPart.replace(/\${2,}/g, '');
        return <span key={index}>{textPart}</span>;
      })}
    </div>
  );
};

// ============================================================================
// AMBIENT BACKGROUND — three.js particle/geometry scene
// ============================================================================
function DynamicBackground({ isDark, isPaused }) {
  const mountRef = useRef(null);
  const isPausedRef = useRef(isPaused);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    if (isDark || !mountRef.current) return;
    const currentMount = mountRef.current;
    currentMount.innerHTML = ''; 
    
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf8fafc, 0.015);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 40;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    currentMount.appendChild(renderer.domElement);

    const shapes = [];
    const geometries = [
      new THREE.IcosahedronGeometry(2, 0),
      new THREE.BoxGeometry(3, 3, 3),
      new THREE.TetrahedronGeometry(2.5, 0),
      new THREE.OctahedronGeometry(2, 0)
    ];

    const material = new THREE.MeshBasicMaterial({ color: 0x4f46e5, wireframe: true, transparent: true, opacity: 0.45 });
    const group = new THREE.Group();
    scene.add(group);

    for (let i = 0; i < 50; i++) {
      const geo = geometries[Math.floor(Math.random() * geometries.length)];
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.x = (Math.random() - 0.5) * 180; 
      mesh.position.y = (Math.random() - 0.5) * 140; 
      mesh.position.z = (Math.random() - 0.5) * 100 - 20; 
      mesh.rotation.x = Math.random() * Math.PI;
      mesh.rotation.y = Math.random() * Math.PI;
      mesh.userData = { rx: (Math.random() - 0.5) * 0.02, ry: (Math.random() - 0.5) * 0.02 };
      group.add(mesh);
      shapes.push(mesh);
    }

    let mouseX = 0, mouseY = 0, currentTiltX = 0, currentTiltY = 0;
    const handleMouseMove = (event) => {
      mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('pointermove', handleMouseMove);

    let baseRotationX = 0, baseRotationY = 0, frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (!isPausedRef.current) {
        shapes.forEach(shape => {
          shape.rotation.x += shape.userData.rx;
          shape.rotation.y += shape.userData.ry;
        });
        baseRotationX += 0.001; 
        baseRotationY += 0.003; 
        currentTiltX += (mouseX - currentTiltX) * 0.05;
        currentTiltY += (mouseY - currentTiltY) * 0.05;
        group.rotation.x = baseRotationX - (currentTiltY * 0.5);
        group.rotation.y = baseRotationY + (currentTiltX * 0.5);
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handleMouseMove);
      cancelAnimationFrame(frameId);
      if (currentMount.contains(renderer.domElement)) currentMount.removeChild(renderer.domElement);
      geometries.forEach(g => g.dispose());
      material.dispose();
      renderer.dispose();
    };
  }, [isDark]);

  if (isDark) return null;
  return <div ref={mountRef} className="fixed inset-0 w-full h-full pointer-events-none z-[1]" />;
}

// ============================================================================
// PRESENTATIONAL COMPONENTS — small reusable building blocks used by the views
// ============================================================================
function StatPopCard({ visible, delay, isDark, icon, title, value, suffix = "" }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let startTimestamp = null;
    const duration = 1500; 
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(easeOut * value));
      if (progress < 1) requestAnimationFrame(step);
      else setCount(value); 
    };
    setTimeout(() => requestAnimationFrame(step), delay);
  }, [visible, value, delay]);

  return (
    <div 
      className={`p-8 rounded-3xl backdrop-blur-md transition-all duration-700 transform border animate-in fade-in slide-in-from-bottom-4 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      } ${isDark ? 'bg-white/5 border-white/10 shadow-lg' : 'bg-white/80 border-slate-200 shadow-xl shadow-slate-200/50'}`}
      style={{ transitionDelay: `${delay}ms`, animationDelay: `${delay}ms` }}
    >
      <div className="flex flex-col items-center text-center">
        <div className={`p-4 rounded-2xl mb-5 shadow-inner ${isDark ? 'bg-slate-800 border-white/5' : 'bg-slate-50 border-slate-100'}`}>{icon}</div>
        <p className={`text-4xl font-extrabold mb-2 tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>{count}{suffix}</p>
        <h3 className={`font-semibold text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{title}</h3>
      </div>
    </div>
  );
}

function UploadCard({ isDark, icon, title, desc, accentColor, isUploaded, onClick, dragActive }) {
  const colorMap = {
    blue: { bg: 'bg-blue-50', bgDark: 'bg-blue-500/10', borderHover: 'hover:border-blue-500', borderHoverDark: 'hover:border-blue-400/50' },
    indigo: { bg: 'bg-indigo-50', bgDark: 'bg-indigo-500/10', borderHover: 'hover:border-indigo-500', borderHoverDark: 'hover:border-indigo-400/50' },
    purple: { bg: 'bg-purple-50', bgDark: 'bg-purple-500/10', borderHover: 'hover:border-purple-500', borderHoverDark: 'hover:border-purple-400/50' }
  };
  const colors = colorMap[accentColor];
  const activeDragClass = dragActive ? (isDark ? `border-${accentColor}-400 bg-${accentColor}-500/20` : `border-${accentColor}-500 bg-${accentColor}-100`) : '';

  return (
    <div onClick={onClick} className={`w-full border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-12 text-center transition-all cursor-pointer group backdrop-blur-sm ${
      isUploaded ? isDark ? `border-${accentColor}-500 bg-${accentColor}-500/10` : `border-${accentColor}-500 bg-${accentColor}-50`
        : isDark ? `border-white/10 bg-white/5 hover:bg-white/10 ${colors.borderHoverDark} ${activeDragClass}` : `border-slate-300 bg-white/60 hover:bg-white ${colors.borderHover} shadow-sm ${activeDragClass}`
    }`}>
      {isUploaded ? (
        <div className="h-24 w-24 rounded-full flex items-center justify-center mb-6 bg-green-500/20 text-green-500 animate-in zoom-in duration-300"><CheckCircle2 size={48} /></div>
      ) : (
        <div className={`h-24 w-24 rounded-full flex items-center justify-center mb-6 transition-transform group-hover:scale-110 duration-500 ${isDark ? colors.bgDark : colors.bg}`}>{icon}</div>
      )}
      <h3 className="text-2xl font-bold mb-3">{isUploaded ? 'Files Uploaded' : title}</h3>
      <p className={`max-w-xs mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{isUploaded ? 'Ready for processing.' : desc}</p>
      <div className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${isUploaded ? 'bg-transparent text-slate-400 hover:text-slate-500' : isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}>
        {isUploaded ? 'Change Files' : 'Select Files'}
      </div>
    </div>
  );
}

function ProcessingIndicator({ isDark, text = "Analyzing Document..." }) {
  return (
    <div className={`w-full max-w-2xl mx-auto p-12 rounded-3xl border text-center transition-all animate-in fade-in zoom-in-95 duration-500 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 backdrop-blur-sm border-slate-200 shadow-xl'}`}>
      <div className="flex justify-center mb-8">
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 animate-pulse"></div>
          <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center"><BrainCircuit size={32} className="text-blue-500" /></div>
        </div>
      </div>
      <h3 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>{text}</h3>
      <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Applying machine learning to extract key insights.</p>
    </div>
  );
}

function EbbinghausCurve({ isDark }) {
  return (
    <div className={`w-full p-8 rounded-3xl mb-8 flex flex-col md:flex-row items-center gap-8 ${isDark ? 'bg-slate-900/50 border border-white/5' : 'bg-white border border-slate-200 shadow-sm'}`}>
      <div className="flex-1 space-y-4">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <BrainCircuit className="text-emerald-500" />
          Spaced Repetition
        </h3>
        <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          The Ebbinghaus Forgetting Curve shows how information is lost over time when there is no attempt to retain it. By reviewing your flashcards at calculated intervals (1, 3, 7, 14, and 30 days), you reset your memory retention to 100% and flatten the curve, ensuring long-term mastery.
        </p>
      </div>
      <div className="w-full md:w-1/2 h-48 relative overflow-hidden rounded-xl">
        <svg viewBox="0 0 400 150" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M 20,130 L 380,130" stroke={isDark ? '#334155' : '#e2e8f0'} strokeWidth="2" />
          <path d="M 20,20 L 20,130" stroke={isDark ? '#334155' : '#e2e8f0'} strokeWidth="2" />
          <text x="380" y="145" fontSize="10" fill={isDark ? '#94a3b8' : '#64748b'} textAnchor="end" fontWeight="bold">Time (Days)</text>
          <text x="15" y="15" fontSize="10" fill={isDark ? '#94a3b8' : '#64748b'} textAnchor="end" fontWeight="bold" transform="rotate(-90, 15, 15)">Retention</text>
          
          <path d="M 20,20 Q 80,120 380,125" fill="none" stroke={isDark ? '#475569' : '#cbd5e1'} strokeWidth="3" strokeDasharray="6,6" />
          
          <path d="M 20,20 Q 50,70 80,80 L 80,20 Q 140,50 170,60 L 170,20 Q 250,30 280,40 L 280,20 Q 340,25 380,30 L 380,20" fill="none" stroke="#10b981" strokeWidth="3" style={{ strokeDasharray: 1200, strokeDashoffset: 1200, animation: 'drawCurve 3s ease-out forwards 0.5s' }} />
          
          <circle cx="80" cy="20" r="4" fill="#10b981" className="animate-pulse" style={{ animationDelay: '1s' }} />
          <circle cx="170" cy="20" r="4" fill="#10b981" className="animate-pulse" style={{ animationDelay: '1.5s' }} />
          <circle cx="280" cy="20" r="4" fill="#10b981" className="animate-pulse" style={{ animationDelay: '2s' }} />
        </svg>
        <style>{`
          @keyframes drawCurve {
            to { stroke-dashoffset: 0; }
          }
        `}</style>
      </div>
    </div>
  );
}

function NexusLogo({ size = 'lg' }) {
  const isLg = size === 'lg';
  const containerSize = isLg ? 'w-20 h-20' : 'w-12 h-12';
  const iconSize = isLg ? 40 : 24;

  return (
    <div className={`flex items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-[0_15px_35px_-10px_rgba(79,70,229,0.5)] transition-transform hover:scale-105 ${containerSize}`}>
      <BrainCircuit size={iconSize} />
    </div>
  );
}

// ============================================================================
// AUTH VIEW — login, registration + OTP verification, password reset
// ============================================================================
function AuthView({ onLoginSuccess }) {
  const [showSplash, setShowSplash] = useState(true);
  const [view, setView] = useState('login'); 
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [educationLevel, setEducationLevel] = useState('');
  const [educationSubOption, setEducationSubOption] = useState('');
  const [otp, setOtp] = useState('');
  
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const eduOptions = {
    'School': ['Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    'Bachelors': ['Engineering', 'MBBS', 'Arts', 'Science', 'Commerce', 'Law', 'Other'],
    'Masters': ['M.Tech', 'MD', 'MBA', 'M.Sc', 'MA', 'M.Com', 'Other'],
    'PhD': ['Computer Science', 'Physics', 'Biology', 'Literature', 'Other']
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    if (val.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) setEmailError("Please enter a valid email format.");
    else setEmailError('');
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    if (val.length > 0 && (view === 'register-details' || view === 'reset')) {
      setPasswordError(validatePassword(val));
    } else {
      setPasswordError('');
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed");
      
      onLoginSuccess({ ...data, staySignedIn });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleSendSignupOtp = async (e) => {
    e.preventDefault();
    if (emailError || passwordError) return;
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not send OTP");
      setView('register-otp');
      setSuccessMsg(`OTP sent to ${email} successfully!`);
      setResendCooldown(60);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not resend OTP");
      setSuccessMsg(`OTP sent to ${email} successfully!`);
      setResendCooldown(60);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      const payload = { 
        email, 
        password, 
        name: formatName(name), 
        age, 
        educationLevel, 
        educationSubOption, 
        otp 
      };
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");
      
      onLoginSuccess({ ...data, staySignedIn });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (emailError) return;
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      const res = await fetch(`${API_BASE}/auth/reset`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to reset password");
      setSuccessMsg("Success! A new temporary password has been sent to your email.");
      setTimeout(() => { setView('login'); setSuccessMsg(''); }, 5000);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const getHeading = () => {
    if (view === 'login') return 'Welcome back';
    if (view === 'register-details' || view === 'register-otp') return 'Create your account';
    return 'Reset password';
  };

  const getSubheading = () => {
    if (view === 'login') return 'Enter your details to access your dashboard';
    if (view === 'register-details' || view === 'register-otp') return 'Start your intelligent learning journey';
    return 'We will generate a new secure password for you';
  };

  const inputClasses = "w-full px-4 py-2.5 bg-white/60 border border-slate-200/60 rounded-xl text-sm outline-none transition-all font-semibold text-slate-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] focus:bg-white focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500";
  const labelClasses = "block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1";

  if (showSplash) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-50 flex flex-col items-center justify-center transition-opacity duration-1000 ease-out animate-out fade-out fill-mode-forwards" style={{ animationDelay: '2s' }}>
        <div className="flex flex-col items-center animate-in zoom-in-95 duration-1000 slide-in-from-bottom-4">
          <NexusLogo size="lg" />
          <h1 className="mt-8 text-4xl font-black text-slate-900 tracking-tight animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300 fill-mode-both">
            NexusPrep
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      <DynamicBackground isDark={false} isPaused={false} />
      
      <div className={`w-full bg-white/90 backdrop-blur-2xl border border-white/50 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] p-6 sm:p-8 relative z-10 transition-all duration-500 animate-in fade-in zoom-in-95 ${view === 'register-details' ? 'max-w-xl' : 'max-w-md'}`}>
        
        <div className="flex flex-col items-center mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <NexusLogo size="sm" />
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-3">{getHeading()}</h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">{getSubheading()}</p>
        </div>
        
        {error && <div className="mb-4 p-3 bg-red-50/80 backdrop-blur-sm text-red-600 border border-red-100 rounded-xl text-sm font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-2"><AlertCircle size={18} className="shrink-0"/> {error}</div>}
        {successMsg && <div className="mb-4 p-3 bg-emerald-50/80 backdrop-blur-sm text-emerald-600 border border-emerald-100 rounded-xl text-sm font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-2"><CheckCircle2 size={18} className="shrink-0"/> {successMsg}</div>}
        
        {view === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-both">
              <label className={labelClasses}>Email Address</label>
              <input type="email" required value={email} onChange={handleEmailChange} className={`${inputClasses} ${emailError ? '!border-red-300 !ring-red-500/20 focus:!border-red-500' : ''}`} placeholder="you@example.com" />
              {emailError && <p className="text-xs text-red-500 font-bold mt-1.5 ml-1">{emailError}</p>}
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
              <div className="flex justify-between items-center mb-1 ml-1">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">Password</label>
                <button type="button" onClick={() => { setView('reset'); setError(''); setSuccessMsg(''); }} className="text-xs font-bold text-indigo-600 hover:text-indigo-500 transition-colors">
                  Forgot password?
                </button>
              </div>
              <input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} className={inputClasses} placeholder="••••••••" />
              
              <div className="flex items-center gap-2 mt-3 ml-1">
                <input type="checkbox" id="staySignedInLogin" checked={staySignedIn} onChange={(e) => setStaySignedIn(e.target.checked)} className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500/30 transition-all cursor-pointer"/>
                <label htmlFor="staySignedInLogin" className="text-sm font-bold text-slate-600 cursor-pointer select-none">Stay signed in</label>
              </div>
            </div>

            <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
              <button type="submit" disabled={loading || !!emailError} className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-[0_10px_20px_-10px_rgba(79,70,229,0.5)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2 text-base">
                {loading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : null}
                Sign In
              </button>
            </div>
          </form>
        )}

        {view === 'register-details' && (
          <form onSubmit={handleSendSignupOtp} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-both">
              <div>
                <label className={labelClasses}>Full Name</label>
                <input type="text" required value={name} onChange={(e)=>setName(e.target.value)} className={inputClasses} placeholder="John Doe" />
              </div>
              <div>
                <label className={labelClasses}>Age</label>
                <input type="number" required value={age} onChange={(e)=>setAge(e.target.value)} className={inputClasses} placeholder="e.g. 21" />
              </div>
              <div>
                <label className={labelClasses}>Education Level</label>
                <select value={educationLevel} onChange={(e)=>{setEducationLevel(e.target.value); setEducationSubOption('');}} className={`${inputClasses} appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-no-repeat bg-[position:right_1rem_center]`}>
                  <option value="">Select Level (Optional)</option>
                  {Object.keys(eduOptions).map(level => (<option key={level} value={level}>{level}</option>))}
                </select>
              </div>
              <div>
                <label className={labelClasses}>Major / Class</label>
                <select value={educationSubOption} onChange={(e)=>setEducationSubOption(e.target.value)} disabled={!educationLevel} className={`${inputClasses} appearance-none disabled:opacity-50 disabled:cursor-not-allowed ${educationLevel ? `cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-no-repeat bg-[position:right_1rem_center]` : ''}`}>
                  <option value="">Select Option</option>
                  {educationLevel && eduOptions[educationLevel].map(opt => (<option key={opt} value={opt}>{opt}</option>))}
                </select>
              </div>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
              <label className={labelClasses}>Email Address</label>
              <input type="email" required value={email} onChange={handleEmailChange} className={`${inputClasses} ${emailError ? '!border-red-300 !ring-red-500/20 focus:!border-red-500' : ''}`} placeholder="you@example.com" />
              {emailError && <p className="text-xs text-red-500 font-bold mt-1.5 ml-1">{emailError}</p>}
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
              <label className={labelClasses}>Secure Password</label>
              <input type="password" required value={password} onChange={handlePasswordChange} className={`${inputClasses} ${passwordError ? '!border-red-300 !ring-red-500/20 focus:!border-red-500' : ''}`} placeholder="••••••••" />
              {passwordError && <p className="text-xs text-red-500 font-bold mt-1.5 ml-1">{passwordError}</p>}
              
              <div className="flex items-center gap-2 mt-3 ml-1">
                <input type="checkbox" id="staySignedInReg" checked={staySignedIn} onChange={(e) => setStaySignedIn(e.target.checked)} className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500/30 transition-all cursor-pointer"/>
                <label htmlFor="staySignedInReg" className="text-sm font-bold text-slate-600 cursor-pointer select-none">Stay signed in</label>
              </div>
            </div>

            <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
              <button type="submit" disabled={loading || !!emailError || !!passwordError || !email || !password} className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-[0_10px_20px_-10px_rgba(79,70,229,0.5)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2 text-base">
                {loading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : null}
                Send Verification Code
              </button>
            </div>
          </form>
        )}

        {view === 'register-otp' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-both">
              <label className={labelClasses}>Verification Code</label>
              <input type="text" required value={otp} onChange={(e)=>setOtp(e.target.value.replace(/\D/g, ''))} maxLength={6} className={`${inputClasses} text-xl text-center tracking-[0.5em] py-3 font-black placeholder:tracking-normal placeholder:font-semibold placeholder:text-sm`} placeholder="Enter 6 digits" />
              <div className="mt-2 text-center text-xs font-bold">
                {resendCooldown > 0 ? (
                  <span className="text-slate-400">Resend OTP in {resendCooldown}s</span>
                ) : (
                  <button type="button" onClick={handleResendOtp} disabled={loading} className="text-indigo-600 hover:text-indigo-500 transition-colors disabled:opacity-60">Resend OTP</button>
                )}
              </div>
            </div>

            <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
              <button type="submit" disabled={loading || otp.length !== 6} className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-[0_10px_20px_-10px_rgba(79,70,229,0.5)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2 text-base">
                {loading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : null}
                Verify & Create Account
              </button>
            </div>
          </form>
        )}

        {view === 'reset' && (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-both">
              <label className={labelClasses}>Email Address</label>
              <input type="email" required value={email} onChange={handleEmailChange} className={`${inputClasses} ${emailError ? '!border-red-300 !ring-red-500/20 focus:!border-red-500' : ''}`} placeholder="you@example.com" />
              {emailError && <p className="text-xs text-red-500 font-bold mt-1.5 ml-1">{emailError}</p>}
            </div>

            <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
              <button type="submit" disabled={loading || !!emailError || !email} className="w-full py-3 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white font-bold rounded-xl shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2 text-base">
                {loading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : null}
                Send Reset Link
              </button>
            </div>
          </form>
        )}
        
        <div className="mt-6 text-center text-sm font-bold text-slate-500 animate-in fade-in duration-700 delay-500 fill-mode-both">
          {view === 'login' ? (
            <p>Don't have an account? <button type="button" onClick={() => { setView('register-details'); setError(''); }} className="text-indigo-600 hover:text-indigo-500 transition-colors ml-1">Sign up</button></p>
          ) : view === 'register-details' || view === 'register-otp' ? (
            <p>Already have an account? <button type="button" onClick={() => { setView('login'); setError(''); setSuccessMsg(''); setResendCooldown(0); }} className="text-indigo-600 hover:text-indigo-500 transition-colors ml-1">Log in</button></p>
          ) : (
            <button type="button" onClick={() => { setView('login'); setError(''); setSuccessMsg(''); }} className="text-slate-600 hover:text-slate-900 transition-colors flex items-center justify-center gap-2 w-full"><ArrowRight className="rotate-180" size={16}/> Back to login</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// NORMAL MODE VIEWS — upload screen and results dashboard
// ============================================================================
function ResultsDashboardView({ data, isDark, onReset, normalFiles, onStartQuiz, onStartFlashcards }) {
  const [showPdf, setShowPdf] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  if (!data) return null;

  return (
    <div className="w-full animate-in fade-in duration-700">
      <div className={`relative z-40 pt-2 pb-6 mb-6 border-b transition-colors duration-300 animate-in fade-in slide-in-from-top-4 duration-700 ${isDark ? 'border-white/10' : 'border-slate-200'}`} style={{ animationDelay: '100ms' }} >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-3xl font-bold"><FormattedText content={data.title || "Analysis Complete"} /></h2>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowPdf(!showPdf)} className={`flex items-center gap-2 text-sm px-5 py-2.5 rounded-full font-bold transition-all ${showPdf ? (isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100') : (isDark ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-blue-50 text-blue-600 hover:bg-blue-100')}`}>
              <FileText size={18} /> {showPdf ? 'Hide Documents' : 'View Documents'}
            </button>
            <button onClick={onReset} className={`text-sm px-5 py-2.5 rounded-full font-medium transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'}`}>Upload New File(s)</button>
          </div>
        </div>

        {!showPdf && (
          <div className="grid grid-cols-2 gap-4 mt-6 animate-in fade-in zoom-in duration-700" style={{ animationDelay: '200ms' }}>
            <button onClick={() => onStartQuiz(data)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-transform hover:scale-105 flex items-center justify-center gap-2"><ListChecks size={20} /> Start Quiz</button>
            <button onClick={() => onStartFlashcards(data)} className={`w-full py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-slate-50 text-blue-600 shadow-sm border border-blue-100'}`}><BrainCircuit size={20} /> Flashcards</button>
          </div>
        )}
      </div>

      <div className={`flex flex-col xl:flex-row mb-8 w-full transition-all duration-500 ${showPdf ? 'gap-8' : 'gap-0'}`}>
        <div className={`transition-all duration-500 ease-in-out flex flex-col rounded-3xl shadow-sm animate-in fade-in slide-in-from-bottom-6 duration-700 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} ${showPdf ? 'h-[700px] xl:w-1/2 border opacity-100 sticky top-[100px]' : 'h-0 xl:h-[700px] w-full xl:w-0 border-0 opacity-0 overflow-hidden'}`} style={{ animationDelay: '200ms' }}>
          <div className="w-full h-full flex flex-col min-w-[300px]">
            <div className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-3 flex-shrink-0 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center gap-3"><FileText className="text-blue-500" size={20} /><h3 className="font-bold whitespace-nowrap">Source Documents</h3></div>
              {normalFiles && normalFiles.length > 1 && (
                <div className="flex bg-slate-200/50 dark:bg-slate-800/50 rounded-lg p-1 overflow-x-auto max-w-[50%]">
                  {normalFiles.map((file, idx) => (
                    <button key={idx} onClick={() => setActiveIdx(idx)} className={`px-3 py-1 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${activeIdx === idx ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Doc {idx + 1}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 w-full bg-slate-100 dark:bg-slate-800">
              {normalFiles && normalFiles[activeIdx] ? <iframe src={`${normalFiles[activeIdx].url}#toolbar=0`} className="w-full h-full rounded-b-3xl" title="PDF Viewer" /> : <div className="w-full h-full flex items-center justify-center text-slate-500">Preview Not Available</div>}
            </div>
          </div>
        </div>

        <div className={`transition-all duration-500 ease-in-out flex flex-col ${showPdf ? 'w-full xl:w-1/2' : 'w-full'}`}>
          {showPdf && (
            <div className="flex-shrink-0 grid grid-cols-2 gap-4 mb-6 animate-in fade-in zoom-in duration-700">
              <button onClick={() => onStartQuiz(data)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-transform hover:scale-105 flex items-center justify-center gap-2"><ListChecks size={20} /> Start Quiz</button>
              <button onClick={() => onStartFlashcards(data)} className={`w-full py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-slate-50 text-blue-600 border border-blue-100 shadow-sm'}`}><BrainCircuit size={20} /> Flashcards</button>
            </div>
          )}

          <div className="space-y-6">
            <div className={`p-6 rounded-3xl border animate-in fade-in slide-in-from-bottom-6 duration-700 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`} style={{ animationDelay: '300ms' }}>
              <div className="flex items-center gap-3 mb-5 text-blue-500"><Quote size={24} /><h3 className="text-xl font-bold">Key Takeaways</h3></div>
              <ul className="space-y-4">
                {data.summary_points?.map((point, idx) => (
                  <li key={idx} className="flex gap-4 items-start animate-in slide-in-from-right-4 fade-in duration-500" style={{ animationDelay: `${400 + idx * 100}ms`, animationFillMode: 'both' }}>
                    <div className="mt-2.5 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                    <div className={`text-lg leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      <FormattedText content={point} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {data.formulas && data.formulas.length > 0 && (
              <div className={`p-6 rounded-3xl border animate-in fade-in slide-in-from-bottom-6 duration-700 overflow-x-hidden ${isDark ? 'bg-purple-900/10 border-purple-500/20' : 'bg-purple-50 border-purple-100 shadow-sm'}`} style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
                <div className="flex items-center gap-3 mb-5 text-purple-500"><Sparkles size={24} /><h3 className="text-xl font-bold">Key Formulas</h3></div>
                <div className="space-y-4">
                  {data.formulas.map((item, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl border overflow-x-hidden ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-white border-purple-50'}`}>
                      <div className="flex justify-between items-start mb-3"><h4 className="font-bold text-lg"><FormattedText content={item.name} /></h4></div>
                      <div className={`p-4 rounded-xl mb-3 font-mono text-center text-lg shadow-inner overflow-x-auto ${isDark ? 'bg-black/50 text-purple-300' : 'bg-purple-100/50 text-purple-700'}`}>
                        <MathRenderer math={item.equation} block={true} />
                      </div>
                      {item.explanation && <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}><FormattedText content={item.explanation} /></div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeView({ isDark, uploadStatus, handleDrag, handleDrop, dragActive, handleFileUpload, analysisResult, onReset, normalFiles, onStartQuiz, onStartFlashcards }) {
  return (
    <div className="w-full flex justify-center">
      <div className={`w-full transition-all duration-700 ${uploadStatus === 'complete' ? 'max-w-7xl' : 'max-w-4xl'}`}>
        {uploadStatus === 'idle' && (
          <div onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} className={`transition-transform duration-300 w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 ${dragActive ? 'scale-105' : ''}`} style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
            <input type="file" id="file-upload" className="hidden" accept=".pdf" multiple onChange={(e) => { if (e.target.files && e.target.files.length > 0) { handleFileUpload(Array.from(e.target.files)); } }} />
            <label htmlFor="file-upload" className="block w-full"><UploadCard isDark={isDark} icon={<FileText size={48} className="text-blue-500" />} title="Upload Study Material" desc="Drag & drop your PDF(s) here. Upload up to 5 files!" accentColor="blue" isUploaded={false} dragActive={dragActive} /></label>
          </div>
        )}
        {uploadStatus === 'processing' && <ProcessingIndicator isDark={isDark} text="Analyzing Materials..." />}
        {uploadStatus === 'complete' && <ResultsDashboardView data={analysisResult} isDark={isDark} onReset={onReset} normalFiles={normalFiles} onStartQuiz={onStartQuiz} onStartFlashcards={onStartFlashcards} />}
      </div>
    </div>
  );
}

// ============================================================================
// EXAM MODE VIEWS — upload screen, results dashboard, predicted-question accordion
// ============================================================================
function QuestionAccordion({ q, isDark, animDelay }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={`border rounded-2xl overflow-hidden transition-all animate-in fade-in slide-in-from-bottom-4 duration-500 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white shadow-sm'}`} style={{ animationDelay: `${animDelay}ms`, animationFillMode: 'both' }}>
      <button onClick={() => setIsOpen(!isOpen)} className={`w-full text-left p-5 flex justify-between items-start gap-4 transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
        <div className="font-bold flex flex-col sm:flex-row sm:items-center gap-3">
          <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold tracking-wide border ${q.marks >= 8 ? (isDark ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-orange-50 text-orange-600 border-orange-200') : (isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-600 border-blue-200')}`}>{q.marks} Marks</span>
          <div className={`text-lg leading-snug ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            <FormattedText content={q.question} />
          </div>
        </div>
        <div className={`mt-1 flex-shrink-0 p-1.5 rounded-full ${isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
      </button>
      {isOpen && (
        <div className={`p-6 border-t animate-in fade-in slide-in-from-top-2 duration-300 ${isDark ? 'border-white/10 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}>
          <h4 className={`text-sm font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Detailed Answer</h4>
          <div className={`leading-relaxed space-y-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <FormattedText content={q.answer} />
          </div>
        </div>
      )}
    </div>
  );
}

function ExamResultsDashboard({ data, isDark, onReset, notesPdfUrls, pyqsPdfUrls, onStartQuiz, onStartFlashcards }) {
  const [showPdf, setShowPdf] = useState(false);
  const [activeGroup, setActiveGroup] = useState('notes'); 
  const [activeIdx, setActiveIdx] = useState(0);

  if (!data) return null;

  const sortedQuestions = [...(data.predictedQuestions || [])].sort((a, b) => a.marks - b.marks);
  const currentUrl = activeGroup === 'notes' ? notesPdfUrls[activeIdx]?.url : pyqsPdfUrls[activeIdx]?.url;

  return (
    <div className="w-full animate-in fade-in duration-700 pb-12">
      <div className={`relative z-40 pt-2 pb-6 mb-8 border-b transition-colors duration-300 animate-in fade-in slide-in-from-top-4 duration-700 ${isDark ? 'border-white/10' : 'border-slate-200'}`} style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-1"><FormattedText content={data.title || "Exam Strategy Generated"} /></h2>
            <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>Based on semantic cross-referencing of Notes and PYQs.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowPdf(!showPdf)} className={`flex items-center gap-2 text-sm px-5 py-2.5 rounded-full font-bold transition-all ${showPdf ? (isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100') : (isDark ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-blue-50 text-blue-600 hover:bg-blue-100')}`}><FileText size={18} /> {showPdf ? 'Hide PDFs' : 'View PDFs'}</button>
            <button onClick={onReset} className={`text-sm px-6 py-2.5 rounded-full font-bold transition-colors flex items-center gap-2 ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 shadow-sm'}`}><RotateCcw size={16} /> Retake / New Files</button>
          </div>
        </div>
        {!showPdf && (
          <div className="mt-6 grid grid-cols-2 gap-4 animate-in fade-in zoom-in duration-700" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
            <button onClick={() => onStartQuiz()} className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-500/30 transition-transform hover:scale-105 flex items-center justify-center gap-2"><ListChecks size={20} /> Start Master Quiz</button>
            <button onClick={() => onStartFlashcards(data)} className={`w-full py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-slate-50 text-blue-600 shadow-sm border border-blue-100'}`}><BrainCircuit size={20} /> Flashcards</button>
          </div>
        )}
      </div>

      <div className={`flex flex-col xl:flex-row mb-8 w-full transition-all duration-500 ${showPdf ? 'gap-8' : 'gap-0'}`}>
        <div className={`transition-all duration-500 ease-in-out flex flex-col rounded-3xl shadow-sm animate-in fade-in slide-in-from-bottom-6 duration-700 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} ${showPdf ? 'h-[700px] xl:w-1/2 border opacity-100 sticky top-[100px]' : 'h-0 xl:h-[700px] w-full xl:w-0 border-0 opacity-0 overflow-hidden'}`} style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          <div className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-3 flex-shrink-0 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'}`}>
            <div className="flex items-center gap-3"><FileText className="text-blue-500" size={20} /><h3 className="font-bold whitespace-nowrap">Source Documents</h3></div>
            <div className="flex bg-slate-200/50 dark:bg-slate-800/50 rounded-lg p-1 overflow-x-auto gap-1 max-w-[50%]">
              {notesPdfUrls.map((_, idx) => (
                <button key={`n-${idx}`} onClick={() => { setActiveGroup('notes'); setActiveIdx(idx); }} className={`px-3 py-1 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${activeGroup === 'notes' && activeIdx === idx ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Notes {idx > 0 ? idx + 1 : ''}</button>
              ))}
              {pyqsPdfUrls.map((_, idx) => (
                <button key={`p-${idx}`} onClick={() => { setActiveGroup('pyqs'); setActiveIdx(idx); }} className={`px-3 py-1 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${activeGroup === 'pyqs' && activeIdx === idx ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>PYQs {idx > 0 ? idx + 1 : ''}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 w-full bg-slate-100 dark:bg-slate-800">
            {currentUrl ? <iframe src={`${currentUrl}#toolbar=0`} className="w-full h-full rounded-b-3xl" title="PDF Viewer" /> : <div className="w-full h-full flex items-center justify-center text-slate-500">Preview Not Available</div>}
          </div>
        </div>

        <div className={`transition-all duration-500 ease-in-out flex flex-col ${showPdf ? 'w-full xl:w-1/2' : 'w-full'}`}>
          {showPdf && (
            <div className="flex-shrink-0 grid grid-cols-2 gap-4 mb-6 animate-in fade-in zoom-in duration-700">
              <button onClick={() => onStartQuiz()} className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-500/30 transition-transform hover:scale-105 flex items-center justify-center gap-2"><ListChecks size={20} /> Start Master Quiz</button>
              <button onClick={() => onStartFlashcards(data)} className={`w-full py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-slate-50 text-blue-600 border border-blue-100 shadow-sm'}`}><BrainCircuit size={20} /> Flashcards</button>
            </div>
          )}

          <div className="space-y-8">
            <div className={`grid grid-cols-1 ${showPdf ? '' : 'lg:grid-cols-2'} gap-6`}>
              <div className={`p-6 rounded-3xl border animate-in fade-in slide-in-from-bottom-6 duration-700 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`} style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
                <div className="flex items-center gap-3 mb-6 text-orange-500"><Star size={24} className="fill-orange-500/20" /><h3 className="text-xl font-bold text-slate-900 dark:text-white">High Yield Topics</h3></div>
                <p className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>These topics appear most frequently in your PYQs and are heavily weighted in your notes.</p>
                <div className="flex flex-wrap gap-2">
                  {data.highYieldTopics?.map((topic, idx) => (
                    <span key={idx} className={`px-4 py-2 rounded-xl text-sm font-semibold border ${isDark ? 'bg-orange-500/10 border-orange-500/20 text-orange-200' : 'bg-orange-50 border-orange-200 text-orange-800'}`}><FormattedText content={topic} /></span>
                  ))}
                </div>
              </div>
              
              <div className={`p-6 rounded-3xl border animate-in fade-in slide-in-from-bottom-6 duration-700 ${isDark ? 'bg-indigo-900/20 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100 shadow-sm'}`} style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
                 <h4 className="font-bold mb-4 flex items-center gap-2 text-indigo-600 dark:text-indigo-400"><Target size={18} /> Strategic Insights</h4>
                 <ul className="space-y-3">
                   {data.strategicInsights?.map((insight, idx) => (
                     <li key={idx} className={`text-sm flex items-start gap-3 leading-relaxed ${isDark ? 'text-indigo-200/80' : 'text-indigo-900/80'}`}>
                        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0"></div>
                        <div className="flex-1"><FormattedText content={insight} /></div>
                     </li>
                   ))}
                   {(!data.strategicInsights || data.strategicInsights.length === 0) && (
                     <li className={`text-sm leading-relaxed ${isDark ? 'text-indigo-200/70' : 'text-indigo-900/70'}`}>
                       Focus on understanding the systemic architecture and trade-offs. The PYQs show a strong preference for conceptual clarity.
                     </li>
                   )}
                 </ul>
              </div>

              {data.formulas && data.formulas.length > 0 && (
                <div className={`p-6 rounded-3xl border animate-in fade-in slide-in-from-bottom-6 duration-700 overflow-x-hidden ${showPdf ? '' : 'lg:col-span-2'} ${isDark ? 'bg-purple-900/10 border-purple-500/20' : 'bg-purple-50 border-purple-100 shadow-sm'}`} style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
                  <div className="flex items-center gap-3 mb-5 text-purple-500"><Sparkles size={24} /><h3 className="text-xl font-bold">Key Formulas</h3></div>
                  <div className={`grid grid-cols-1 ${showPdf ? '' : 'md:grid-cols-2'} gap-4`}>
                    {data.formulas.map((item, idx) => (
                      <div key={idx} className={`p-4 rounded-2xl border overflow-x-hidden ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-white border-purple-50'}`}>
                        <div className="flex justify-between items-start mb-3"><h4 className="font-bold text-lg"><FormattedText content={item.name} /></h4></div>
                        <div className={`p-4 rounded-xl mb-3 font-mono text-center text-lg shadow-inner overflow-x-auto ${isDark ? 'bg-black/50 text-purple-300' : 'bg-purple-100/50 text-purple-700'}`}>
                          <MathRenderer math={item.equation} block={true} />
                        </div>
                        {item.explanation && <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}><FormattedText content={item.explanation} /></div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={`p-6 rounded-3xl border animate-in fade-in slide-in-from-bottom-6 duration-700 w-full ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`} style={{ animationDelay: '600ms', animationFillMode: 'both' }}>
              <div className="flex items-center gap-3 mb-6 text-blue-500"><FileQuestion size={24} /><h3 className="text-xl font-bold text-slate-900 dark:text-white">Predicted Exam Questions</h3></div>
              <div className="space-y-4">
                {sortedQuestions.map((q, idx) => <QuestionAccordion key={q.id} q={q} isDark={isDark} animDelay={700 + idx * 100} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExamModeView({ isDark, notesFiles, setNotesFiles, pyqsFiles, setPyqsFiles, onGenerateStrategy }) {
  const canGenerateStrategy = notesFiles.length > 0 && pyqsFiles.length > 0;

  return (
    <div className="w-full max-w-4xl flex flex-col items-center">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-10">
        <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          <input type="file" id="notes-upload" className="hidden" accept=".pdf" multiple onChange={(e) => { if (e.target.files && e.target.files.length > 0) setNotesFiles(Array.from(e.target.files)); }} />
          <label htmlFor="notes-upload" className="block w-full"><UploadCard isDark={isDark} icon={<FileText size={40} className="text-indigo-400" />} title={notesFiles.length > 0 ? "Notes Uploaded" : "1. Upload Notes"} desc={notesFiles.length > 0 ? (notesFiles.length > 1 ? `${notesFiles.length} files selected` : notesFiles[0].name) : "Select multiple chapter PDFs if needed (Maximum 5)."} accentColor="indigo" isUploaded={notesFiles.length > 0} /></label>
        </div>
        <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
          <input type="file" id="pyqs-upload" className="hidden" accept=".pdf" multiple onChange={(e) => { if (e.target.files && e.target.files.length > 0) setPyqsFiles(Array.from(e.target.files)); }} />
          <label htmlFor="pyqs-upload" className="block w-full"><UploadCard isDark={isDark} icon={<UploadCloud size={40} className="text-purple-400" />} title={pyqsFiles.length > 0 ? "PYQs Uploaded" : "2. Upload PYQs"} desc={pyqsFiles.length > 0 ? (pyqsFiles.length > 1 ? `${pyqsFiles.length} files selected` : pyqsFiles[0].name) : "Select multiple PYQ PDFs if needed (Maximum 5)."} accentColor="purple" isUploaded={pyqsFiles.length > 0} /></label>
        </div>
      </div>
      <button disabled={!canGenerateStrategy} onClick={onGenerateStrategy} className={`px-10 py-4 rounded-full font-bold flex items-center gap-3 transition-all duration-300 transform animate-in fade-in zoom-in duration-700 ${canGenerateStrategy ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:scale-105 cursor-pointer' : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5 opacity-80'}`} style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
        <BrainCircuit size={20} />{canGenerateStrategy ? 'Generate Exam Strategy' : 'Upload Documents to Proceed'}
      </button>
    </div>
  );
}

// ============================================================================
// QUIZ VIEW — interactive MCQ quiz runner
// ============================================================================
function QuizView({ isDark, questions, onExitQuiz, onFinishQuiz }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (quizFinished || isAnswerChecked) return;
    if (timeLeft === 0) { setIsAnswerChecked(true); return; }
    const timer = setInterval(() => { setTimeLeft(prev => prev - 1); }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isAnswerChecked, quizFinished]);

  if (!questions || questions.length === 0) {
    return (
      <div className={`w-full max-w-2xl mx-auto p-12 text-center rounded-3xl border ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200'}`}>
        <AlertCircle size={48} className="mx-auto mb-4 text-orange-500" />
        <h2 className="text-2xl font-bold mb-2">Not enough data</h2>
        <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>The document didn't contain enough clear content to generate a quiz.</p>
        <button onClick={onExitQuiz} className="px-6 py-2 bg-blue-600 text-white rounded-full font-bold">Back to Dashboard</button>
      </div>
    );
  }

  const currentQ = questions[currentIdx];

  const handleCheckAnswer = () => {
    if (selectedOption === null) return;
    setIsAnswerChecked(true);
    if (selectedOption === currentQ.correctIndex && timeLeft > 0) setScore(score + 1);
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1); setSelectedOption(null); setIsAnswerChecked(false); setTimeLeft(30);
    } else {
      setQuizFinished(true); if (onFinishQuiz) onFinishQuiz();
    }
  };

  if (quizFinished) {
    return (
      <div className={`w-full max-w-2xl mx-auto p-12 text-center rounded-3xl border animate-in fade-in zoom-in-95 duration-700 shadow-xl ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200'}`}>
        <div className="w-24 h-24 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center mx-auto mb-6"><Target size={48} /></div>
        <h2 className="text-4xl font-black mb-2">Quiz Complete!</h2>
        <p className={`text-xl mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>You scored {score} out of {questions.length}</p>
        <button onClick={onExitQuiz} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold shadow-lg transition-transform hover:scale-105">Return to Dashboard</button>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-3xl mx-auto rounded-3xl shadow-xl ${isDark ? 'bg-slate-900 text-white border border-white/10' : 'bg-white border border-slate-200'}`}>
      <div className={`p-5 flex items-center justify-between ${isDark ? 'border-white/10' : 'border-slate-100'} border-b animate-in fade-in slide-in-from-top-4 duration-700`} style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
        <button onClick={onExitQuiz} className={`text-sm font-semibold flex items-center gap-2 hover:underline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><ArrowRight className="rotate-180" size={16} /> Exit</button>
        <span className={`text-sm font-bold px-4 py-1.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{currentIdx + 1} / {questions.length}</span>
        <div className={`flex items-center gap-2 text-sm font-bold ${timeLeft <= 5 && !isAnswerChecked ? 'text-red-500 animate-pulse' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}><Timer size={18} /> 0:{timeLeft.toString().padStart(2, '0')}</div>
      </div>
      <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 animate-in fade-in duration-700" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
        <div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${((currentIdx) / questions.length) * 100}%` }} />
      </div>
      <div className="p-6 md:p-10">
        <div className="text-xl md:text-2xl font-bold mb-8 leading-snug text-center animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          <FormattedText content={currentQ.question} />
        </div>
        <div className="space-y-3 mb-8">
          {currentQ.options.map((option, idx) => {
            let stateStyle = isDark ? 'bg-slate-800 border-white/10 hover:bg-slate-700' : 'bg-white border-slate-200 hover:bg-slate-50 shadow-sm';
            if (isAnswerChecked) {
              if (idx === currentQ.correctIndex) { stateStyle = isDark ? 'bg-green-500/20 border-green-500 text-green-300' : 'bg-green-50 border-green-500 text-green-700'; } 
              else if (idx === selectedOption) { stateStyle = isDark ? 'bg-red-500/20 border-red-500 text-red-300' : 'bg-red-50 border-red-500 text-red-700'; } 
              else { stateStyle = isDark ? 'bg-slate-800/50 border-white/5 opacity-50' : 'bg-slate-50 border-slate-200 opacity-50'; }
            } else if (selectedOption === idx) {
              stateStyle = isDark ? 'bg-blue-500/20 border-blue-500' : 'bg-blue-100 border-blue-300';
            }
            return (
              <button key={idx} disabled={isAnswerChecked} onClick={() => setSelectedOption(idx)} className={`w-full text-left px-5 py-4 rounded-2xl border-2 transition-all duration-200 flex items-center justify-between animate-in fade-in slide-in-from-left-4 duration-500 ${stateStyle}`} style={{ animationDelay: `${400 + idx * 100}ms`, animationFillMode: 'both' }}>
                <span className="font-medium text-[15px]"><FormattedText content={option} /></span>
                {isAnswerChecked && idx === currentQ.correctIndex && <CheckCircle className="text-green-500" size={20} />}
                {isAnswerChecked && idx === selectedOption && idx !== currentQ.correctIndex && <XCircle className="text-red-500" size={20} />}
              </button>
            );
          })}
        </div>
        <div className="flex justify-center pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: `${400 + currentQ.options.length * 100 + 100}ms`, animationFillMode: 'both' }}>
          {!isAnswerChecked ? (
            <button onClick={handleCheckAnswer} disabled={selectedOption === null} className={`w-full md:w-auto px-12 py-3.5 rounded-full font-bold transition-all ${selectedOption !== null ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'}`}>Check Answer</button>
          ) : (
            <button onClick={handleNext} className="w-full md:w-auto px-12 py-3.5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-full font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-xl animate-in zoom-in duration-300">
              {currentIdx < questions.length - 1 ? 'Next Question' : 'Finish Quiz'} <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FLASHCARDS VIEW — flip-card revision UI (cloud-synced decks)
// ============================================================================
function FlashcardsView({ isDark, flashcards, deckMetadata, onRevisionComplete, onStopRevision, onExit }) {
  const [stack, setStack] = useState([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [animatingCard, setAnimatingCard] = useState(null);
  const [viewedCards, setViewedCards] = useState(new Set());
  const [revisionLogged, setRevisionLogged] = useState(false);

  useEffect(() => { 
    if (flashcards && flashcards.length > 0) setStack(flashcards.map((_, i) => i)); 
  }, [flashcards]);

  useEffect(() => {
    if (flashcards && stack.length > 0) {
      setViewedCards(prev => {
        const newSet = new Set(prev);
        newSet.add(stack[0]);
        return newSet;
      });
    }
  }, [stack, flashcards]);

  const hasViewedAll = viewedCards.size === (flashcards?.length || 0);

  const colorPalettes = [
    { front: 'from-blue-500 to-indigo-600', back: 'from-indigo-600 to-blue-700' },
    { front: 'from-emerald-400 to-teal-600', back: 'from-teal-600 to-emerald-700' },
    { front: 'from-rose-400 to-pink-600', back: 'from-pink-600 to-rose-700' },
    { front: 'from-amber-400 to-orange-600', back: 'from-orange-600 to-amber-700' },
    { front: 'from-violet-500 to-purple-600', back: 'from-purple-600 to-violet-800' }
  ];

  const handleNext = useCallback(() => {
    if (animatingCard !== null || stack.length === 0) return;
    setIsFlipped(false); setAnimatingCard(stack[0]);
    setTimeout(() => { setStack(prev => [...prev.slice(1), prev[0]]); setAnimatingCard(null); }, 300);
  }, [animatingCard, stack]);

  const handlePrev = useCallback(() => {
    if (animatingCard !== null || stack.length === 0) return;
    setIsFlipped(false); setStack(prev => [prev[prev.length - 1], ...prev.slice(0, prev.length - 1)]);
  }, [animatingCard, stack]);

  const handleKeyDown = useCallback((e) => {
    if (e.code === 'Space') { e.preventDefault(); setIsFlipped(prev => !prev); } 
    else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') handleNext();
    else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') handlePrev();
  }, [handleNext, handlePrev]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!flashcards || flashcards.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 animate-in fade-in slide-in-from-top-4 duration-700" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
        <button onClick={onExit} className={`px-4 py-2 rounded-full font-semibold flex items-center gap-2 transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'}`}><ArrowRight className="rotate-180" size={18} /> Exit</button>
        <div className={`px-5 py-2 rounded-full font-bold text-sm ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600 shadow-sm'}`}>Card {stack[0] + 1} of {flashcards.length}</div>
        <div className={`flex items-center gap-2 text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><span className="hidden sm:inline">Use Arrow Keys & Spacebar</span></div>
      </div>
      
      <div className="relative w-full h-[380px] cursor-pointer group animate-in fade-in zoom-in-95 duration-700" style={{ perspective: '1200px', animationDelay: '200ms', animationFillMode: 'both' }}>
        {flashcards.map((card, originalIndex) => {
          const depth = stack.indexOf(originalIndex);
          const isAnimatingOut = animatingCard === originalIndex;
          const visualDepth = Math.min(depth, 3);
          let transformStr = `translateY(${visualDepth * 20}px) scale(${1 - visualDepth * 0.04})`;
          let opacity = depth > 2 ? 0 : 1 - (depth * 0.15); 
          if (isAnimatingOut) { transformStr = `translateX(120%) rotateZ(15deg) translateY(-50px)`; opacity = 0; }
          const colors = colorPalettes[originalIndex % colorPalettes.length];
          return (
            <div key={originalIndex} className="absolute top-0 left-0 w-full h-full transition-all duration-500 ease-out" style={{ transform: transformStr, opacity: opacity, zIndex: isAnimatingOut ? 100 : 50 - depth, pointerEvents: depth === 0 ? 'auto' : 'none' }}>
               <div className="w-full h-full relative transition-transform duration-700 ease-[cubic-bezier(0.4,0.0,0.2,1)]" style={{ transformStyle: 'preserve-3d', transform: (isFlipped && depth === 0) ? 'rotateY(180deg)' : 'rotateY(0deg)' }} onClick={() => { if(depth === 0) setIsFlipped(!isFlipped); }}>
                  <div className={`absolute inset-0 rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] bg-gradient-to-br ${colors.front} text-white p-10 flex flex-col justify-center items-center border border-white/20`} style={{ backfaceVisibility: 'hidden' }}>
                     <span className="absolute top-8 left-8 text-white/50 font-bold tracking-widest text-sm uppercase">Term</span>
                     <div className="text-3xl md:text-5xl font-black text-center leading-tight drop-shadow-md">
                       <FormattedText content={card.term} />
                     </div>
                     <div className="absolute bottom-8 flex items-center gap-2 text-sm font-medium text-white/70 animate-pulse"><RotateCcw size={16} /> Click to flip</div>
                  </div>
                  <div className={`absolute inset-0 rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] bg-gradient-to-br ${colors.back} text-white p-8 md:p-12 flex flex-col justify-center items-center border border-white/20 overflow-y-auto`} style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                     <span className="absolute top-8 left-8 text-white/50 font-bold tracking-widest text-sm uppercase">Definition</span>
                     <div className="text-lg md:text-2xl font-medium text-center leading-relaxed drop-shadow-sm mt-8">
                       <FormattedText content={card.definition} />
                     </div>
                  </div>
               </div>
            </div>
          )
        })}
      </div>
      
      <div className="relative z-[150] flex flex-col items-center justify-center gap-6 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
        <div className="flex items-center gap-6">
           <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className={`p-4 rounded-full transition-all shadow-lg ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-slate-50 text-slate-800'}`}><ChevronLeft size={28} /></button>
           <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className={`p-4 rounded-full transition-all shadow-lg ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-slate-50 text-slate-800'}`}><ChevronRight size={28} /></button>
        </div>

        {hasViewedAll && deckMetadata && !revisionLogged && (
           <div className="flex flex-col sm:flex-row gap-4 mt-2 animate-in zoom-in">
             <button
                onClick={() => {
                   if (onRevisionComplete) onRevisionComplete(deckMetadata.id);
                   setRevisionLogged(true);
                }}
                className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold shadow-[0_0_20px_rgba(52,211,153,0.4)] transition-all hover:scale-105 flex items-center justify-center gap-2"
             >
                <CheckCircle size={20} /> Mark Revision Complete
             </button>
             
             {!deckMetadata.stopRevision && (
               <button
                  onClick={() => {
                     if (onStopRevision) onStopRevision(deckMetadata.id);
                     if (onExit) onExit();
                  }}
                  className="px-8 py-3.5 bg-slate-600 hover:bg-slate-500 text-white rounded-full font-bold shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2"
               >
                  <XCircle size={20} /> Stop Reminders
               </button>
             )}
           </div>
        )}
        {revisionLogged && (
           <div className="px-8 py-3.5 mt-2 bg-emerald-500/20 border border-emerald-500/50 text-emerald-600 dark:text-emerald-400 rounded-full font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={20} /> Revision Logged Successfully
           </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PROFILE VIEW — account settings, statistics, and saved (cloud) decks
// ============================================================================
function ActivityGraph({ isDark, graphAnim }) {
  const weekData = [
    { day: 'Mon', val: 40 }, { day: 'Tue', val: 70 }, { day: 'Wed', val: 45 }, 
    { day: 'Thu', val: 90 }, { day: 'Fri', val: 65 }, { day: 'Sat', val: 100 }, { day: 'Sun', val: 30 }
  ];

  const points = weekData.map((d, i) => [i * 100, 180 - (d.val / 100 * 180)]); 
  let pathD = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const x0 = points[i][0], y0 = points[i][1];
    const x1 = points[i+1][0], y1 = points[i+1][1];
    const xc = (x0 + x1) / 2;
    pathD += ` C ${xc},${y0} ${xc},${y1} ${x1},${y1}`;
  }
  const fillD = `${pathD} L 600,180 L 0,180 Z`;
  const yLabels = [100, 75, 50, 25, 0];

  return (
    <div className="relative w-full h-[220px] flex mt-4">
      <div className="flex flex-col justify-between h-[180px] pr-4 text-xs font-bold text-slate-400">
        {yLabels.map(label => <span key={label}>{label}</span>)}
      </div>
      <div className="relative flex-1 h-[180px]">
        <div className="absolute inset-0 flex flex-col justify-between h-[180px] pointer-events-none">
          {yLabels.map((_, i) => <div key={i} className={`w-full border-b ${isDark ? 'border-white/5' : 'border-slate-200/50'}`}></div>)}
        </div>
        <svg viewBox="0 0 600 180" preserveAspectRatio="none" className="w-full h-[180px] overflow-visible z-10 relative">
          <defs>
            <linearGradient id="gradientFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isDark ? '#6366f1' : '#3b82f6'} stopOpacity="0.4" />
              <stop offset="100%" stopColor={isDark ? '#6366f1' : '#3b82f6'} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fillD} fill="url(#gradientFill)" className="transition-opacity duration-1000 ease-in-out" style={{ opacity: graphAnim ? 1 : 0 }} />
          <path d={pathD} fill="none" stroke={isDark ? '#818cf8' : '#3b82f6'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-1500 ease-out" style={{ strokeDasharray: 2000, strokeDashoffset: graphAnim ? 0 : 2000 }} />
        </svg>
        <div className="absolute inset-0 z-20 pointer-events-none h-[180px]">
          {points.map((p, i) => (
            <div key={i} className={`absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full border-2 transition-all duration-700 ease-out ${isDark ? 'bg-slate-900 border-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]' : 'bg-white border-blue-500 shadow-md'}`} style={{ left: `${(i / 6) * 100}%`, top: `${p[1]}px`, opacity: graphAnim ? 1 : 0, transform: `scale(${graphAnim ? 1 : 0})`, transitionDelay: `${500 + i * 100}ms` }} />
          ))}
        </div>
        <div className="absolute top-[195px] left-0 right-0 h-6">
          {weekData.map((d, i) => <span key={d.day} className="absolute text-xs font-bold text-slate-400 -translate-x-1/2" style={{ left: `${(i / 6) * 100}%` }}>{d.day}</span>)}
        </div>
      </div>
    </div>
  );
}

function ProfileView({ isDark, userData, setUserData, profileTab, onLogout, onLaunchSavedDeck }) {
  const [formData, setFormData] = useState({
    email: userData?.email || '',
    name: userData?.name || '',
    age: userData?.age || '',
    educationLevel: userData?.educationLevel || '',
    educationSubOption: userData?.educationSubOption || '',
    usePersonalContext: userData?.usePersonalContext ?? true,
    storeFlashcards: userData?.storeFlashcards ?? true,
    emailReminders: userData?.emailReminders ?? true,
    newPassword: ''
  });
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [passwordError, setPasswordError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [graphAnim, setGraphAnim] = useState(false);
  const [savedDecks, setSavedDecks] = useState([]);
  const [decksLoading, setDecksLoading] = useState(false);

  useEffect(() => { 
    setFormData(prev => ({
      ...prev, ...userData, 
      usePersonalContext: userData?.usePersonalContext ?? true,
      storeFlashcards: userData?.storeFlashcards ?? true,
      emailReminders: userData?.emailReminders ?? true
    })); 
    
    if (userData?.email) {
       setDecksLoading(true);
       fetch(`${API_BASE}/flashcards/decks?email=${encodeURIComponent(userData.email)}`)
         .then(res => res.ok ? res.json() : [])
         .then(decks => setSavedDecks(decks))
         .catch(() => setSavedDecks([]))
         .finally(() => setDecksLoading(false));
    }
  }, [userData]);
  
  useEffect(() => { if (profileTab === 'stats') { setGraphAnim(false); setTimeout(() => setGraphAnim(true), 150); } }, [profileTab]);

  const eduOptions = {
    'School': ['Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    'Bachelors': ['Engineering', 'MBBS', 'Arts', 'Science', 'Commerce', 'Law', 'Other'],
    'Masters': ['M.Tech', 'MD', 'MBA', 'M.Sc', 'MA', 'M.Com', 'Other'],
    'PhD': ['Computer Science', 'Physics', 'Biology', 'Literature', 'Other']
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setFormData({...formData, newPassword: val});
    if (val.length > 0) {
      setPasswordError(validatePassword(val));
    } else {
      setPasswordError('');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault(); 
    if (passwordError) return;
    
    setIsSaving(true); setStatus({ type: '', msg: '' });
    
    const submitData = { ...formData, name: formatName(formData.name) };
    
    try {
      const res = await fetch(`${API_BASE}/profile/update`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submitData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update profile");
      setUserData(prev => ({ ...prev, ...submitData }));
      setStatus({ type: 'success', msg: 'Profile updated successfully in MongoDB!' });
      setFormData(prev => ({ ...prev, newPassword: '' }));
      setPasswordError('');
    } catch (err) { setStatus({ type: 'error', msg: err.message }); }
    setIsSaving(false);
  };

  const handleDeleteDeck = async (deckId) => {
     const previous = savedDecks;
     setSavedDecks(previous.filter(d => d.id !== deckId));
     try {
       const res = await fetch(`${API_BASE}/flashcards/decks/${deckId}?email=${encodeURIComponent(userData.email)}`, {
         method: 'DELETE'
       });
       if (!res.ok) throw new Error('Failed to delete deck');
     } catch (err) {
       setSavedDecks(previous);
     }
  }

  return (
    <div className="w-full max-w-6xl mx-auto pt-8 pb-12">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-10">
        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-4xl text-white shadow-lg flex-shrink-0 animate-in fade-in zoom-in duration-700" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
          {userData?.name ? userData.name.charAt(0).toUpperCase() : 'U'}
        </div>
        <div className="text-center md:text-left animate-in fade-in slide-in-from-right-4 duration-700" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          <h2 className="text-4xl font-bold mb-2">{userData?.name || 'Student'}</h2>
          <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{userData?.educationLevel ? `${userData.educationLevel} ${userData.educationSubOption ? `• ${userData.educationSubOption}` : ''}` : 'Set up your educational profile below'}</p>
        </div>
      </div>

      {profileTab === 'stats' && (
        <div className="space-y-8">
          <div className={`p-8 rounded-3xl border animate-in fade-in slide-in-from-bottom-6 duration-700 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`} style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
            <h3 className="text-xl font-bold mb-8 flex items-center gap-2"><TrendingUp className="text-emerald-500" /> Weekly Activity</h3>
            <ActivityGraph isDark={isDark} graphAnim={graphAnim} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatPopCard visible={true} delay={400} isDark={isDark} icon={<Activity className="text-emerald-500" />} title="Study Streak" value={userData?.studyStreak || 0} suffix=" Days" />
            <StatPopCard visible={true} delay={500} isDark={isDark} icon={<BrainCircuit className="text-purple-500" />} title="Cards Learned" value={userData?.totalCardsLearned || 0} />
            <StatPopCard visible={true} delay={600} isDark={isDark} icon={<FileText className="text-blue-500" />} title="Docs Processed" value={userData?.docsProcessed || 0} />
            <StatPopCard visible={true} delay={700} isDark={isDark} icon={<Layers className="text-indigo-500" />} title="PYQs Analyzed" value={userData?.pyqsAnalyzed || 0} />
            <StatPopCard visible={true} delay={800} isDark={isDark} icon={<Star className="text-orange-500" />} title="Strategies Generated" value={userData?.strategiesGenerated || 0} />
            <StatPopCard visible={true} delay={900} isDark={isDark} icon={<Target className="text-rose-500" />} title="Quizzes Taken" value={userData?.quizzesTaken || 0} />
          </div>
        </div>
      )}

      {profileTab === 'details' && (
        <div className={`p-8 rounded-3xl border animate-in fade-in slide-in-from-bottom-6 duration-700 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`} style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          <h3 className="text-2xl font-bold mb-8 flex items-center gap-3"><PenTool className="text-blue-500" /> Account Management</h3>
          {status.msg && <div className={`p-4 mb-8 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-500 ${status.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800' : 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800'}`}><AlertCircle size={20} className="mt-0.5 shrink-0" /><p className="font-medium text-sm leading-relaxed">{status.msg}</p></div>}
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Full Name</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-all ${isDark ? 'bg-slate-900/50 border-white/10 focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 focus:border-blue-300'}`} placeholder="Enter your name" />
              </div>
              <div className="space-y-2">
                <label className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Age</label>
                <input type="number" required value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-all ${isDark ? 'bg-slate-900/50 border-white/10 focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 focus:border-blue-300'}`} placeholder="e.g. 21" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Current Education</label>
                <select value={formData.educationLevel} onChange={(e) => setFormData({...formData, educationLevel: e.target.value, educationSubOption: ''})} className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none ${isDark ? 'bg-slate-900/50 border-white/10 focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 focus:border-blue-300'}`}>
                  <option value="">Select Level</option>
                  {Object.keys(eduOptions).map(level => (<option key={level} value={level}>{level}</option>))}
                </select>
              </div>
              <div className="space-y-2">
                <label className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{formData.educationLevel === 'School' ? 'Class' : 'Major / Stream'}</label>
                <select value={formData.educationSubOption} onChange={(e) => setFormData({...formData, educationSubOption: e.target.value})} disabled={!formData.educationLevel} className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none ${!formData.educationLevel ? 'opacity-50 cursor-not-allowed' : ''} ${isDark ? 'bg-slate-900/50 border-white/10 focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 focus:border-blue-300'}`}>
                  <option value="">Select Option</option>
                  {formData.educationLevel && eduOptions[formData.educationLevel].map(opt => (<option key={opt} value={opt}>{opt}</option>))}
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              <div className={`p-5 rounded-2xl border flex flex-col justify-between ${isDark ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'}`}>
                <div className="mb-4">
                  <h4 className={`font-bold flex items-center gap-2 ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}><Sparkles size={18}/> Personal Context</h4>
                  <p className={`text-sm mt-1 ${isDark ? 'text-indigo-200/70' : 'text-indigo-900/70'}`}>Use your age and education level to document prompts to tailor complexity.</p>
                </div>
                <button type="button" onClick={() => setFormData({...formData, usePersonalContext: !formData.usePersonalContext})} className={`w-14 h-7 shrink-0 rounded-full transition-colors relative ${formData.usePersonalContext ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${formData.usePersonalContext ? 'translate-x-8' : 'translate-x-1'}`} />
                </button>
              </div>
              
              <div className={`p-5 rounded-2xl border flex flex-col justify-between ${isDark ? 'bg-amber-900/20 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
                <div className="mb-4">
                  <h4 className={`font-bold flex items-center gap-2 ${isDark ? 'text-amber-300' : 'text-amber-800'}`}><Database size={18}/> Local Deck Storage</h4>
                  <p className={`text-sm mt-1 ${isDark ? 'text-amber-200/70' : 'text-amber-900/70'}`}>Automatically save generated flashcards to your device for Spaced Repetition.</p>
                </div>
                <button type="button" onClick={() => setFormData({...formData, storeFlashcards: !formData.storeFlashcards})} className={`w-14 h-7 shrink-0 rounded-full transition-colors relative ${formData.storeFlashcards ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${formData.storeFlashcards ? 'translate-x-8' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className={`p-5 rounded-2xl border flex flex-col justify-between ${!formData.storeFlashcards ? 'opacity-50 pointer-events-none' : ''} ${isDark ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="mb-4">
                  <h4 className={`font-bold flex items-center gap-2 ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}><Bell size={18}/> Ebbinghaus Emails</h4>
                  <p className={`text-sm mt-1 ${isDark ? 'text-emerald-200/70' : 'text-emerald-900/70'}`}>Receive intelligent email reminders to revise cards based on Ebbinghaus Spaced Repetition.</p>
                </div>
                <button type="button" onClick={() => setFormData({...formData, emailReminders: !formData.emailReminders})} className={`w-14 h-7 shrink-0 rounded-full transition-colors relative ${formData.emailReminders ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${formData.emailReminders ? 'translate-x-8' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <div className={`mt-8 pt-6 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
              <div className="space-y-2 max-w-md">
                <label className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}><Lock size={16} /> New Password</label>
                <input type="password" value={formData.newPassword} onChange={handlePasswordChange} className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-all ${isDark ? 'bg-slate-900/50 border-white/10 focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 focus:border-blue-300'}`} placeholder="Leave blank to keep current" />
                {passwordError && <p className="text-xs text-red-500 font-medium mt-1">{passwordError}</p>}
              </div>
            </div>
            <div className="pt-4">
              <button type="submit" disabled={isSaving || !!passwordError} className={`px-8 py-3.5 rounded-xl font-bold text-white transition-all transform ${isSaving || !!passwordError ? 'bg-slate-400 cursor-not-allowed opacity-70' : 'bg-blue-600 hover:bg-blue-500 hover:scale-105 shadow-lg shadow-blue-500/30'}`}>
                {isSaving ? 'Saving Changes...' : 'Save Preferences'}
              </button>
            </div>
          </form>
        </div>
      )}

      {profileTab === 'decks' && (
        <div className={`animate-in fade-in slide-in-from-bottom-6 duration-700`} style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
           
           <EbbinghausCurve isDark={isDark} />
           
           <div className={`p-8 rounded-3xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
             <h3 className="text-2xl font-bold mb-8 flex items-center gap-3"><BookOpen className="text-amber-500" /> Saved Flashcards</h3>
             {decksLoading ? (
               <div className="text-center py-12">
                 <p className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading your decks from the cloud...</p>
               </div>
             ) : savedDecks.length === 0 ? (
               <div className="text-center py-12">
                 <Database className={`mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} size={48} />
                 <p className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No saved flashcards found.</p>
                 <p className={`text-sm mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Generate some in Normal or Exam mode and they will appear here.</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {savedDecks.map((deck) => {
                   const isOverdue = deck.nextRevisionDate && Date.now() > deck.nextRevisionDate;
                   const daysOverdue = isOverdue ? Math.floor((Date.now() - deck.nextRevisionDate) / (1000 * 60 * 60 * 24)) : 0;
                   
                   return (
                     <div key={deck.id} className={`flex flex-col p-6 rounded-2xl border transition-all hover:scale-105 cursor-pointer shadow-sm group ${isDark ? 'bg-slate-900 border-white/10 hover:border-amber-500/50' : 'bg-slate-50 border-slate-200 hover:border-amber-300 hover:shadow-md'}`} onClick={() => onLaunchSavedDeck(deck)}>
                       <div className="flex justify-between items-start mb-4">
                         <h4 className="font-bold text-lg leading-tight line-clamp-2 pr-2">{deck.title}</h4>
                         <button onClick={(e) => { e.stopPropagation(); handleDeleteDeck(deck.id); }} className={`p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100 ${isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-100 text-red-500'}`} title="Delete Deck">
                           <XCircle size={18} />
                         </button>
                       </div>
                       
                       <div className="mt-auto space-y-3">
                         <div className="flex flex-wrap items-center gap-2">
                           <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}>
                             <BrainCircuit size={14} /> {deck.cards.length} Cards
                           </div>
                           <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
                             Rev: {deck.revisionCount || 0}
                           </div>
                         </div>
                         
                         {deck.stopRevision ? (
                            <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg text-center ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                              Revisions Stopped
                            </div>
                         ) : deck.nextRevisionDate && (
                           <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg text-center ${isOverdue ? (isDark ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-red-50 text-red-600 border border-red-200') : (isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600')}`}>
                             {isOverdue 
                               ? `Days past revision date: ${daysOverdue === 0 ? 'a few hours' : `${daysOverdue}`}. Revise Now!` 
                               : `Next revision on ${new Date(deck.nextRevisionDate).toLocaleDateString()}`
                             }
                           </div>
                         )}
                       </div>
                     </div>
                   );
                 })}
               </div>
             )}
           </div>
        </div>
      )}

      <div className="mt-16 pt-8 border-t border-slate-200 dark:border-white/10 flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
        <button onClick={onLogout} className={`px-10 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all duration-300 transform hover:scale-105 ${isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 shadow-sm'}`}>
          <LogOut size={20} /> Log Out Securely
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// APP ROOT — session state, view routing, and all backend-facing handlers
// ============================================================================
export default function App() {
  const [userData, setUserData] = useState(() => {
    const sessionSaved = sessionStorage.getItem('smartstudy_user');
    if (sessionSaved) return JSON.parse(sessionSaved);
    const localSaved = localStorage.getItem('smartstudy_user');
    return localSaved ? JSON.parse(localSaved) : null;
  }); 
  const [mode, setMode] = useState('normal'); 
  const [profileTab, setProfileTab] = useState('details'); 
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [isScrolled, setIsScrolled] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const [normalUploadStatus, setNormalUploadStatus] = useState('idle'); 
  const [analysisResult, setAnalysisResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [normalFiles, setNormalFiles] = useState([]);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [flashcardData, setFlashcardData] = useState([]);
  const [activeDeck, setActiveDeck] = useState(null);
  const [launchedFromProfile, setLaunchedFromProfile] = useState(false);

  const [notesFiles, setNotesFiles] = useState([]);
  const [pyqsFiles, setPyqsFiles] = useState([]);
  const [examStatus, setExamStatus] = useState('idle');
  const [examResult, setExamResult] = useState(null);
  const [notesPdfUrls, setNotesPdfUrls] = useState([]);
  const [pyqsPdfUrls, setPyqsPdfUrls] = useState([]);
  
  const [notifications, setNotifications] = useState([]);
  
  const statsRef = useRef(null);
  const isDark = mode === 'exam';
  const isHomeScreen = (mode === 'normal' && normalUploadStatus === 'idle') || (mode === 'exam' && examStatus === 'idle');
  const isToolActive = normalUploadStatus === 'quiz' || normalUploadStatus === 'flashcards' || examStatus === 'quiz' || examStatus === 'flashcards' || mode === 'profile';
  const isProcessing = normalUploadStatus === 'processing' || examStatus === 'processing';

  // Inject Google Font
  useEffect(() => {
    if (!document.getElementById('google-font-jakarta')) {
      const link = document.createElement('link');
      link.id = 'google-font-jakarta';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (userData) {
      if (userData.staySignedIn) {
        localStorage.setItem('smartstudy_user', JSON.stringify(userData));
        sessionStorage.removeItem('smartstudy_user');
      } else {
        sessionStorage.setItem('smartstudy_user', JSON.stringify(userData));
        localStorage.removeItem('smartstudy_user');
      }
    } else {
      localStorage.removeItem('smartstudy_user');
      sessionStorage.removeItem('smartstudy_user');
    }
  }, [userData]);

  // AFK Inactivity Timer
  useEffect(() => {
    if (!userData || userData.staySignedIn) return;
    
    let inactivityTimer;
    
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        setUserData(null);
        setErrorMessage("You have been automatically logged out due to 30 minutes of inactivity for your security.");
      }, 30 * 60 * 1000); 
    };

    const activeEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
    activeEvents.forEach(event => window.addEventListener(event, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);
      activeEvents.forEach(event => window.removeEventListener(event, resetInactivityTimer));
    };
  }, [userData]);

  useEffect(() => {
    if (!userData?.email || userData.storeFlashcards === false) return;

    // One-time legacy localStorage -> cloud deck migration
    const legacyDecksKey = `smartstudy_decks_${userData.email}`;
    const legacyDecksRaw = localStorage.getItem(legacyDecksKey);

    const fetchOverdueDecks = () => {
      fetch(`${API_BASE}/flashcards/decks?email=${encodeURIComponent(userData.email)}`)
        .then(res => res.ok ? res.json() : [])
        .then(decks => {
          const overdueDecks = decks.filter(d => d.nextRevisionDate && Date.now() > d.nextRevisionDate && !d.stopRevision);

          if (overdueDecks.length > 0) {
            const overdueMsg = overdueDecks.length === 1
              ? `You haven't revised "${overdueDecks[0].title}" for ${Math.max(1, Math.floor((Date.now() - overdueDecks[0].nextRevisionDate) / (1000*60*60*24)))} day(s).`
              : `You haven't revised ${overdueDecks.length} multiple flashcards past their due date.`;

            setNotifications([{ id: Date.now(), msg: overdueMsg }]);

            if (userData.emailReminders !== false) {
               const emailThrottleKey = `last_reminder_email_${userData.email}`;
               const lastEmailSent = localStorage.getItem(emailThrottleKey);

               if (!lastEmailSent || Date.now() - parseInt(lastEmailSent) > (24 * 60 * 60 * 1000)) {
                  fetch(`${API_BASE}/reminders/dispatch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      email: userData.email,
                      subject: "NexusPrep - Time to Revise!",
                      message: `${overdueMsg}\n\nLog in now to revise your flashcards and maintain your memory retention at 100% using the Ebbinghaus curve.\n\nKeep up the great work!`
                    })
                  }).then(res => {
                     if(res.ok) localStorage.setItem(emailThrottleKey, Date.now().toString());
                  }).catch(console.error);
               }
            }
          }
        })
        .catch(console.error);
    };

    if (legacyDecksRaw) {
      let legacyDecks = [];
      try { legacyDecks = JSON.parse(legacyDecksRaw); } catch { legacyDecks = []; }

      if (Array.isArray(legacyDecks) && legacyDecks.length > 0) {
        fetch(`${API_BASE}/flashcards/decks/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userData.email, decks: legacyDecks })
        })
          .then(() => localStorage.removeItem(legacyDecksKey))
          .catch(console.error)
          .finally(fetchOverdueDecks);
        return;
      }
      localStorage.removeItem(legacyDecksKey);
    }

    fetchOverdueDecks();
  }, [userData]);


  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      if (statsRef.current) {
        const rect = statsRef.current.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.95) setStatsVisible(true);
      }
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); 
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 5) { setErrorMessage("Maximum of 5 files allowed per upload."); return; }
      handleFileUpload(files);
    }
  };

  const handleStatsIncrement = async (statName, value) => {
    if(!userData?.email) return;
    try {
      const res = await fetch(`${API_BASE}/stats/increment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userData.email, stat: statName, value: value })
      });
      if (res.ok) setUserData(prev => ({ ...prev, [statName]: (prev[statName] || 0) + value }));
    } catch(e) { console.error("Stat update failed", e); }
  };

  const handleFileUpload = async (filesArray) => {
    if (!filesArray || filesArray.length === 0) return;
    if (filesArray.length > 5) { setErrorMessage("Maximum of 5 study material PDFs allowed."); return; }
    setNormalUploadStatus('processing'); setErrorMessage("");
    const fileObjects = filesArray.map(file => ({ name: file.name, url: URL.createObjectURL(file) }));
    setNormalFiles(fileObjects);

    const formData = new FormData();
    filesArray.forEach(file => formData.append("files", file));
    if (userData?.usePersonalContext) {
      formData.append("userContext", JSON.stringify({ name: userData.name, age: userData.age, educationLevel: userData.educationLevel, educationSubOption: userData.educationSubOption }));
    }

    try {
      const response = await fetch(`${API_BASE}/summarize`, { method: "POST", body: formData });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "API extraction encountered an issue.");
      }
      const resultData = await response.json();
      setAnalysisResult(resultData); setNormalUploadStatus('complete');
      await handleStatsIncrement('docsProcessed', filesArray.length);
    } catch (err) {
      setErrorMessage(err.message || "Failed to reach AI Backend."); setNormalUploadStatus('idle');
    }
  };

  const resetUpload = () => { setNormalUploadStatus('idle'); setNormalFiles([]); };

  const handleStartQuiz = (data) => {
    if (!data.definitions || data.definitions.length === 0) return;
    const generatedQuiz = data.definitions.slice(0, 15).map(def => {
      const allTerms = data.definitions.map(d => d.term);
      let wrongOptions = allTerms.filter(t => t !== def.term).sort(() => 0.5 - Math.random()).slice(0, 3);
      while(wrongOptions.length < 3) wrongOptions.push(`Concept ${Math.floor(Math.random() * 100)}`);
      const options = [...wrongOptions, def.term].sort(() => 0.5 - Math.random());
      return { question: `What is the correct term for: "${def.definition || def.def}"?`, options: options, correctIndex: options.indexOf(def.term) };
    });
    setQuizQuestions(generatedQuiz); 
    
    if (mode === 'exam') setExamStatus('quiz');
    else setNormalUploadStatus('quiz');
  };

  const handleStartFlashcards = async (data, sourceName = "Generated Material") => {
    if (!data.definitions || data.definitions.length === 0) return;
    const generatedCards = data.definitions.map(def => ({ term: def.term, definition: def.definition || def.def }));
    setFlashcardData(generatedCards); 
    
    let newDeck = null;
    if (userData?.storeFlashcards !== false) {
       const deckTitle = data.title || sourceName.replace('.pdf', ''); 
       try {
         const res = await fetch(`${API_BASE}/flashcards/decks`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email: userData.email, title: deckTitle, cards: generatedCards })
         });
         if (res.ok) newDeck = await res.json();
       } catch (err) {
         console.error('Failed to save deck to the cloud:', err);
       }
    }

    setActiveDeck(newDeck);

    if (mode === 'exam') setExamStatus('flashcards');
    else setNormalUploadStatus('flashcards');
  };

  const handleLaunchSavedDeck = (deck) => {
    setFlashcardData(deck.cards);
    setActiveDeck(deck);
    setLaunchedFromProfile(true);
    setNormalUploadStatus('flashcards');
    setMode('normal'); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRevisionComplete = async (deckId) => {
     if (!userData?.email) return;
     try {
       const res = await fetch(`${API_BASE}/flashcards/decks/${deckId}/revision`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ email: userData.email })
       });
       if (!res.ok) throw new Error('Failed to update deck');
       const deck = await res.json();

       setActiveDeck(deck);

       setNotifications(prev => [{
           id: Date.now(),
           msg: `You've successfully revised "${deck.title}". Next revision in ${getNextRevisionInterval(deck.revisionCount)} days!`
       }, ...prev]);
     } catch (err) {
       console.error('Failed to record revision:', err);
     }
  };

  const handleStopRevision = async (deckId) => {
     if (!userData?.email) return;
     try {
       const res = await fetch(`${API_BASE}/flashcards/decks/${deckId}/stop`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ email: userData.email })
       });
       if (!res.ok) throw new Error('Failed to update deck');
       const deck = await res.json();

       setActiveDeck(deck);

       setNotifications(prev => [{
           id: Date.now(),
           msg: `Future reminders stopped for "${deck.title}".`
       }, ...prev]);
     } catch (err) {
       console.error('Failed to stop revision:', err);
     }
  };

  const handleGenerateStrategy = async () => {
    if (notesFiles.length === 0 || pyqsFiles.length === 0) return;
    if (notesFiles.length > 5 || pyqsFiles.length > 5) { setErrorMessage("Maximum of 5 PDFs per category (Notes/PYQs)."); return; }
    setExamStatus('processing'); setErrorMessage("");
    setNotesPdfUrls(notesFiles.map(f => ({ name: f.name, url: URL.createObjectURL(f) })));
    setPyqsPdfUrls(pyqsFiles.map(f => ({ name: f.name, url: URL.createObjectURL(f) })));

    const formData = new FormData();
    notesFiles.forEach(file => formData.append("notes_files", file));
    pyqsFiles.forEach(file => formData.append("pyqs_files", file));
    if (userData?.usePersonalContext) {
      formData.append("userContext", JSON.stringify({ name: userData.name, age: userData.age, educationLevel: userData.educationLevel, educationSubOption: userData.educationSubOption }));
    }

    try {
      const response = await fetch(`${API_BASE}/exam-strategy`, { method: "POST", body: formData });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "API extraction encountered an issue.");
      }
      const resultData = await response.json();
      setExamResult(resultData); setExamStatus('complete');
      await handleStatsIncrement('docsProcessed', notesFiles.length + pyqsFiles.length);
      await handleStatsIncrement('pyqsAnalyzed', pyqsFiles.length);
      await handleStatsIncrement('strategiesGenerated', 1);
    } catch (err) {
      setErrorMessage(err.message || "Failed to reach AI Backend."); setExamStatus('idle');
    }
  };

  const resetExamMode = () => {
    setNotesFiles([]); setPyqsFiles([]); setNotesPdfUrls([]); setPyqsPdfUrls([]); setExamStatus('idle'); setExamResult(null);
  };

  if (!userData) { return <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}><AuthView onLoginSuccess={(data) => setUserData(data)} /></div>; }

  return (
    <div className={`min-h-screen flex flex-col overflow-x-clip transition-colors duration-700 relative ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <DynamicBackground isDark={isDark} isPaused={!isHomeScreen} />
      
      <div className="fixed top-24 right-6 z-[100] flex flex-col gap-3">
        {notifications.map(notif => (
          <div key={notif.id} className={`p-4 rounded-xl shadow-lg border flex items-start gap-3 w-80 animate-in fade-in slide-in-from-right-8 duration-500 ${isDark ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
            <Bell className="text-blue-500 shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h4 className="font-bold text-sm mb-1">Spaced Repetition</h4>
              <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{notif.msg}</p>
            </div>
            <button onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))} className="text-slate-400 hover:text-slate-600"><XCircle size={16}/></button>
          </div>
        ))}
      </div>
      
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 animate-in fade-in slide-in-from-top-4 duration-1000 ${isScrolled ? (isDark ? 'bg-slate-950/80 border-b border-white/10 backdrop-blur-xl shadow-lg' : 'bg-white/80 border-b border-slate-200 backdrop-blur-xl shadow-sm') : 'bg-transparent border-b border-transparent'}`}>
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between relative">
          <div 
            className={`flex items-center gap-3 group ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} 
            onClick={() => { 
              if (isProcessing) return;
              setMode('normal'); 
              setNormalUploadStatus('idle'); 
              setExamStatus('idle'); 
              window.scrollTo({ top: 0, behavior: 'smooth' }); 
            }}
          >
            <div className={`p-2 rounded-xl transition-colors duration-500 ${isDark ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white shadow-lg'}`}><BrainCircuit size={28} /></div>
            <h1 className="text-2xl font-bold tracking-tight">NexusPrep</h1>
          </div>

          {(isHomeScreen || mode === 'profile') && (
            <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 animate-in fade-in zoom-in duration-700" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
              <div className={`flex items-center p-1 rounded-full border transition-all duration-500 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 shadow-sm border-slate-200'}`}>
                {mode !== 'profile' ? (
                  <div className="relative flex">
                    <div className={`absolute top-0 bottom-0 w-1/2 rounded-full transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isDark ? 'translate-x-full bg-purple-600' : 'translate-x-0 bg-blue-600'}`} />
                    <button onClick={() => { setMode('normal'); setExamStatus('idle'); }} className={`relative z-10 flex items-center justify-center gap-2 w-44 py-2.5 text-sm font-semibold transition-colors duration-500 ${!isDark ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}><BookOpen size={18} /> Normal Mode</button>
                    <button onClick={() => { setMode('exam'); setNormalUploadStatus('idle'); }} className={`relative z-10 flex items-center justify-center gap-2 w-44 py-2.5 text-sm font-semibold transition-colors duration-500 ${isDark ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}><GraduationCap size={18} /> Exam Mode</button>
                  </div>
                ) : (
                  <div className="relative flex">
                    <div className={`absolute top-0 bottom-0 w-1/3 rounded-full transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${profileTab === 'stats' ? 'translate-x-full bg-indigo-600' : profileTab === 'decks' ? 'translate-x-[200%] bg-indigo-600' : 'translate-x-0 bg-indigo-600'}`} />
                    <button onClick={() => setProfileTab('details')} className={`relative z-10 flex items-center justify-center gap-2 w-36 py-2.5 text-sm font-semibold transition-colors duration-500 ${profileTab === 'details' ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}><User size={18} /> Details</button>
                    <button onClick={() => setProfileTab('stats')} className={`relative z-10 flex items-center justify-center gap-2 w-36 py-2.5 text-sm font-semibold transition-colors duration-500 ${profileTab === 'stats' ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}><Activity size={18} /> Stats</button>
                    <button onClick={() => setProfileTab('decks')} className={`relative z-10 flex items-center justify-center gap-2 w-36 py-2.5 text-sm font-semibold transition-colors duration-500 ${profileTab === 'decks' ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}><Database size={18} /> Decks</button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="relative animate-in fade-in slide-in-from-right-4 duration-700" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
            {mode === 'profile' ? (
              <button onClick={() => { setMode('normal'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold transition-all ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white/80 hover:bg-slate-50 border border-slate-200 text-slate-800 shadow-sm'}`}>
                <ArrowRight className="rotate-180" size={18} /> Back to Home
              </button>
            ) : (
              <>
                <button disabled={isProcessing} onClick={() => setShowDropdown(!showDropdown)} className={`flex items-center gap-3 p-2 pr-4 rounded-full border transition-all ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white' : 'bg-white/80 border-slate-200 hover:bg-slate-50 hover:shadow-sm text-slate-800'} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-white shadow-sm">{userData.name.charAt(0)}</div>
                  <span className="font-medium text-sm hidden sm:block">{userData.name.split(' ')[0]}</span>
                  <ChevronDown size={16} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showDropdown && (
                  <div className={`absolute right-0 mt-2 w-48 rounded-xl border shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
                    <div className="p-2 space-y-1">
                      <button onClick={() => { setMode('profile'); setProfileTab('details'); setShowDropdown(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-50'}`}><User size={16} /> Profile</button>
                      <button onClick={() => setUserData(null)} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-red-500 transition-colors ${isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}><LogOut size={16} /> Log Out</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <div className={`relative z-10 flex flex-col flex-1 w-full max-w-[1400px] mx-auto px-6 transition-all duration-500 ${isToolActive ? 'pt-28 pb-4' : 'pt-40 pb-12'}`}>
        <main className="flex flex-col items-center flex-1 w-full">
          
          {errorMessage && (
            <div className={`mb-6 max-w-2xl w-full p-4 border rounded-2xl flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-2 ${errorMessage.toLowerCase().includes("validation") || errorMessage.toLowerCase().includes("mismatch") ? "bg-orange-100 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800 text-orange-800 dark:text-orange-300" : "bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300"}`}>
              <AlertCircle className="flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-bold text-base">{errorMessage.toLowerCase().includes("validation") || errorMessage.toLowerCase().includes("mismatch") ? "Invalid Study Materials" : "System Error"}</p>
                <p className="mt-1 opacity-90 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {isHomeScreen && mode === 'normal' && (
            <div className="max-w-4xl mx-auto w-full text-center mb-16 animate-in fade-in slide-in-from-bottom-6 duration-1000">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>Master your material.</h2>
              <p className="text-lg md:text-xl max-w-2xl mx-auto text-slate-500 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>Upload your notes to instantly generate intelligent summaries and study flashcards.</p>
            </div>
          )}
          
          {isHomeScreen && mode === 'exam' && (
            <div className="max-w-4xl mx-auto w-full text-center mb-16 animate-in fade-in slide-in-from-bottom-6 duration-1000">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>Prepare for Greatness.</h2>
              <p className="text-lg md:text-xl max-w-2xl mx-auto text-slate-400 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>Upload your notes and PYQs to unlock expected questions and strategic exam insights.</p>
            </div>
          )}

          {mode === 'profile' ? (
             <ProfileView isDark={isDark} userData={userData} setUserData={setUserData} profileTab={profileTab} onLogout={() => setUserData(null)} onLaunchSavedDeck={handleLaunchSavedDeck} />
          ) : mode === 'normal' ? (
            normalUploadStatus === 'quiz' ? (
              <QuizView isDark={isDark} questions={quizQuestions} onExitQuiz={() => setNormalUploadStatus('complete')} onFinishQuiz={() => handleStatsIncrement('quizzesTaken', 1)} />
            ) : normalUploadStatus === 'flashcards' ? (
              <FlashcardsView 
                 isDark={isDark} 
                 flashcards={flashcardData} 
                 deckMetadata={activeDeck} 
                 onRevisionComplete={handleRevisionComplete} 
                 onStopRevision={handleStopRevision}
                 onExit={() => { 
                    if (launchedFromProfile) {
                      setMode('profile');
                      setProfileTab('decks');
                      setLaunchedFromProfile(false);
                      setNormalUploadStatus('idle');
                    } else {
                      setNormalUploadStatus('complete'); 
                    }
                    setActiveDeck(null); 
                 }} 
              />
            ) : (
              <HomeView isDark={isDark} uploadStatus={normalUploadStatus} handleDrag={handleDrag} handleDrop={handleDrop} dragActive={dragActive} handleFileUpload={handleFileUpload} analysisResult={analysisResult} onReset={resetUpload} normalFiles={normalFiles} onStartQuiz={handleStartQuiz} onStartFlashcards={(data) => handleStartFlashcards(data, normalFiles[0]?.name)} />
            )
          ) : (
            examStatus === 'idle' ? (
              <ExamModeView isDark={isDark} notesFiles={notesFiles} setNotesFiles={setNotesFiles} pyqsFiles={pyqsFiles} setPyqsFiles={setPyqsFiles} onGenerateStrategy={handleGenerateStrategy} />
            ) : examStatus === 'processing' ? (
              <ProcessingIndicator isDark={isDark} text="Cross-Referencing Notes & PYQs..." />
            ) : examStatus === 'quiz' ? (
              <QuizView isDark={isDark} questions={examResult?.difficultQuiz} onExitQuiz={() => setExamStatus('complete')} onFinishQuiz={() => handleStatsIncrement('quizzesTaken', 1)} />
            ) : examStatus === 'flashcards' ? (
              <FlashcardsView 
                 isDark={isDark} 
                 flashcards={flashcardData} 
                 deckMetadata={activeDeck} 
                 onRevisionComplete={handleRevisionComplete}
                 onStopRevision={handleStopRevision}
                 onExit={() => { 
                    setExamStatus('complete'); 
                    setActiveDeck(null); 
                 }} 
              />
            ) : (
              <ExamResultsDashboard data={examResult} isDark={isDark} onReset={resetExamMode} notesPdfUrls={notesPdfUrls} pyqsPdfUrls={pyqsPdfUrls} onStartQuiz={() => setExamStatus('quiz')} onStartFlashcards={(data) => handleStartFlashcards(data, notesPdfUrls[0]?.name ? `Exam Prep: ${notesPdfUrls[0].name}` : "Exam Synthesis")} />
            )
          )}
        </main>

        {(!isToolActive && mode !== 'profile') && <div className="h-12"></div>}

        {(isHomeScreen && mode !== 'profile') && (
          <section ref={statsRef} className="py-12 relative animate-in fade-in duration-700">
            <div className={`text-center mb-12 transition-all duration-1000 transform ${statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
              <h3 className="text-3xl font-bold mb-3">Your Progress</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto w-full">
              {mode === 'normal' ? (
                <>
                  <StatPopCard visible={statsVisible} delay={100} isDark={isDark} icon={<Activity className="text-emerald-500" />} title="Study Streak" value={userData.studyStreak} suffix=" Days" />
                  <StatPopCard visible={statsVisible} delay={300} isDark={isDark} icon={<BrainCircuit className="text-purple-500" />} title="Cards Learned" value={userData.totalCardsLearned} />
                  <StatPopCard visible={statsVisible} delay={500} isDark={isDark} icon={<FileText className="text-blue-500" />} title="Docs Processed" value={userData.docsProcessed} />
                </>
              ) : (
                <>
                  <StatPopCard visible={statsVisible} delay={100} isDark={isDark} icon={<Layers className="text-indigo-500" />} title="PYQs Analyzed" value={userData?.pyqsAnalyzed || 0} />
                  <StatPopCard visible={statsVisible} delay={300} isDark={isDark} icon={<Star className="text-orange-500" />} title="Strategies Generated" value={userData?.strategiesGenerated || 0} />
                  <StatPopCard visible={statsVisible} delay={500} isDark={isDark} icon={<Target className="text-rose-500" />} title="Quizzes Taken" value={userData?.quizzesTaken || 0} />
                </>
              )}
            </div>
          </section>
        )}
      </div>
        
      {(!isToolActive && mode !== 'profile') && (
        <footer className={`py-8 w-full text-center text-sm transition-colors border-t mt-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ${isDark ? 'text-slate-500 border-white/5 bg-slate-950/50' : 'text-slate-400 border-slate-200 bg-white/50'}`} style={{ animationDelay: '600ms', animationFillMode: 'both' }}>
          <p className="font-medium tracking-wide">Made by Anupam Sharma</p>
        </footer>
      )}
    </div>
  );
}