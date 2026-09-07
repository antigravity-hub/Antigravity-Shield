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
        extend: {},
    },
    plugins: [daisyui, containerQueries],
    daisyui: {
        themes: [
            {
                light: {
                    "primary": "#3b82f6",
                    "secondary": "#64748b",
                    "accent": "#10b981",
                    "neutral": "#1f2937",
                    "base-100": "#ffffff",
                    "info": "#0ea5e9",
                    "success": "#10b981",
                    "warning": "#f59e0b",
                    "error": "#ef4444",
                },
            },
            {
                dark: {
                    "primary": "#06b6d4",
                    "secondary": "#6366f1",
                    "accent": "#10b981",
                    "neutral": "#1e293b",
                    "base-100": "#090d16",
                    "base-200": "#0f172a",
                    "base-300": "#1e293b",
                    "info": "#38bdf8",
                    "success": "#10b981",
                    "warning": "#f59e0b",
                    "error": "#f43f5e",
                },
            },
        ],
        darkTheme: "dark",
    },
}
