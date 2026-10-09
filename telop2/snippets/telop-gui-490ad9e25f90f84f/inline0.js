
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
