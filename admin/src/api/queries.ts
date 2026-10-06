import {useQuery} from '@tanstack/react-query';
import {api,request} from './client';
import type {Row} from './types';
export const useCities=()=>useQuery({queryKey:['cities'],queryFn:()=>request<Row[]>('/v1/admin/cities')});
