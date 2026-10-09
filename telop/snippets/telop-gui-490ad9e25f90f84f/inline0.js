
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

export async function load_server_fonts_js(on_font_loaded) {
    if (typeof window === 'undefined') return;
    try {
        const resp = await fetch('./fonts/fonts.json');
        if (!resp.ok) {
            console.log("[dr_telop] No ./fonts/fonts.json found on server. Skipping server font auto-load.");
            return;
        }
        const manifest = await resp.json();
        if (!Array.isArray(manifest) || manifest.length === 0) return;

        console.log(`[dr_telop] Found ${manifest.length} fonts in server manifest.`);

        // 1. default: true のフォントを最優先で取得
        let defaultItem = manifest.find(item => item.default);
        if (!defaultItem && manifest.length > 0) {
            defaultItem = manifest[0];
        }

        if (defaultItem && defaultItem.file) {
            try {
                const fResp = await fetch('./fonts/' + defaultItem.file);
                if (fResp.ok) {
                    const buffer = await fResp.arrayBuffer();
                    on_font_loaded(defaultItem.name || defaultItem.file, new Uint8Array(buffer));
                    console.log(`[dr_telop] Loaded default server font: ${defaultItem.name || defaultItem.file}`);
                }
            } catch (e) {
                console.warn("Failed to fetch default server font:", e);
            }
        }

        // 2. 残りのフォントもバックグラウンドで取得
        for (const item of manifest) {
            if (item !== defaultItem && item.file) {
                try {
                    const fResp = await fetch('./fonts/' + item.file);
                    if (fResp.ok) {
                        const buffer = await fResp.arrayBuffer();
                        on_font_loaded(item.name || item.file, new Uint8Array(buffer));
                        console.log(`[dr_telop] Loaded server font: ${item.name || item.file}`);
                    }
                } catch (e) {
                    console.warn(`Failed to fetch server font ${item.file}:`, e);
                }
            }
        }
    } catch (e) {
        console.log("[dr_telop] Server fonts not available:", e);
    }
}
