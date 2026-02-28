import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Alert,
    FlatList,
    Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

const STORAGE_KEY = "@anon_chat_rooms";

export default function HomeScreen({ navigation }) {
    const [savedRooms, setSavedRooms] = useState([]);
    const [isModalVisible, setModalVisible] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const [roomCode, setRoomCode] = useState("");

    // Load rooms when screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            loadSavedRooms();
        }, [])
    );

    const loadSavedRooms = async () => {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            if (data) {
                setSavedRooms(JSON.parse(data));
            }
        } catch (e) {
            console.error("Failed to load rooms:", e);
        }
    };

    const saveRoomToStorage = async (name, code) => {
        try {
            // Check if already exists
            const existing = savedRooms.find((r) => r.roomCode === code);
            let newRooms = [...savedRooms];
            if (!existing) {
                newRooms.push({ displayName: name, roomCode: code });
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newRooms));
                setSavedRooms(newRooms);
            } else if (existing.displayName !== name) {
                // Update display name if they changed it
                existing.displayName = name;
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newRooms));
                setSavedRooms(newRooms);
            }
        } catch (e) {
            console.error("Failed to save room:", e);
        }
    };

    const handleJoin = async () => {
        const name = displayName.trim();
        const code = roomCode.trim().toUpperCase();

        if (!name) return Alert.alert("Oops", "Please enter a display name.");
        if (!code) return Alert.alert("Oops", "Please enter a room code.");

        await saveRoomToStorage(name, code);
        setModalVisible(false);

        // Clear the form after joining
        setRoomCode("");
        // Keep display name for convenience

        navigation.navigate("ChatRoom", { displayName: name, roomCode: code });
    };

    const navigateToRoom = (room) => {
        navigation.navigate("ChatRoom", {
            displayName: room.displayName,
            roomCode: room.roomCode,
        });
    };

    const renderRoomItem = ({ item }) => (
        <TouchableOpacity
            style={styles.roomCard}
            activeOpacity={0.7}
            onPress={() => navigateToRoom(item)}
        >
            <View style={styles.roomIcon}>
                <Text style={styles.roomIconText}>{item.roomCode.substring(0, 2)}</Text>
            </View>
            <View style={styles.roomInfo}>
                <Text style={styles.roomName}>{item.roomCode}</Text>
                <Text style={styles.roomSubtext}>Joined as {item.displayName}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safe}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Chats</Text>
            </View>

            {/* ── Rooms List ── */}
            <FlatList
                data={savedRooms}
                keyExtractor={(item) => item.roomCode}
                renderItem={renderRoomItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emoji}>🕵️</Text>
                        <Text style={styles.emptyTitle}>No Chats Yet</Text>
                        <Text style={styles.emptySub}>
                            Tap the + button to join a room anonymously. All messages are untraceable.
                        </Text>
                    </View>
                }
            />

            {/* ── Floating Action Button ── */}
            <TouchableOpacity
                style={styles.fab}
                activeOpacity={0.8}
                onPress={() => setModalVisible(true)}
            >
                <Text style={styles.fabIcon}>+</Text>
            </TouchableOpacity>

            {/* ── Join Room Modal ── */}
            <Modal visible={isModalVisible} animationType="slide" transparent>
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Join a Room</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={styles.modalCloseText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>

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
                            <Text style={styles.joinButtonText}>Join Room</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#0f0f1a" },
    header: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: "#1e1e35",
    },
    headerTitle: { fontSize: 32, fontWeight: "800", color: "#ffffff" },
    listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },

    // Room Card
    roomCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1a1a2e",
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#2a2a44",
    },
    roomIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#2a2a44",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16,
    },
    roomIconText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
    roomInfo: { flex: 1 },
    roomName: { color: "#ffffff", fontSize: 18, fontWeight: "700", marginBottom: 4 },
    roomSubtext: { color: "#8888aa", fontSize: 13 },
    chevron: { color: "#444466", fontSize: 24 },

    // Empty State
    emptyState: { alignItems: "center", marginTop: 60, paddingHorizontal: 30 },
    emoji: { fontSize: 56, marginBottom: 16 },
    emptyTitle: { fontSize: 22, fontWeight: "700", color: "#ffffff", marginBottom: 8 },
    emptySub: { fontSize: 15, color: "#8888aa", textAlign: "center", lineHeight: 22 },

    // FAB
    fab: {
        position: "absolute",
        bottom: 30,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#6c63ff",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#6c63ff",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
    },
    fabIcon: { color: "#ffffff", fontSize: 32, fontWeight: "300", bottom: 2 },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#1a1a2e",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: Platform.OS === "ios" ? 40 : 24,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    },
    modalTitle: { color: "#ffffff", fontSize: 20, fontWeight: "700" },
    modalCloseText: { color: "#6c63ff", fontSize: 16, fontWeight: "600" },
    label: { fontSize: 11, fontWeight: "700", color: "#6c63ff", letterSpacing: 1.5, marginBottom: 8 },
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
    joinButton: {
        marginTop: 24,
        backgroundColor: "#6c63ff",
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
    },
    joinButtonText: { color: "#ffffff", fontSize: 17, fontWeight: "700" },
});
