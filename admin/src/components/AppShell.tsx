"use client";
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect,useState,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from '@/api/client';
import {useSession} from '@/store/session';
import {Logo} from './Logo';
import {ThemeToggle} from './ThemeToggle';
import {Button,Spinner} from './ui';
export function useGate(wanted:'signed_out'|'signed_in'){const router=useRouter();const admin=useSession(s=>s.admin);const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);const stage=admin?'signed_in':'signed_out';useEffect(()=>{if(ready&&stage!==wanted)router.replace(stage==='signed_out'?'/login/':'/');},[ready,stage,wanted,router]);return ready&&stage===wanted;}
const nav=[['/','Overview'],['/orders/','Orders'],['/riders/','Riders'],['/vendors/','Vendors'],['/customers/','Customers'],['/payments/','Payments'],['/cities/','Cities & pricing'],['/promotions/','Promotions'],['/notifications/','Notifications'],['/analytics/','Analytics'],['/support/','Support'],['/audit/','Audit log']];
export function AppShell({children}:{children:ReactNode}){const ok=useGate('signed_in');const path=usePathname();const admin=useSession(s=>s.admin);const client=useQueryClient();const [menu,setMenu]=useState(false);const [logoutError,setLogoutError]=useState('');
 const me=useQuery({queryKey:['admin-me'],queryFn:api.me,enabled:ok,refetchInterval:30000,retry:false});
 useEffect(()=>{if(me.data)useSession.getState().signIn(me.data);},[me.data]);
 if(!ok||!admin)return <Spinner/>;
 return <div className="shell" data-menu={menu?'open':undefined}><aside className="sidebar"><div className="brand"><Logo/><span className="brand__tag">ADMIN</span></div><nav className="nav">{nav.map(([href,label])=><Link key={href} href={href} aria-current={path===href?'page':undefined} onClick={()=>setMenu(false)}><span>{label}</span></Link>)}</nav><div className="sidebar__foot"><span>{admin.name??admin.email}</span><Button variant="secondary" onClick={async()=>{if(!window.confirm('Log out of Vendo Admin?'))return;try{await api.logout();}catch{setLogoutError('The local session ended; remote logout could not be confirmed.');}finally{client.clear();}}}>Log out</Button></div></aside><div className="main"><header className="topbar"><Button size="sm" variant="ghost" onClick={()=>setMenu(!menu)}>Menu</Button><h1 className="grow">{nav.find(([href])=>href===path)?.[1]??'Vendo Admin'}</h1><ThemeToggle/></header><main className="page">{logoutError?<p role="alert">{logoutError}</p>:null}{me.isError?<div className="card stack"><p role="alert">{me.error.message}</p><Button onClick={()=>me.refetch()}>Retry access check</Button></div>:!me.data?<Spinner/>:children}</main></div></div>;
}
