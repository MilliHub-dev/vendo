/**
 * Rider-side data shapes. They follow the server's rider API (server/docs/openapi.json:
 * /v1/riders/*, /v1/rider/orders/*), in camelCase. All money is integer kobo; times are ISO UTC.
 */
import type { Kobo } from '@/lib/money';

export type LatLng = { lat: number; lng: number };
export type Place = LatLng & { address: string; note?: string };

export type User = { id: string; name: string; phone: string; email: string };
export type ProfileDetails = { name: string; email: string };
export type VerifyCodeResult = { token: string; user: User | null };

export type Approval = 'pending' | 'under_review' | 'approved' | 'rejected' | 'suspended';
export type Presence = 'offline' | 'online' | 'on_trip';
export type VehicleType = 'motorcycle' | 'bicycle' | 'car';
export type DocumentKind = 'gov_id' | 'bike_registration' | 'photo';
export type DocumentStatus = 'missing' | 'submitted' | 'approved' | 'rejected';

export type RiderDocument = { kind: DocumentKind; status: DocumentStatus; note?: string };

export type Rider = {
  approval: Approval;
  approvalNote?: string;
  presence: Presence;
  cityId: string;
  vehicleType: VehicleType;
  plateNumber: string;
  rating: number;
  totalTrips: number;
  /** offers accepted ÷ offers received, 0–1 */
  acceptanceRate: number;
  documents: RiderDocument[];
};

export type RegisterRiderRequest = { cityId: string; vehicleType: VehicleType; plateNumber: string };
export type City = { id: string; name: string };

export type OrderType = 'food' | 'dispatch';
export type PackageSize = 'document' | 'small' | 'large';
export type JobStatus = 'rider_assigned' | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled';

/** A delivery offered to this rider. They have until `expiresAt` to accept. */
export type Offer = {
  id: string;
  orderId: string;
  type: OrderType;
  expiresAt: string;
  /** rider → pickup */
  distanceToPickupM: number;
  /** pickup → drop-off */
  tripDistanceM: number;
  pickup: Place;
  dropoff: Place;
  earningKobo: Kobo;
  /** food: vendor name and item count; dispatch: what the package is */
  summary: string;
};

export type Job = {
  id: string;
  code: string;
  type: OrderType;
  status: JobStatus;
  pickup: Place;
  dropoff: Place;
  /** who to hand the order to */
  contact: { name: string; phone: string };
  vendorName?: string;
  items?: { name: string; quantity: number }[];
  package?: { size: PackageSize; description: string; fragile: boolean };
  earningKobo: Kobo;
  tripDistanceM: number;
  /** dispatch: the receiver's code must be entered to complete the delivery */
  requiresCode: boolean;
  codeAttemptsLeft: number;
  acceptedAt: string;
};

export type Trip = { id: string; code: string; type: OrderType; title: string; pickup: string; dropoff: string; earningKobo: Kobo; distanceM: number; completedAt: string };

export type Earnings = {
  balanceKobo: Kobo;
  today: { trips: number; earnedKobo: Kobo };
  week: { trips: number; earnedKobo: Kobo };
  /** last 7 days, oldest first */
  days: { date: string; earnedKobo: Kobo }[];
  minWithdrawalKobo: Kobo;
};

export type WithdrawalStatus = 'pending' | 'completed' | 'failed';
export type Withdrawal = { id: string; amountKobo: Kobo; bankName: string; accountNumber: string; status: WithdrawalStatus; createdAt: string };
export type WithdrawalRequest = { amountKobo: Kobo; bankCode: string; accountNumber: string; accountName: string };
export type Bank = { code: string; name: string };

export type ChatMessage = { id: string; from: 'rider' | 'customer'; text: string; createdAt: string };
export type AppNotification = { id: string; title: string; body: string; createdAt: string };
