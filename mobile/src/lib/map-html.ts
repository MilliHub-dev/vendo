/**
 * The page shown inside the tracking map: real streets (OpenStreetMap data, drawn by MapLibre),
 * the pickup, the drop-off, the road route between them and the rider's live position.
 * It runs in a web view on phones and an iframe on the web, and is told about changes through
 * `window.vendoMap.update(...)`.
 */
export type MapPoint = { lat: number; lng: number };
export type MapState = { pickup: MapPoint; dropoff: MapPoint; rider?: MapPoint | null; route?: [number, number][] | null };

const BIKE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.500" cy="17.500" r="3.500"/><circle cx="5.500" cy="17.500" r="3.500"/><circle cx="15" cy="5" r="1"/><path d="M12 17.500V14l-3-3 4-3 2 3h2"/></svg>';

export function mapHtml(initial: MapState, opts: { dark: boolean; primary: string; pickupLabel: string; dropoffLabel: string }): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
<style>
html,body,#map{margin:0;height:100%;width:100%;background:${opts.dark ? '#0f1830' : '#eef2f8'};font-family:-apple-system,system-ui,Roboto,sans-serif}
.pin{display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none}
.dot{width:16px;height:16px;border-radius:50%;box-sizing:border-box}
.pickup .dot{background:#fff;border:4px solid ${opts.primary}}
.dropoff .dot{background:${opts.primary};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,30,90,.35)}
.tag{max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:4px 9px;border-radius:99px;font-size:12px;font-weight:600;background:${opts.dark ? '#16213b' : '#fff'};color:${opts.dark ? '#fff' : '#0a1633'};box-shadow:0 2px 8px rgba(0,20,60,.18)}
.rider{width:40px;height:40px;border-radius:50%;background:${opts.primary};border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(0,60,180,.4)}
.maplibregl-ctrl-attrib{font-size:10px}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script>
(function(){
  var say=function(m){try{(window.ReactNativeWebView||window.parent).postMessage(JSON.stringify(m),'*')}catch(e){}};
  if(!window.maplibregl){say({type:'error'});return}
  var state=${JSON.stringify(initial)}, ready=false, riderMarker=null, fitted=0;
  var map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/${opts.dark ? 'dark' : 'positron'}',center:[state.dropoff.lng,state.dropoff.lat],zoom:13,attributionControl:{compact:true},dragRotate:false,pitchWithRotate:false});
  map.touchZoomRotate.disableRotation();
  var el=function(cls,html){var d=document.createElement('div');d.className=cls;d.innerHTML=html;return d};
  var line=function(){var r=state.route&&state.route.length>1?state.route:[[state.pickup.lng,state.pickup.lat],[state.dropoff.lng,state.dropoff.lat]];return {type:'Feature',geometry:{type:'LineString',coordinates:r},properties:{}}};
  var first=true, fit=function(force){
    // follow the rider, but don't fight someone who has moved the map themselves
    if(!force&&Date.now()-fitted<20000)return;fitted=Date.now();
    var b=new maplibregl.LngLatBounds();b.extend([state.pickup.lng,state.pickup.lat]);b.extend([state.dropoff.lng,state.dropoff.lat]);
    if(state.rider)b.extend([state.rider.lng,state.rider.lat]);(state.route||[]).forEach(function(c){b.extend(c)});
    map.fitBounds(b,{padding:{top:56,bottom:44,left:44,right:44},maxZoom:16,duration:first?0:600});first=false;
  };
  var draw=function(){
    if(!ready)return;
    map.getSource('route').setData(line());
    map.setPaintProperty('route','line-dasharray',state.route&&state.route.length>1?[1,0]:[1,1.6]);
    if(state.rider){ if(!riderMarker)riderMarker=new maplibregl.Marker({element:el('rider','${BIKE}')}).setLngLat([state.rider.lng,state.rider.lat]).addTo(map); else riderMarker.setLngLat([state.rider.lng,state.rider.lat]); }
    else if(riderMarker){riderMarker.remove();riderMarker=null}
  };
  map.on('load',function(){
    map.addSource('route',{type:'geojson',data:line()});
    map.addLayer({id:'route-glow',type:'line',source:'route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'${opts.primary}','line-opacity':0.22,'line-width':11}});
    map.addLayer({id:'route',type:'line',source:'route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'${opts.primary}','line-width':4.500}});
    new maplibregl.Marker({element:el('pin pickup','<div class="tag">${esc(opts.pickupLabel)}</div><div class="dot"></div>'),anchor:'bottom',offset:[0,8]}).setLngLat([state.pickup.lng,state.pickup.lat]).addTo(map);
    new maplibregl.Marker({element:el('pin dropoff','<div class="tag">${esc(opts.dropoffLabel)}</div><div class="dot"></div>'),anchor:'bottom',offset:[0,8]}).setLngLat([state.dropoff.lng,state.dropoff.lat]).addTo(map);
    ready=true;draw();fit(true);say({type:'ready'});
  });
  map.on('error',function(e){ if(!ready)say({type:'error'}) });
  map.on('dragstart',function(){fitted=Date.now()+60000});
  window.vendoMap={update:function(next){var moved=!state.rider!==!next.rider||!state.route!==!next.route;state=Object.assign({},state,next);draw();fit(moved)}};
  window.addEventListener('message',function(e){try{var m=typeof e.data==='string'?JSON.parse(e.data):e.data;if(m&&m.type==='vendo-map')window.vendoMap.update(m.state)}catch(err){}});
})();
</script></body></html>`;
}
