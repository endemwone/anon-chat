import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen({ navigation }) {
    const [displayName, setDisplayName] = useState("");
    const [roomCode, setRoomCode] = useState("");

    const handleJoin = () => {
        const name = displayName.trim();
        const code = roomCode.trim().toUpperCase();

        if (!name) return Alert.alert("Oops", "Please enter a display name.");
        if (!code) return Alert.alert("Oops", "Please enter a room code.");

        navigation.navigate("ChatRoom", { displayName: name, roomCode: code });
    };

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                {/* ── Branding ── */}
                <View style={styles.heroSection}>
                    <Text style={styles.emoji}>🕵️</Text>
                    <Text style={styles.title}>Anon Chat</Text>
                    <Text style={styles.subtitle}>
                        Say anything.{"\n"}Nobody knows it's you.
                    </Text>
                </View>

                {/* ── Form ── */}
                <View style={styles.formCard}>
                    <Text style={styles.label}>DISPLAY NAME</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. ShadowFox"
                        placeholderTextColor="#555"
                        value={displayName}
                        onChangeText={setDisplayName}
                        autoCapitalize="none"
                        maxLength={20}
                    />

                    <Text style={[styles.label, { marginTop: 18 }]}>ROOM CODE</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. ABCD"
                        placeholderTextColor="#555"
                        value={roomCode}
                        onChangeText={setRoomCode}
                        autoCapitalize="characters"
                        maxLength={12}
                    />

                    <TouchableOpacity
                        style={styles.joinButton}
                        activeOpacity={0.8}
                        onPress={handleJoin}
                    >
                        <Text style={styles.joinButtonText}>Join Room →</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.footer}>Messages are never linked to your name.</Text>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: "#0f0f1a",
    },
    container: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 28,
    },

    // ── Hero ──
    heroSection: {
        alignItems: "center",
        marginBottom: 36,
    },
    emoji: {
        fontSize: 56,
        marginBottom: 8,
    },
    title: {
        fontSize: 36,
        fontWeight: "800",
        color: "#ffffff",
        letterSpacing: 1,
    },
    subtitle: {
        fontSize: 15,
        color: "#8888aa",
        textAlign: "center",
        marginTop: 8,
        lineHeight: 22,
    },

    // ── Form card ──
    formCard: {
        backgroundColor: "#1a1a2e",
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: "#2a2a44",
    },
    label: {
        fontSize: 11,
        fontWeight: "700",
        color: "#6c63ff",
        letterSpacing: 1.5,
        marginBottom: 8,
    },
    input: {
        backgroundColor: "#0f0f1a",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: "#ffffff",
        borderWidth: 1,
        borderColor: "#2a2a44",
    },

    // ── Button ──
    joinButton: {
        marginTop: 24,
        backgroundColor: "#6c63ff",
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
        shadowColor: "#6c63ff",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 6,
    },
    joinButtonText: {
        color: "#ffffff",
        fontSize: 17,
        fontWeight: "700",
        letterSpacing: 0.5,
    },

    // ── Footer ──
    footer: {
        textAlign: "center",
        color: "#444466",
        fontSize: 12,
        marginTop: 28,
    },
});
