import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Modal,
    Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { io } from "socket.io-client";
import SOCKET_URL from "../config";

export default function ChatRoomScreen({ route, navigation }) {
    const { displayName, roomCode } = route.params;

    const socketRef = useRef(null);
    const flatListRef = useRef(null);

    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [inputText, setInputText] = useState("");
    const [membersVisible, setMembersVisible] = useState(false);

    // ── Connect on mount ──
    useEffect(() => {
        const socket = io(SOCKET_URL, {
            transports: ["websocket"],
            forceNew: true,
        });
        socketRef.current = socket;

        socket.on("connect", () => {
            socket.emit("join-room", { displayName, roomCode });
        });

        socket.on("room-users", (userList) => {
            setUsers(userList);
        });

        socket.on("chat-history", (history) => {
            setMessages(history);
        });

        socket.on("new-message", (msg) => {
            setMessages((prev) => [...prev, msg]);
        });

        socket.on("connect_error", (err) => {
            console.warn("Socket connection error:", err.message);
        });

        return () => {
            socket.disconnect();
        };
    }, [displayName, roomCode]);

    // ── Send message ──
    const sendMessage = useCallback(() => {
        const trimmed = inputText.trim();
        if (!trimmed || !socketRef.current) return;
        socketRef.current.emit("send-message", { text: trimmed });
        setInputText("");
    }, [inputText]);

    // ── Format timestamp ──
    const formatTime = (iso) => {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    // ── Render a single message bubble ──
    const renderMessage = ({ item }) => (
        <View style={styles.messageBubble}>
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.safe}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <Text style={styles.backBtn}>← Back</Text>
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                    <Text style={styles.roomTitle}>🔒 {roomCode}</Text>
                </View>

                <TouchableOpacity
                    onPress={() => setMembersVisible(true)}
                    activeOpacity={0.7}
                >
                    <View style={styles.membersBadge}>
                        <Text style={styles.membersBadgeText}>👥 {users.length}</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* ── Members Modal ── */}
            <Modal
                visible={membersVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setMembersVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setMembersVisible(false)}
                >
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Members in Room</Text>
                        {users.map((name, i) => (
                            <View key={i} style={styles.memberRow}>
                                <Text style={styles.memberDot}>●</Text>
                                <Text style={styles.memberName}>{name}</Text>
                            </View>
                        ))}
                        <TouchableOpacity
                            style={styles.modalClose}
                            onPress={() => setMembersVisible(false)}
                        >
                            <Text style={styles.modalCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            {/* ── Messages ── */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(_, i) => String(i)}
                renderItem={renderMessage}
                contentContainerStyle={styles.messagesList}
                onContentSizeChange={() =>
                    flatListRef.current?.scrollToEnd({ animated: true })
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyEmoji}>🤫</Text>
                        <Text style={styles.emptyText}>
                            No messages yet.{"\n"}Be the first to say something anonymous!
                        </Text>
                    </View>
                }
            />

            {/* ── Input bar ── */}
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                <View style={styles.inputBar}>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Type anonymously..."
                        placeholderTextColor="#555"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        maxLength={500}
                        onSubmitEditing={sendMessage}
                        blurOnSubmit={false}
                    />
                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            !inputText.trim() && styles.sendButtonDisabled,
                        ]}
                        onPress={sendMessage}
                        activeOpacity={0.7}
                        disabled={!inputText.trim()}
                    >
                        <Text style={styles.sendButtonText}>▲</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: "#0f0f1a",
    },

    // ── Header ──
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#1e1e35",
    },
    backBtn: {
        color: "#6c63ff",
        fontSize: 15,
        fontWeight: "600",
    },
    headerCenter: {
        alignItems: "center",
    },
    roomTitle: {
        color: "#ffffff",
        fontSize: 17,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    membersBadge: {
        backgroundColor: "#1a1a2e",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#2a2a44",
    },
    membersBadgeText: {
        color: "#aaaacc",
        fontSize: 13,
        fontWeight: "600",
    },

    // ── Members Modal ──
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalCard: {
        backgroundColor: "#1a1a2e",
        borderRadius: 20,
        padding: 24,
        width: "80%",
        maxHeight: "60%",
        borderWidth: 1,
        borderColor: "#2a2a44",
    },
    modalTitle: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 16,
        textAlign: "center",
    },
    memberRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
    },
    memberDot: {
        color: "#4ade80",
        fontSize: 10,
        marginRight: 10,
    },
    memberName: {
        color: "#ccccee",
        fontSize: 15,
    },
    modalClose: {
        marginTop: 20,
        backgroundColor: "#6c63ff",
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
    },
    modalCloseText: {
        color: "#ffffff",
        fontWeight: "700",
        fontSize: 15,
    },

    // ── Messages ──
    messagesList: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexGrow: 1,
    },
    messageBubble: {
        backgroundColor: "#1a1a2e",
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#2a2a44",
        alignSelf: "flex-start",
        maxWidth: "85%",
    },
    messageText: {
        color: "#e0e0f0",
        fontSize: 15,
        lineHeight: 21,
    },
    messageTime: {
        color: "#555577",
        fontSize: 11,
        marginTop: 6,
        textAlign: "right",
    },

    // ── Empty state ──
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 80,
    },
    emptyEmoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    emptyText: {
        color: "#555577",
        fontSize: 14,
        textAlign: "center",
        lineHeight: 22,
    },

    // ── Input bar ──
    inputBar: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: "#1e1e35",
        backgroundColor: "#0f0f1a",
    },
    textInput: {
        flex: 1,
        backgroundColor: "#1a1a2e",
        borderRadius: 20,
        paddingHorizontal: 18,
        paddingVertical: 12,
        fontSize: 15,
        color: "#ffffff",
        maxHeight: 100,
        borderWidth: 1,
        borderColor: "#2a2a44",
    },
    sendButton: {
        marginLeft: 10,
        backgroundColor: "#6c63ff",
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#6c63ff",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
        elevation: 4,
    },
    sendButtonDisabled: {
        backgroundColor: "#2a2a44",
        shadowOpacity: 0,
        elevation: 0,
    },
    sendButtonText: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "700",
    },
});
