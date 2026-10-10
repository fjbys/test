
export function check_local_font_api_supported() {
    return typeof window !== 'undefined' && 'queryLocalFonts' in window;
}

export async function load_local_fonts_js(on_font_loaded) {
    if (typeof window === 'undefined' || !('queryLocalFonts' in window)) {
        alert("お使いのブラウザは Local Font Access API に未対応です。Google Chrome または Microsoft Edge をご利用ください。");
        return;
    }
    try {
        const fonts = await window.queryLocalFonts();
        console.log(`[dr_telop] Found ${fonts.length} local fonts.`);

        // 日本語・代表フォントのキーワード
        const jaKeywords = ["hiragino", "meiryo", "yu ", "yu gothic", "yumincho", "noto", "gothic", "mincho", "osaka", "biz"];

        const loadedFamilies = new Set();
        let loadedCount = 0;
        const maxLoad = 40; // メモリ枯渇を防ぐための安全上限

        // 1. 日本語フォントを最優先で取得
        for (const font of fonts) {
            const famLower = (font.family || "").toLowerCase();
            const isJa = jaKeywords.some(k => famLower.includes(k));
            if (isJa && !loadedFamilies.has(font.family) && loadedCount < maxLoad) {
                try {
                    const blob = await font.blob();
                    const buffer = await blob.arrayBuffer();
                    const bytes = new Uint8Array(buffer);
                    on_font_loaded(font.fullName || font.family, bytes);
                    loadedFamilies.add(font.family);
                    loadedCount++;
                } catch (e) {
                    console.warn(`Failed to read font ${font.family}:`, e);
                }
            }
        }

        // 2. 定番フォントの追加取得
        for (const font of fonts) {
            if (loadedCount >= maxLoad) break;
            if (!loadedFamilies.has(font.family)) {
                try {
                    const blob = await font.blob();
                    const buffer = await blob.arrayBuffer();
                    const bytes = new Uint8Array(buffer);
                    on_font_loaded(font.fullName || font.family, bytes);
                    loadedFamilies.add(font.family);
                    loadedCount++;
                } catch (e) {
                    console.warn(`Failed to read font ${font.family}:`, e);
                }
            }
        }
        console.log(`[dr_telop] Loaded ${loadedCount} font families into editor.`);
    } catch (err) {
        if (err.name === 'NotAllowedError') {
            console.warn("[dr_telop] User dismissed font permission dialog.");
        } else {
            console.error("[dr_telop] Local Font Access error:", err);
        }
    }
}

let currentProjectFileHandle = null;

export async function save_file_with_picker_js(default_name, ext_desc, ext, data) {
    const mime = ext === 'png' ? 'image/png' : 'application/json';
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: default_name,
                types: [{
                    description: ext_desc,
                    accept: { [mime]: ['.' + ext] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(data);
            await writable.close();
            if (ext === 'json') {
                currentProjectFileHandle = handle;
            }
            return handle.name;
        } catch (err) {
            if (err.name === 'AbortError') {
                return null;
            }
            console.warn("showSaveFilePicker failed, falling back to Blob download:", err);
        }
    }
    // フォールバック: Blob ダウンロード
    try {
        const blob = new Blob([data], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = default_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return default_name;
    } catch (e) {
        console.error("Blob download failed:", e);
        return null;
    }
}

export async function save_or_overwrite_file_js(default_name, ext_desc, ext, data) {
    if (ext === 'json' && currentProjectFileHandle) {
        try {
            const writable = await currentProjectFileHandle.createWritable();
            await writable.write(data);
            await writable.close();
            console.log(`[dr_telop] Overwrote file directly without picker: ${currentProjectFileHandle.name}`);
            return currentProjectFileHandle.name;
        } catch (err) {
            console.warn("Direct overwrite failed, falling back to save picker:", err);
            currentProjectFileHandle = null;
        }
    }
    return await save_file_with_picker_js(default_name, ext_desc, ext, data);
}

export async function open_file_with_picker_js(ext_desc, ext, on_file_loaded) {
    const mime = ext === 'png' ? 'image/png' : 'application/json';
    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: ext_desc,
                    accept: { [mime]: ['.' + ext] }
                }],
                multiple: false
            });
            const file = await handle.getFile();
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            if (ext === 'json') {
                currentProjectFileHandle = handle;
            }
            on_file_loaded(file.name, bytes);
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.warn("showOpenFilePicker failed, falling back to file input:", err);
        }
    }
    // フォールバック: <input type="file">
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.' + ext;
    input.onchange = async () => {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            on_file_loaded(file.name, bytes);
        }
    };
    input.click();
}

let cachedServerManifest = null;
let cachedManifestBasePath = './fonts/';

export async function load_server_fonts_js(on_font_loaded, on_ui_font_selected, on_default_font_selected, on_manifest_names_loaded) {
    if (typeof window === 'undefined') return;
    try {
        let resp = await fetch('./fonts/fonts.json');
        let basePath = './fonts/';
        if (!resp.ok) {
            resp = await fetch('./fonts.json');
            basePath = './';
        }
        if (!resp.ok) {
            console.log("[dr_telop] No fonts.json found (checked ./fonts/fonts.json and ./fonts.json). Skipping server font auto-load.");
            return;
        }

        const manifest = await resp.json();
        if (!Array.isArray(manifest) || manifest.length === 0) return;

        cachedServerManifest = manifest;
        cachedManifestBasePath = basePath;
        console.log(`[dr_telop] Found ${manifest.length} fonts in server manifest.`);

        // マニフェスト内の全フォント名一覧を通知
        const names = manifest.map(item => item.name || item.family).filter(Boolean);
        if (on_manifest_names_loaded) {
            on_manifest_names_loaded(names);
        }

        function resolveUrl(target) {
            if (!target) return null;
            if (target.startsWith('http://') || target.startsWith('https://')) {
                return target;
            }
            return basePath + target;
        }

        function getItemUrls(item) {
            if (Array.isArray(item.files)) {
                return item.files.map(resolveUrl).filter(Boolean);
            }
            if (Array.isArray(item.urls)) {
                return item.urls.map(resolveUrl).filter(Boolean);
            }
            const single = resolveUrl(item.url || item.file);
            return single ? [single] : [];
        }

        const loadedUrls = new Set();

        async function fetchUrl(fontUrl, fontName) {
            if (!fontUrl || loadedUrls.has(fontUrl)) return null;
            try {
                const fResp = await fetch(fontUrl);
                if (fResp.ok) {
                    const buffer = await fResp.arrayBuffer();
                    on_font_loaded(fontName, new Uint8Array(buffer));
                    loadedUrls.add(fontUrl);
                    console.log(`[dr_telop] Loaded server font: ${fontName} (${fontUrl})`);
                    return fontName;
                } else {
                    console.warn(`Failed to fetch font from ${fontUrl}: status ${fResp.status}`);
                }
            } catch (e) {
                console.warn(`Failed to fetch server font from ${fontUrl}:`, e);
            }
            return null;
        }

        async function fetchAndRegisterItem(item) {
            const fontName = item.name || item.family || "ServerFont";
            const urls = getItemUrls(item);
            let firstSuccess = null;
            for (const url of urls) {
                const res = await fetchUrl(url, fontName);
                if (res && !firstSuccess) {
                    firstSuccess = res;
                }
            }
            return firstSuccess;
        }

        // 1. 【最優先】ui: true のフォントを取得し、UI用フォントとして通知
        const uiItem = manifest.find(item => item.ui);
        if (uiItem) {
            const name = await fetchAndRegisterItem(uiItem);
            if (name && on_ui_font_selected) {
                on_ui_font_selected(name);
                console.log(`[dr_telop] Selected UI font: ${name}`);
            }
        }

        // 2. 【次優先】default: true のフォント（テロップ初期値）を取得
        let defaultItem = manifest.find(item => item.default);
        if (!defaultItem && !uiItem && manifest.length > 0) {
            defaultItem = manifest[0];
        }
        if (defaultItem) {
            const name = await fetchAndRegisterItem(defaultItem);
            if (name && on_default_font_selected) {
                on_default_font_selected(name);
                console.log(`[dr_telop] Selected default telop font: ${name}`);
            }
        }

        // 3. 他のフォントはオンデマンド読み込み（起動時はスキップして初期通信を最小化）
        console.log("[dr_telop] Server fonts on-demand catalog initialized.");
    } catch (e) {
        console.log("[dr_telop] Server fonts not available:", e);
    }
}

export async function fetch_server_font_by_name_js(target_name, on_font_loaded) {
    if (!cachedServerManifest) return;
    const item = cachedServerManifest.find(i => (i.name || i.family) === target_name);
    if (!item) return;

    function resolveUrl(target) {
        if (!target) return null;
        if (target.startsWith('http://') || target.startsWith('https://')) return target;
        return cachedManifestBasePath + target;
    }

    let urls = [];
    if (Array.isArray(item.files)) urls = item.files.map(resolveUrl).filter(Boolean);
    else if (Array.isArray(item.urls)) urls = item.urls.map(resolveUrl).filter(Boolean);
    else if (item.url || item.file) {
        const u = resolveUrl(item.url || item.file);
        if (u) urls.push(u);
    }

    const fontName = item.name || item.family || target_name;
    for (const url of urls) {
        try {
            const resp = await fetch(url);
            if (resp.ok) {
                const buffer = await resp.arrayBuffer();
                on_font_loaded(fontName, new Uint8Array(buffer));
                console.log(`[dr_telop] On-demand loaded font: ${fontName} from ${url}`);
            }
        } catch (e) {
            console.warn(`[dr_telop] On-demand fetch failed for ${url}:`, e);
        }
    }
}

export function storage_get_js(key) {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem(key);
        }
    } catch (e) {
        console.warn("[dr_telop] localStorage get failed:", e);
    }
    return null;
}

export function storage_set_js(key, value) {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, value);
        }
    } catch (e) {
        console.warn("[dr_telop] localStorage set failed:", e);
    }
}

export async function open_font_files_with_picker_js(on_font_loaded) {
    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
        try {
            const handles = await window.showOpenFilePicker({
                types: [{
                    description: 'Font Files (*.ttf, *.otf, *.woff, *.woff2, *.ttc)',
                    accept: {
                        'font/*': ['.ttf', '.otf', '.woff', '.woff2', '.ttc'],
                        'application/font-woff': ['.woff'],
                        'application/font-woff2': ['.woff2'],
                        'application/x-font-truetype': ['.ttf'],
                        'application/x-font-opentype': ['.otf'],
                        'application/octet-stream': ['.ttf', '.otf', '.woff', '.woff2', '.ttc']
                    }
                }],
                multiple: true
            });
            let loadedCount = 0;
            for (const handle of handles) {
                try {
                    const file = await handle.getFile();
                    const buffer = await file.arrayBuffer();
                    const bytes = new Uint8Array(buffer);
                    on_font_loaded(file.name, bytes);
                    loadedCount++;
                } catch (e) {
                    console.warn(`[dr_telop] Failed to read font file ${handle.name}:`, e);
                }
            }
            console.log(`[dr_telop] User imported ${loadedCount} font files via picker.`);
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.warn("showOpenFilePicker for fonts failed, falling back to file input:", err);
        }
    }
    // フォールバック: <input type="file" multiple>
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.ttf,.otf,.woff,.woff2,.ttc';
    input.onchange = async () => {
        if (input.files && input.files.length > 0) {
            let loadedCount = 0;
            for (const file of Array.from(input.files)) {
                try {
                    const buffer = await file.arrayBuffer();
                    const bytes = new Uint8Array(buffer);
                    on_font_loaded(file.name, bytes);
                    loadedCount++;
                } catch (e) {
                    console.warn(`[dr_telop] Failed to read font file ${file.name}:`, e);
                }
            }
            console.log(`[dr_telop] User imported ${loadedCount} font files via input fallback.`);
        }
    };
    input.click();
}
