import { Platform } from "react-native";

/**
 * ── Anon Chat Configuration ──
 *
 * If running on the web, it automatically uses the current URL (window.location.origin).
 * If running on mobile (Expo Go), it falls back to the EXPO_PUBLIC_SOCKET_URL.
 */

const getSocketUrl = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
        // Determine dynamically from where the web app is hosted (e.g. Render)
        // If running in development (localhost:8081), point to localhost:3000
        if (window.location.hostname === "localhost") {
            return "http://localhost:3000";
        }
        return window.location.origin;
    }

    // Mobile fallback (your ngrok or local IP)
    return process.env.EXPO_PUBLIC_SOCKET_URL || "http://192.168.1.100:3000";
};

const SOCKET_URL = getSocketUrl();

export default SOCKET_URL;
