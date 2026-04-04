'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem('shop_os_token');
    router.replace(token ? '/dashboard' : '/login');
  }, []);
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0a10', color:'#475569', fontFamily:'system-ui,sans-serif', flexDirection:'column', gap:16 }}>
      <div style={{ width:48, height:48, background:'linear-gradient(135deg,#7c3aed,#3b82f6)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'white', fontSize:22 }}>S</div>
      <div>Loading...</div>
    </div>
  );
}
