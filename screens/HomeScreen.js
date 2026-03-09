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
            const existing = savedRooms.find((r) => r.roomCode === code);
            let newRooms = [...savedRooms];
            if (!existing) {
                newRooms.push({ displayName: name, roomCode: code });
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newRooms));
                setSavedRooms(newRooms);
            } else if (existing.displayName !== name) {
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
        setRoomCode("");

        navigation.navigate("ChatRoom", { displayName: name, roomCode: code });
    };

    const navigateToRoom = (room) => {
        navigation.navigate("ChatRoom", {
            displayName: room.displayName,
            roomCode: room.roomCode,
        });
    };

    const renderRoomItem = ({ item, index }) => (
        <TouchableOpacity
            style={styles.roomRow}
            activeOpacity={0.6}
            onPress={() => navigateToRoom(item)}
        >
            {/* Bitmoji-style avatar circle */}
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>👻</Text>
            </View>
            <View style={styles.roomInfo}>
                <Text style={styles.roomName}>{item.roomCode}</Text>
                <Text style={styles.roomSub}>Tap to open · {item.displayName}</Text>
            </View>
            <View style={styles.cameraIcon}>
                <Text style={{ fontSize: 18 }}>📷</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safe}>
            {/* ── Snapchat-style Header ── */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={{ fontSize: 22 }}>👻</Text>
                </View>
                <Text style={styles.headerTitle}>Chat</Text>
                <TouchableOpacity
                    style={styles.headerRight}
                    activeOpacity={0.7}
                    onPress={() => setModalVisible(true)}
                >
                    <Text style={styles.newChatIcon}>✏️</Text>
                </TouchableOpacity>
            </View>

            {/* ── Search bar ── */}
            <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>🔍</Text>
                <Text style={styles.searchPlaceholder}>Search</Text>
            </View>

            {/* ── Rooms List ── */}
            <FlatList
                data={savedRooms}
                keyExtractor={(item) => item.roomCode}
                renderItem={renderRoomItem}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyGhost}>👻</Text>
                        <Text style={styles.emptyTitle}>No Chats Yet</Text>
                        <Text style={styles.emptySub}>
                            Tap ✏️ to join a room anonymously.{"\n"}All messages are untraceable.
                        </Text>
                    </View>
                }
            />

            {/* ── FAB ── */}
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
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={styles.modalCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>New Chat</Text>
                            <View style={{ width: 50 }} />
                        </View>

                        <Text style={styles.label}>DISPLAY NAME</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. ShadowFox"
                            placeholderTextColor="#666"
                            value={displayName}
                            onChangeText={setDisplayName}
                            autoCapitalize="none"
                            maxLength={20}
                        />

                        <Text style={[styles.label, { marginTop: 20 }]}>ROOM CODE</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. ABCD"
                            placeholderTextColor="#666"
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
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#000000" },

    // ── Header (Snapchat-style) ──
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerLeft: { width: 40, alignItems: "flex-start" },
    headerTitle: {
        fontSize: 20,
        fontWeight: "800",
        color: "#FFFFFF",
        letterSpacing: 0.5,
    },
    headerRight: { width: 40, alignItems: "flex-end" },
    newChatIcon: { fontSize: 20 },

    // ── Search ──
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1A1A1A",
        marginHorizontal: 12,
        marginBottom: 8,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    searchIcon: { fontSize: 14, marginRight: 8 },
    searchPlaceholder: { color: "#666", fontSize: 15 },

    // ── Room list ──
    listContent: { paddingBottom: 100 },
    roomRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    avatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: "#FFFC00",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    avatarText: { fontSize: 22 },
    roomInfo: { flex: 1 },
    roomName: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
    roomSub: { color: "#888", fontSize: 13, marginTop: 2 },
    cameraIcon: { paddingLeft: 12 },
    separator: { height: 1, backgroundColor: "#1A1A1A", marginLeft: 76 },

    // ── Empty State ──
    emptyState: { alignItems: "center", marginTop: 80, paddingHorizontal: 40 },
    emptyGhost: { fontSize: 64, marginBottom: 16 },
    emptyTitle: { fontSize: 20, fontWeight: "800", color: "#FFFFFF", marginBottom: 8 },
    emptySub: { fontSize: 14, color: "#888", textAlign: "center", lineHeight: 20 },

    // ── FAB ──
    fab: {
        position: "absolute",
        bottom: 28,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#FFFC00",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#FFFC00",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    fabIcon: { color: "#000000", fontSize: 30, fontWeight: "400", marginTop: -2 },

    // ── Modal ──
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.85)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#111111",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 20,
        paddingBottom: Platform.OS === "ios" ? 40 : 24,
    },
    modalHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#333",
        alignSelf: "center",
        marginBottom: 16,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    },
    modalCancel: { color: "#FFFC00", fontSize: 15, fontWeight: "700" },
    modalTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
    label: { fontSize: 11, fontWeight: "800", color: "#888", letterSpacing: 1.5, marginBottom: 8 },
    input: {
        backgroundColor: "#1A1A1A",
        borderRadius: 4,
        paddingHorizontal: 14,
        paddingVertical: 14,
        fontSize: 16,
        color: "#FFFFFF",
    },
    joinButton: {
        marginTop: 24,
        backgroundColor: "#FFFC00",
        borderRadius: 24,
        paddingVertical: 15,
        alignItems: "center",
    },
    joinButtonText: { color: "#000000", fontSize: 16, fontWeight: "800" },
});
