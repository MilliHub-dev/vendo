export type Admin={id:string;name:string|null;email:string|null;role:'admin'};
export type Row=Record<string,unknown>;
export type Page={items:Row[];limit:number;offset:number};
