"use client";
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {useEffect,useState,type ReactNode} from 'react';
import {useSession} from '@/store/session';
export function Providers({children}:{children:ReactNode}){const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{staleTime:15000,retry:1}}}));
 const id=useSession(s=>s.admin?.id);useEffect(()=>{client.clear();},[id,client]);return <QueryClientProvider client={client}>{children}</QueryClientProvider>;}
