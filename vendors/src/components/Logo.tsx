/** Vendo wordmark; CSS shows the white version in dark mode. */
export function Logo({ height = 26, forceWhite }: { height?: number; forceWhite?: boolean }) {
  if (forceWhite) return <img src="/brand/logo-white.png" alt="Vendo" style={{ height, width: "auto" }} />;
  return (
    <>
      <img src="/brand/logo-blue.png" alt="Vendo" className="only-light" style={{ height, width: "auto" }} />
      <img src="/brand/logo-white.png" alt="Vendo" className="only-dark" style={{ height, width: "auto" }} />
    </>
  );
}
