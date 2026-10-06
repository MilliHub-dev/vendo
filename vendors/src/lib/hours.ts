import type { DayHours } from '../api/types';
/** Suggested form values, saved only when the owner submits them. */
export const defaultHours = (): DayHours[] => Array.from({length:7}, (_,day)=>({day,open:day!==0,from:'08:00',to:'21:00'}));
