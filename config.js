/**
 * ── Anon Chat Configuration ──
 *
 * The socket URL can be set via the EXPO_PUBLIC_SOCKET_URL environment
 * variable, or you can simply change the fallback string below to your
 * computer's local network IP address (e.g. "http://192.168.1.42:3000").
 *
 * Usage:
 *   • .env file  →  EXPO_PUBLIC_SOCKET_URL=http://192.168.1.42:3000
 *   • OR edit the fallback constant below.
 */

const SOCKET_URL =
    process.env.EXPO_PUBLIC_SOCKET_URL || "http://192.168.1.100:3000";

export default SOCKET_URL;
