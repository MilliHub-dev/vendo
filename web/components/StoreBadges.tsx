import { AppleIcon, GooglePlayIcon } from "./BrandIcons";

// Custom "coming soon" badges. Swap for the official Apple/Google badge artwork
// (and real store URLs) once the apps are published.
export function StoreBadges() {
  return (
    <div className="store-badges">
      <span className="store-badge" aria-label="App Store — coming soon">
        <AppleIcon />
        <span>
          <small>Coming soon on the</small>
          <strong>App Store</strong>
        </span>
        <span className="soon">Soon</span>
      </span>
      <span className="store-badge" aria-label="Google Play — coming soon">
        <GooglePlayIcon />
        <span>
          <small>Coming soon on</small>
          <strong>Google Play</strong>
        </span>
        <span className="soon">Soon</span>
      </span>
    </div>
  );
}
