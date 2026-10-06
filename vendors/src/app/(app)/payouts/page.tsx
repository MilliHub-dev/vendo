"use client";
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { keys, usePayouts, useSaveBankAccount } from '@/api/queries';
import { Button, Input, Modal, Spinner } from '@/components/ui';
import { formatNaira, nairaToKobo } from '@/lib/money';
import { dayLabel } from '@/lib/dates';
export default function PayoutsPage() {
 const payouts=usePayouts(), client=useQueryClient();const [editing,setEditing]=useState(false),[amount,setAmount]=useState('');
 const withdraw=useMutation({mutationFn:()=>api.requestWithdrawal(nairaToKobo(Number(amount))),onSuccess:()=>{setAmount('');client.invalidateQueries({queryKey:keys.payouts});}});
 if(payouts.isError)return <p className="note note--danger">{payouts.error.message}</p>;
 if(!payouts.data)return <Spinner/>;
 const p=payouts.data;
 return <div className="stack"><div className="grid-2"><section className="card stack"><h2>Available earnings</h2><strong style={{fontSize:36}}>{formatNaira(p.balanceKobo)}</strong><p className="small muted">Settled earnings available for withdrawal. Pending holds are not included.</p><Input label="Withdrawal amount (₦)" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/><Button loading={withdraw.isPending} disabled={!p.account||!Number.isFinite(Number(amount))||Number(amount)<=0||nairaToKobo(Number(amount))>p.balanceKobo} onClick={()=>withdraw.mutate()}>Request withdrawal</Button>{withdraw.isError?<p className="text-danger">{withdraw.error.message}</p>:null}{withdraw.isSuccess?<p className="text-success">Withdrawal submitted for review.</p>:null}</section><section className="card stack"><h2>Bank account</h2>{p.account?<><strong>{p.account.accountName}</strong><p>Bank code {p.account.bankCode} · ••••{p.account.accountNumber}</p></>:<p className="muted">Add a bank account before requesting a withdrawal.</p>}<Button onClick={()=>setEditing(true)}>{p.account?'Change account':'Add account'}</Button></section></div><section className="card"><h2>Withdrawal history</h2>{p.history.length?<div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Status</th><th>Amount</th></tr></thead><tbody>{p.history.map(h=><tr key={h.id}><td>{dayLabel(new Date(h.date))}</td><td>{h.status.replaceAll('_',' ')}</td><td>{formatNaira(h.amountKobo)}</td></tr>)}</tbody></table></div>:<p className="muted">No withdrawal requests yet.</p>}</section>{editing?<BankModal onClose={()=>setEditing(false)}/>:null}</div>;
}
function BankModal({onClose}:{onClose:()=>void}){
 const save=useSaveBankAccount();const [bankCode,setBankCode]=useState(''),[accountNumber,setNumber]=useState('');
 return <Modal title="Bank account" onClose={onClose} footer={<Button loading={save.isPending} disabled={!/^\d{3,12}$/.test(bankCode)||!/^\d{10}$/.test(accountNumber)} onClick={()=>save.mutate({bankCode,accountNumber,accountName:''},{onSuccess:onClose})}>Verify and save</Button>}><Input label="Bank code" value={bankCode} onChange={e=>setBankCode(e.target.value.replace(/\D/g,''))} hint="Enter your bank’s Paystack bank code."/><Input label="Account number" inputMode="numeric" maxLength={10} value={accountNumber} onChange={e=>setNumber(e.target.value.replace(/\D/g,''))}/><p className="small muted">The account name is verified by the payment provider.</p>{save.isError?<p className="text-danger">{save.error.message}</p>:null}</Modal>;
}
