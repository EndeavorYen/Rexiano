DISTILLED_AESTHETICS_PROMPT = """
<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:

Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.

Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.

Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.

Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>
"""

★ Insight ─────────────────────────────────────

WSL2 + Electron 開發的兩個坑：

VS Code 的終端會設定 ELECTRON_RUN_AS_NODE=1（因為 VS Code 本身就是 Electron 應用），這讓子程序的 Electron 以 Node.js 模式運行。必須 unset 它。
WSL2 不支援 Chromium sandbox（seccomp-bpf），需要 NO_SANDBOX=1。GPU 也會 fallback 到軟體渲染。
─────────────────────────────────────────────────

為什麼傳 number[] 而不是 Uint8Array：Electron 的 IPC 使用 structured clone 序列化資料，Uint8Array 在跨 context 傳遞時可能會遺失型別資訊。用 number[] 更安全，renderer 端再轉回 Uint8Array 即可。