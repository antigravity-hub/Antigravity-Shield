import daisyui from "daisyui";
import containerQueries from "@tailwindcss/container-queries";

// Harmonic Seafoam Green Spectrum centered on #93e9be
const seafoamCore = {
    50: '#f0fdf6',
    100: '#dcfce9',
    200: '#bbf7d6',
    300: '#93e9be', // Core signature Seafoam Green
    400: '#4ade9a',
    500: '#1fc17a',
    600: '#129a5f', // High-contrast accessible Seafoam Green for text/buttons
    700: '#0f794c',
    800: '#105e3d',
    900: '#0c4c32',
    950: '#05291b',
};

// Deep Seafoam / Jade Accent (for gradients and contrast)
const seafoamDeep = {
    50: '#f0fdf9',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#93e9be',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#0a3f32',
    950: '#04241d',
};

// Organic Pine-Slate (Eliminates all cold navy blue! Luxurious eye-friendly graphite)
const organicGraphite = {
    50: '#f5f9f6',
    100: '#e8f2ec',
    200: '#d1e3d8',
    300: '#accbba',
    400: '#81ac98',
    500: '#5e8e7a',
    600: '#477060',
    700: '#38584c',
    800: '#14221b', // Card borders, subtle secondary surfaces
    900: '#09120e', // Primary dark card background (0% navy blue, 100% soothing)
    950: '#050a08', // Deepest background tone
};

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Vazirmatn', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
            },
            colors: {
                seafoam: seafoamCore,
                // Replace cold navy-blue slate with luxurious organic graphite
                slate: organicGraphite,
                gray: organicGraphite,
                zinc: organicGraphite,
                neutral: organicGraphite,
                // Re-route blue, sky, cyan, indigo to the Seafoam Green spectrum
                blue: seafoamCore,
                sky: seafoamDeep,
                cyan: seafoamCore,
                indigo: seafoamDeep,
            },
        },
    },
    plugins: [daisyui, containerQueries],
    daisyui: {
        themes: [
            {
                light: {
                    "primary": "#129a5f",
                    "secondary": "#475569",
                    "accent": "#93e9be",
                    "neutral": "#1f2937",
                    "base-100": "#ffffff",
                    "base-200": "#f5f9f6",
                    "base-300": "#e8f2ec",
                    "info": "#14b8a6",
                    "success": "#10b981",
                    "warning": "#f59e0b",
                    "error": "#ef4444",
                },
            },
            {
                dark: {
                    "primary": "#93e9be",
                    "secondary": "#34d399",
                    "accent": "#93e9be",
                    "neutral": "#14221b",
                    "base-100": "#050a08",
                    "base-200": "#09120e",
                    "base-300": "#14221b",
                    "info": "#5eead4",
                    "success": "#93e9be",
                    "warning": "#fbbf24",
                    "error": "#f43f5e",
                },
            },
        ],
        darkTheme: "dark",
    },
}
