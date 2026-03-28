// script.js

// 1. Lògica per a les micro-animacions quan els elements entren a la vista
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15 // Quan un 15% de la targeta és visible
};

const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('show');
            // Eliminem classes de delay inicial i ocultació un cop l'animació ha de finalitzar
            // per assegurar que el Hover (passar el ratolí) no tingui retards
            setTimeout(() => {
                entry.target.classList.remove('hidden', 'delay-1', 'delay-2', 'delay-3');
            }, 1000);
            observer.unobserve(entry.target); // Deixa d'observar un cop ha aparegut
        }
    });
}, observerOptions);

const hiddenElements = document.querySelectorAll('.hidden');
hiddenElements.forEach((el) => observer.observe(el));


// 2. Lògica màgica de degradat Fosc -> Clar basat en l'Scroll
// Definirem els colors inicials (Fosc) i els finals (Clar) en format RGB
// Slate 900 -> f8fafc (Slate 50) per exemple.
const theme = {
    dark: {
        bg: [15, 23, 42],       // #0f172a
        text: [248, 250, 252],  // #f8fafc
        muted: [148, 163, 184], // #94a3b8
        cardBgAlpha: 0.05,
        cardBorderAlpha: 0.1,
        headerAlpha: 0.7
    },
    light: {
        bg: [248, 250, 252],    // #f8fafc
        text: [15, 23, 42],     // #0f172a
        muted: [71, 85, 105],   // #475569
        cardBgAlpha: 0.6,       // targetes més opaques/blanques en clar
        cardBorderAlpha: 0.05,  // vora molt subtil
        headerAlpha: 0.8
    }
};

// Funció per interpolar valors
function lerp(start, end, factor) {
    return start + (end - start) * factor;
}

// Funció per interpolar colors Array[R,G,B]
function lerpColor(color1, color2, factor) {
    const r = Math.round(lerp(color1[0], color2[0], factor));
    const g = Math.round(lerp(color1[1], color2[1], factor));
    const b = Math.round(lerp(color1[2], color2[2], factor));
    return `rgb(${r}, ${g}, ${b})`;
}

// Element root per modificar variables CSS
const root = document.documentElement;

window.addEventListener('scroll', () => {
    // Calculem el progrés de l'scroll
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    
    // Altura total scrolleable és (altura total del document - altura de la finestra)
    // Però volem que l'efecte arribi al "mode clar" abans del final de tot. Podríem ficar un límit de 1200px o algun percentage.
    // Ho farem segons l'element "about" i "hobbies"
    
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    
    // scrollFactor s'accelera multiplicant-lo, per arribar al mode clar molt abans.
    // x2.5 vol dir que al 40% de l'scroll ja haurem arribat al 100% clar.
    let scrollFactor = (scrollTop / docHeight) * 2.5;
    // Assegurem que estigui entre 0 i 1
    scrollFactor = Math.min(Math.max(scrollFactor, 0), 1);
    
    // Per donar un toc més suau i exponencial podríem ajustar la formula
    // Però l'interpolació lineal està bé.

    // 1. Fons de la web
    const interpolatedBg = lerpColor(theme.dark.bg, theme.light.bg, scrollFactor);
    root.style.setProperty('--bg-color', interpolatedBg);
    
    // 2. Text principal
    const interpolatedText = lerpColor(theme.dark.text, theme.light.text, scrollFactor);
    root.style.setProperty('--text-color', interpolatedText);
    
    // 3. Text secundari
    const interpolatedMuted = lerpColor(theme.dark.muted, theme.light.muted, scrollFactor);
    root.style.setProperty('--text-muted', interpolatedMuted);
    
    // 4. Background del Header per al Glassmorphism
    // Quan estem a fosc, es [15,23,42], en clar és blanquinós.
    const hBgColor = [
        lerp(theme.dark.bg[0], theme.light.bg[0], scrollFactor),
        lerp(theme.dark.bg[1], theme.light.bg[1], scrollFactor),
        lerp(theme.dark.bg[2], theme.light.bg[2], scrollFactor)
    ];
    const headerAlpha = lerp(theme.dark.headerAlpha, theme.light.headerAlpha, scrollFactor);
    root.style.setProperty('--header-bg', `rgba(${Math.round(hBgColor[0])}, ${Math.round(hBgColor[1])}, ${Math.round(hBgColor[2])}, ${headerAlpha})`);

    // 5. Targetes Background
    // Les targetes en fosc fan servir color blanc translúcid, pero quan anem a clar fan servir color negre translúcid o blanc més opac?
    // Una carta en mode clar sovint és rgba(255,255,255) pur amb ombra. I en mode fosc és rgba(255,255,255, 0.05).
    const cardAlpha = lerp(theme.dark.cardBgAlpha, theme.light.cardBgAlpha, scrollFactor);
    const borderAlpha = lerp(theme.dark.cardBorderAlpha, theme.light.cardBorderAlpha, scrollFactor);
    
    // Interpolem entre blanc pur per ambdós fons si ho volem com un "overlay" clar damunt el fons canviant,  
    // però en el mode clar enlloc de blanc total volem potser blanc pur (255,255,255).
    root.style.setProperty('--card-bg', `rgba(255, 255, 255, ${cardAlpha})`);
    
    // Si la web de fons és #f8fafc a llum, el gris clar com a boda anirà be
    // Volem que la vora canvi a negre? No, blanc. Però la ombra podria canviar.
    const borderRgb = [
        lerp(255, 0, scrollFactor),
        lerp(255, 0, scrollFactor),
        lerp(255, 0, scrollFactor)
    ];
    root.style.setProperty('--card-border', `rgba(${Math.round(borderRgb[0])}, ${Math.round(borderRgb[1])}, ${Math.round(borderRgb[2])}, ${borderAlpha})`);
    
});

/* =======================
   Galeria i Lightbox Automàtic
   ======================= */

// Injecció de l'HTML del Lightbox de forma global al BODY
document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("lightbox")) {
        const lightboxHtml = `
            <div id="lightbox" class="lightbox" onclick="closeLightbox()">
                <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
                <img id="lightbox-img" class="lightbox-content" src="" alt="Ampliació" onclick="event.stopPropagation()">
                <div id="lightbox-caption" class="lightbox-caption"></div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', lightboxHtml);
    }
});

function openLightbox(imageSrc, captionText) {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    const caption = document.getElementById('lightbox-caption');
    
    img.src = imageSrc;
    caption.textContent = captionText;
    
    lightbox.classList.add('active');
    document.body.classList.add('lightbox-open');
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    lightbox.classList.remove('active');
    document.body.classList.remove('lightbox-open');
}

// Generador de Galeria a partir de JSON/Array
function renderGallery(imagesArray, basePath, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = ""; // Esborra placeholders
    
    imagesArray.forEach((filename) => {
        // Ex: Moto_Pirineus_2010.png -> parts: [Moto, Pirineus, 2010]
        const noExt = filename.split('.').slice(0, -1).join('.'); // Treu l'extensió (.png/.jpg)
        const parts = noExt.split('_'); 
        
        // Batejador Intel·ligent de Títols
        let friendlyCaption = noExt; 
        if (parts.length >= 3) {
            // E.g. "Pirineus (2010)"
            friendlyCaption = `${parts[1].replace(/-/g, ' ')} (${parts[2]})`;
        } else if (parts.length === 2) {
            friendlyCaption = parts.join(' ');
        }
        
        const imgSrc = basePath + filename;
        
        // Creem la targeta Flotant
        const photoDiv = document.createElement("div");
        photoDiv.className = "floating-photo";
        
        // Atorga una rotació aleatòria entre -4 i +4 graus a la instància per crear caos organitzat 📸
        const randomDegree = (Math.random() * 8 - 4).toFixed(2);
        photoDiv.style.setProperty('--random-rotation', `${randomDegree}deg`);
        
        photoDiv.onclick = () => openLightbox(imgSrc, friendlyCaption);
        
        photoDiv.innerHTML = `
            <img src="${imgSrc}" alt="${friendlyCaption}">
            <span class="photo-caption">${friendlyCaption}</span>
        `;
        
        container.appendChild(photoDiv);
    });
}
