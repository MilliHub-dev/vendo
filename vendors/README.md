# Vendo vendor portal

The portal uses the live backend at `https://api.vendoltd.com`. No mock data, demo OTP or automatic approval is included.

Run `npm ci`, then `npm run dev`. Run `npm test`, `npm run typecheck` and `npm run build` before deployment. Override `NEXT_PUBLIC_API_URL` at build time if using another API environment. Never add backend secrets to this app.

Email OTP authentication uses the backend; new accounts add name and contact phone before submitting a store application. Store approval is performed by admins. Registration requires actual pickup coordinates inside an active service city. Store branding uploads use Supabase Storage through the API, with a 2 MiB limit. Menu removal means making an item unavailable, preserving historical orders and menu options. Dashboard sales count delivered orders; today's earnings reflect posted settlement ledger entries. Withdrawals require verified bank details, available settled earnings and operator approval. No weekly payment schedule or commission is invented.

Deploy backend migration `202610060013_vendor_portal.sql` and the accompanying server changes before deploying this frontend. These add persisted weekly hours, preparation/rejection details, vendor reviews and reporting. Add the vendor site's exact HTTPS origin to the server `CORS_ORIGINS`. Rebuild the frontend after changing its public API URL. The Railway Dockerfile serves the generated static export.

The browser stores access/refresh credentials in localStorage and clears query data when accounts change. A restrictive deployment CSP and protection against script injection are important; an HttpOnly cookie design would require a server-side frontend/BFF rather than this static export. The API enforces account/store authorization for every request. Background notifications are polled while the portal is open; FCM web push enrollment is not included in this portal yet.
