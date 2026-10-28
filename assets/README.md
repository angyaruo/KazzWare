# Kazz artwork

The nine PNGs were supplied by the project owner as KazzWare's mascot references and assets. Images used by the interface are bundled unchanged, with original dimensions and transparency. No image-generation service or external image hosting is used at runtime.

- `kazz-curled.png`: “Elfo chibi en espiral mecánica.png”, the floating launcher (image 6).
- `kazz-perched.png`: “Elfo cibernético entre garras mecánicas.png”, the home composition.
- `kazz-listening.png`: “Chibi gótico con cola escorpión mecánica.png”, leaning over the chat input.
- `kazz-wink.png`: “Elfo chibi y cola mecánica.png”, the quiet Gallery.
- `kazz-cover.png`: “Alerta viral ciber gótica KazzWare.png”, the input-bar extension icon and visual reference for the silver/red palette.
- `kazz-peek.png`: “Chibi demon mecánico asomándose.png”, the mobile edge launcher. CSS mirrors it at the left edge; the source image is unchanged.
- `kazz-idle.png`, `kazz-active.png`, `kazz-working.png`: original poses retained in source; not embedded in the current frontend.

The owner’s two hand-drawn layouts inform the floating composition. Those reference drawings are not shipped.

The later “Interfaz cyberpunk glitch con personaje central.png” supplied by the owner informs the damaged terminal housings in 0.7.1. Its layout and surface details are recreated with original local SVG/CSS in `src/chrome.ts`; the reference image is not shipped as a flattened interface. Labels and controls remain native HTML elements.

The project owner has not granted a public redistribution license for this artwork. Do not treat dependency licenses as a license to the mascot images.

## Display typeface

`fonts/BarlowCondensed-Black.ttf` is the unmodified Barlow Condensed Black face from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/barlowcondensed), copyright 2017 The Barlow Project Authors. Its SIL Open Font License is included in `fonts/OFL.txt` and in runtime packages. The build embeds the font so the UI makes no external font requests. `KazzDisplay` is the CSS family alias; the font file itself is unchanged.

The visual reference screenshots inform the layout direction only. No game logos, screenshots, or third-party character artwork are included in the extension.
