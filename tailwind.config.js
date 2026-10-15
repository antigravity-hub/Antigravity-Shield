import daisyui from "daisyui";
import containerQueries from "@tailwindcss/container-queries";

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
                // High-End Seafoam Green Architecture centered on #93e9be
                seafoam: {
                    50: '#f0fdf6',
                    100: '#dcfce9',
                    200: '#bbf7d6',
                    300: '#93e9be', // Core signature Seafoam Green
                    400: '#4ade9a',
                    500: '#1fc17a',
                    600: '#129a5f', // Accessible deep Seafoam Green for text/buttons
                    700: '#0f794c',
                    800: '#105e3d',
                    900: '#0c4c32',
                    950: '#05291b',
                },
                // Re-route blue to Seafoam Green so all existing 280+ components adopt the theme seamlessly
                blue: {
                    50: '#f0fdf6',
                    100: '#dcfce9',
                    200: '#bbf7d6',
                    300: '#93e9be',
                    400: '#4ade9a',
                    500: '#1fc17a',
                    600: '#129a5f',
                    700: '#0f794c',
                    800: '#105e3d',
                    900: '#0c4c32',
                    950: '#05291b',
                },
                // Soft mint-aqua for sky
                sky: {
                    50: '#f0fdfa',
                    100: '#ccfbf1',
                    200: '#99f6e4',
                    300: '#93e9be',
                    400: '#2dd4bf',
                    500: '#14b8a6',
                    600: '#0d9488',
                    700: '#0f766e',
                    800: '#115e59',
                    900: '#134e4a',
                    950: '#042f2e',
                },
                // Crisp mint for cyan
                cyan: {
                    50: '#f0fdf9',
                    100: '#d1fae5',
                    200: '#a7f3d0',
                    300: '#93e9be',
                    400: '#34d399',
                    500: '#10b981',
                    600: '#059669',
                    700: '#047857',
                    800: '#065f46',
                    900: '#064e3b',
                    950: '#022c22',
                },
            },
        },
    },
    plugins: [daisyui, containerQueries],
    daisyui: {
        themes: [
            {
                light: {
                    "primary": "#129a5f",
                    "secondary": "#64748b",
                    "accent": "#93e9be",
                    "neutral": "#1f2937",
                    "base-100": "#ffffff",
                    "base-200": "#f8faf9",
                    "base-300": "#edf2ee",
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
                    "neutral": "#13231c",
                    "base-100": "#080e0c",
                    "base-200": "#0c1713",
                    "base-300": "#13231c",
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
