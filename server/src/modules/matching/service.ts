import type { Routing } from '../food/schema.js';
import type { MatchingRepository, Tracking } from './schema.js';
export class TrackingService {
  constructor(private readonly repository:MatchingRepository,private readonly routing:Routing) {}
  async get(userId:string,orderId:string,includeRoute=true):Promise<Tracking> {
    const snapshot=await this.repository.tracking(userId,orderId);
    if(!includeRoute||snapshot.location_stale||!snapshot.location||!snapshot.target)return snapshot;
    try {
      const route=await this.routing.route(snapshot.location,snapshot.target.point);
      // Revalidate ownership/state after the provider call, avoiding disclosure
      // if assignment changes or the trip ends while ETA is being computed.
      const current=await this.repository.tracking(userId,orderId);
      if(current.location_stale||!current.location||!current.target||current.rider?.id!==snapshot.rider?.id||current.target.stage!==snapshot.target.stage||current.location.captured_at!==snapshot.location.captured_at)return current;
      return {...current,eta:{target:snapshot.target.stage,distance_m:route.distance_m,duration_s:route.duration_s,computed_at:new Date().toISOString(),...(route.geometry?{geometry:route.geometry}:{})}};
    } catch {
      // GPS remains useful when road routing is unavailable. Recheck access
      // even on failure; stale location never produces a guessed ETA.
      return this.repository.tracking(userId,orderId);
    }
  }
}
