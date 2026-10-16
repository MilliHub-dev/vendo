#!/bin/sh
# Rebuilds the two preview apps from the current code (run after changing the apps), pointed at the
# sample-data API on the same site (they call /v1/… on whatever address they are opened from).
set -e
cd "$(dirname "$0")/../.."
for pair in mobile:customer-app riders:rider-app; do
  app=${pair%%:*}; out=design/preview/${pair##*:}
  (cd "$app" && npx expo export -p web --output-dir "../$out")
  grep -rl "https://api.vendoltd.com" "$out/_expo" | while read -r f; do sed -i '' 's#"https://api.vendoltd.com"#""#g' "$f"; done
done
echo "Preview rebuilt. Start it with: node design/preview/server.mjs"
