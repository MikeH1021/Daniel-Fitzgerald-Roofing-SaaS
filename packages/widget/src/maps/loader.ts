let loaderPromise: Promise<void> | null = null;

/**
 * Lazily injects the Google Maps bootstrap script into document.head.
 * Singleton — subsequent calls return the same promise.
 * Resolves immediately if google.maps.importLibrary already exists (host page loaded Maps).
 */
export function loadMapsApi(apiKey: string): Promise<void> {
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve) => {
    // Guard: already loaded by host page
    if (typeof (window as any).google !== 'undefined' && (window as any).google?.maps?.importLibrary) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    // The minified bootstrap loader from Google — sets up google.maps.importLibrary()
    // without loading any map code yet.
    script.textContent = `(g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=\`https://maps.\${c}apis.com/maps/api/js?\`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({key:"${apiKey}",v:"weekly"});`;

    // Inline script (textContent) executes synchronously on appendChild — resolve immediately after append
    document.head.appendChild(script);
    resolve();
  });

  return loaderPromise;
}

/**
 * Calls google.maps.importLibrary(name) to load a specific Maps library on demand.
 */
export async function importMapsLibrary(name: string): Promise<unknown> {
  return (window as any).google.maps.importLibrary(name);
}

/**
 * Reset the singleton for testing purposes.
 */
export function _resetForTesting(): void {
  loaderPromise = null;
}
