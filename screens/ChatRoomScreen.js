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
    AppState,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { io } from "socket.io-client";
import * as Notifications from "expo-notifications";
import SOCKET_URL from "../config";

export default function ChatRoomScreen({ route, navigation }) {
    const { displayName, roomCode } = route.params;
    const isFocused = useIsFocused();
    const isFocusedRef = useRef(isFocused);

    const socketRef = useRef(null);
    const flatListRef = useRef(null);
    const typingTimeout = useRef(null);

    const [messages, setMessages] = useState([]);
    const [members, setMembers] = useState([]);
    const [polls, setPolls] = useState([]);
    const [inputText, setInputText] = useState("");
    const [membersVisible, setMembersVisible] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);

    // Reply state
    const [replyingTo, setReplyingTo] = useState(null);

    // Poll creation state
    const [pollModalVisible, setPollModalVisible] = useState(false);
    const [pollQuestion, setPollQuestion] = useState("");
    const [pollOptions, setPollOptions] = useState(["", ""]);

    useEffect(() => {
        isFocusedRef.current = isFocused;
    }, [isFocused]);

    // ── Connect on mount ──
    useEffect(() => {
        const socket = io(SOCKET_URL, {
            transports: ["websocket"],
            forceNew: true,
        });
        socketRef.current = socket;

        socket.on("connect", () => {
            socket.emit("join-room", { displayName, roomCode });
            if (Platform.OS === "web" && "serviceWorker" in navigator) {
                registerWebPush(socket);
            }
        });

        socket.on("room-members", (memberList) => setMembers(memberList));

        socket.on("chat-history", (history) => {
            setMessages(history);
            if (history.length < 50) setHasMoreMessages(false);
        });

        socket.on("new-message", (msg) => {
            setMessages((prev) => [...prev, msg]);
            if (
                Platform.OS !== "web" &&
                (!isFocusedRef.current || AppState.currentState !== "active")
            ) {
                Notifications.scheduleNotificationAsync({
                    content: { title: `🔒 ${roomCode}`, body: msg.text, sound: true },
                    trigger: null,
                });
            }
        });

        // Pagination
        socket.on("older-messages", (older) => {
            setLoadingOlder(false);
            if (older.length === 0) {
                setHasMoreMessages(false);
                return;
            }
            if (older.length < 25) setHasMoreMessages(false);
            setMessages((prev) => [...older, ...prev]);
        });

        // Polls
        socket.on("poll-history", (pollList) => setPolls(pollList));
        socket.on("new-poll", (poll) => setPolls((prev) => [...prev, poll]));
        socket.on("poll-update", (updatedPoll) => {
            setPolls((prev) => prev.map((p) => (p.id === updatedPoll.id ? updatedPoll : p)));
        });

        // Typing
        socket.on("user-typing", () => {
            setIsTyping(true);
            clearTimeout(typingTimeout.current);
            typingTimeout.current = setTimeout(() => setIsTyping(false), 2000);
        });

        socket.on("connect_error", (err) => console.warn("Socket err:", err.message));

        return () => {
            socket.disconnect();
            clearTimeout(typingTimeout.current);
        };
    }, [displayName, roomCode]);

    // ── Web Push ──
    const registerWebPush = async (socket) => {
        try {
            const registration = await navigator.serviceWorker.register("/service-worker.js");
            const res = await fetch(`${SOCKET_URL}/vapid-public-key`);
            const { publicKey } = await res.json();
            const urlBase64ToUint8Array = (b64) => {
                const pad = "=".repeat((4 - (b64.length % 4)) % 4);
                const raw = window.atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
                return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
            };
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
            });
            socket.emit("register-push", sub.toJSON());
        } catch (err) {
            console.warn("Web Push registration failed:", err);
        }
    };

    // ── Typing debounce ──
    const typingDebounce = useRef(null);
    const handleTextChange = (text) => {
        setInputText(text);
        if (socketRef.current && text.trim()) {
            clearTimeout(typingDebounce.current);
            typingDebounce.current = setTimeout(() => socketRef.current.emit("typing"), 300);
        }
    };

    // ── Send message ──
    const sendMessage = useCallback(() => {
        const trimmed = inputText.trim();
        if (!trimmed || !socketRef.current) return;
        const payload = { text: trimmed };
        if (replyingTo) {
            payload.replyTo = { text: replyingTo.text, timestamp: replyingTo.timestamp };
        }
        socketRef.current.emit("send-message", payload);
        setInputText("");
        setReplyingTo(null);
    }, [inputText, replyingTo]);

    // ── Load older messages ──
    const loadOlderMessages = () => {
        if (loadingOlder || !hasMoreMessages || messages.length === 0 || !socketRef.current) return;
        setLoadingOlder(true);
        const oldestId = messages[0]?.id;
        if (oldestId) {
            socketRef.current.emit("load-more-messages", { beforeId: oldestId });
        } else {
            setLoadingOlder(false);
        }
    };

    // ── Poll helpers ──
    const addPollOption = () => {
        if (pollOptions.length < 10) setPollOptions([...pollOptions, ""]);
    };
    const removePollOption = (i) => {
        if (pollOptions.length > 2) setPollOptions(pollOptions.filter((_, idx) => idx !== i));
    };
    const submitPoll = () => {
        const q = pollQuestion.trim();
        const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
        if (!q || opts.length < 2 || !socketRef.current) return;
        socketRef.current.emit("create-poll", { question: q, options: opts });
        setPollQuestion("");
        setPollOptions(["", ""]);
        setPollModalVisible(false);
    };
    const voteOnPoll = (pollId, optIdx) => {
        if (socketRef.current) socketRef.current.emit("vote-poll", { pollId, optionIndex: optIdx });
    };

    // ── Build combined feed ──
    const buildFeed = () => {
        const feed = [];
        messages.forEach((m) => feed.push({ type: "message", ...m }));
        polls.forEach((p) => feed.push({ type: "poll", ...p, timestamp: p.createdAt }));
        feed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return feed;
    };

    const formatTime = (iso) => {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    // ── Render poll card ──
    const renderPollCard = (item) => (
        <View style={styles.pollCard}>
            <Text style={styles.pollLabel}>📊 POLL</Text>
            <Text style={styles.pollQuestion}>{item.question}</Text>
            {item.options.map((opt, i) => {
                const pct = item.totalVotes > 0 ? Math.round((item.votes[i] / item.totalVotes) * 100) : 0;
                return (
                    <TouchableOpacity key={i} style={styles.pollOptionBtn} onPress={() => voteOnPoll(item.id, i)} activeOpacity={0.7}>
                        <View style={[styles.pollOptionFill, { width: `${pct}%` }]} />
                        <Text style={styles.pollOptionText}>{opt}</Text>
                        <Text style={styles.pollOptionVotes}>{item.votes[i]} ({pct}%)</Text>
                    </TouchableOpacity>
                );
            })}
            <Text style={styles.pollMeta}>{item.totalVotes} vote{item.totalVotes !== 1 ? "s" : ""} · {formatTime(item.createdAt)}</Text>
        </View>
    );

    // ── Render feed item ──
    const renderFeedItem = ({ item }) => {
        if (item.type === "poll") return renderPollCard(item);
        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={() => setReplyingTo(item)}
                delayLongPress={400}
            >
                <View style={styles.messageBubble}>
                    {item.replyTo && (
                        <View style={styles.replyPreview}>
                            <Text style={styles.replyPreviewText} numberOfLines={2}>
                                {item.replyTo.text}
                            </Text>
                        </View>
                    )}
                    <Text style={styles.messageText}>{item.text}</Text>
                    <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const feedData = buildFeed();

    return (
        <SafeAreaView style={styles.safe}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <Text style={styles.backBtn}>← Back</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.roomTitle}>🔒 {roomCode}</Text>
                </View>
                <TouchableOpacity onPress={() => setMembersVisible(true)} activeOpacity={0.7}>
                    <View style={styles.membersBadge}>
                        <Text style={styles.membersBadgeText}>👥 {members.length}</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Members Modal */}
            <Modal visible={membersVisible} transparent animationType="fade" onRequestClose={() => setMembersVisible(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setMembersVisible(false)}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Members</Text>
                        {members.map((name, i) => (
                            <View key={i} style={styles.memberRow}>
                                <View style={styles.memberAvatar}>
                                    <Text style={styles.memberAvatarText}>{name.charAt(0).toUpperCase()}</Text>
                                </View>
                                <Text style={styles.memberName}>{name}</Text>
                            </View>
                        ))}
                        <TouchableOpacity style={styles.modalClose} onPress={() => setMembersVisible(false)}>
                            <Text style={styles.modalCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            {/* Poll Creation Modal */}
            <Modal visible={pollModalVisible} transparent animationType="slide" onRequestClose={() => setPollModalVisible(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setPollModalVisible(false)}>
                    <Pressable style={styles.pollModalCard} onPress={() => { }}>
                        <Text style={styles.modalTitle}>📊 Create Poll</Text>
                        <TextInput style={styles.pollInput} placeholder="Ask a question..." placeholderTextColor="#555" value={pollQuestion} onChangeText={setPollQuestion} maxLength={200} />
                        {pollOptions.map((opt, i) => (
                            <View key={i} style={styles.pollOptionRow}>
                                <TextInput
                                    style={[styles.pollInput, { flex: 1 }]}
                                    placeholder={`Option ${i + 1}`}
                                    placeholderTextColor="#555"
                                    value={opt}
                                    onChangeText={(t) => { const c = [...pollOptions]; c[i] = t; setPollOptions(c); }}
                                    maxLength={100}
                                />
                                {pollOptions.length > 2 && (
                                    <TouchableOpacity onPress={() => removePollOption(i)} style={styles.pollRemoveBtn}>
                                        <Text style={styles.pollRemoveText}>✕</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}
                        {pollOptions.length < 10 && (
                            <TouchableOpacity style={styles.pollAddOptionBtn} onPress={addPollOption}>
                                <Text style={styles.pollAddOptionText}>+ Add Option</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.modalClose, (!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2) && styles.sendButtonDisabled]}
                            onPress={submitPoll}
                            disabled={!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2}
                        >
                            <Text style={styles.modalCloseText}>Create Poll</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Feed */}
            <FlatList
                ref={flatListRef}
                data={feedData}
                keyExtractor={(item, i) => `${item.type}-${item.id || i}`}
                renderItem={renderFeedItem}
                contentContainerStyle={styles.messagesList}
                inverted
                scrollEventThrottle={100}
                onEndReached={loadOlderMessages}
                onEndReachedThreshold={0.1}
                ListFooterComponent={
                    loadingOlder ? (
                        <View style={styles.loadingMore}>
                            <ActivityIndicator color="#6c63ff" size="small" />
                        </View>
                    ) : hasMoreMessages && messages.length > 0 ? (
                        <TouchableOpacity style={styles.loadMoreBtn} onPress={loadOlderMessages}>
                            <Text style={styles.loadMoreText}>↑ Load older messages</Text>
                        </TouchableOpacity>
                    ) : null
                }
                ListEmptyComponent={
                    <View style={[styles.emptyContainer, { transform: [{ scaleY: -1 }] }]}>
                        <Text style={styles.emptyEmoji}>🤫</Text>
                        <Text style={styles.emptyText}>No messages yet.{"\n"}Be the first to say something anonymous!</Text>
                    </View>
                }
            />

            {/* Typing indicator */}
            {isTyping && (
                <View style={styles.typingBar}>
                    <Text style={styles.typingText}>someone is typing...</Text>
                </View>
            )}

            {/* Reply preview bar */}
            {replyingTo && (
                <View style={styles.replyBar}>
                    <View style={styles.replyBarContent}>
                        <Text style={styles.replyBarLabel}>Replying to</Text>
                        <Text style={styles.replyBarText} numberOfLines={1}>{replyingTo.text}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyBarClose}>
                        <Text style={styles.replyBarCloseText}>✕</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Input bar */}
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
                <View style={styles.inputBar}>
                    <TouchableOpacity style={styles.pollButton} onPress={() => setPollModalVisible(true)} activeOpacity={0.7}>
                        <Text style={styles.pollButtonText}>📊</Text>
                    </TouchableOpacity>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Type anonymously..."
                        placeholderTextColor="#555"
                        value={inputText}
                        onChangeText={handleTextChange}
                        multiline
                        maxLength={500}
                        onSubmitEditing={sendMessage}
                        blurOnSubmit={false}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
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
    safe: { flex: 1, backgroundColor: "#000000" },

    // Header
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#111111" },
    backBtn: { color: "#FFFC00", fontSize: 15, fontWeight: "700" },
    headerCenter: { alignItems: "center" },
    roomTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", letterSpacing: 0.5 },
    membersBadge: { backgroundColor: "#FFFC00", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    membersBadgeText: { color: "#000000", fontSize: 13, fontWeight: "800" },

    // Members Modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center" },
    modalCard: { backgroundColor: "#111111", borderRadius: 20, padding: 24, width: "80%", maxHeight: "60%", borderWidth: 1, borderColor: "#2E2E2D" },
    modalTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginBottom: 16, textAlign: "center" },
    memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
    memberAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#FFFC00", alignItems: "center", justifyContent: "center", marginRight: 12 },
    memberAvatarText: { color: "#000000", fontSize: 14, fontWeight: "800" },
    memberName: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
    modalClose: { marginTop: 20, backgroundColor: "#FFFC00", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
    modalCloseText: { color: "#000000", fontWeight: "800", fontSize: 15 },

    // Messages
    messagesList: { paddingHorizontal: 16, paddingVertical: 12, flexGrow: 1 },
    messageBubble: { backgroundColor: "#111111", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 10, alignSelf: "flex-start", maxWidth: "85%", borderLeftWidth: 3, borderLeftColor: "#00CBFE" },
    messageText: { color: "#FFFFFF", fontSize: 16, lineHeight: 21 },
    messageTime: { color: "#777777", fontSize: 11, marginTop: 6, textAlign: "right" },

    // Reply preview inside message bubble
    replyPreview: { backgroundColor: "#2E2E2D", borderLeftWidth: 3, borderLeftColor: "#FF0049", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 },
    replyPreviewText: { color: "#AAAAAA", fontSize: 13, fontStyle: "italic" },

    // Reply bar above input
    replyBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#111111", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#2E2E2D" },
    replyBarContent: { flex: 1 },
    replyBarLabel: { color: "#FF0049", fontSize: 11, fontWeight: "800", marginBottom: 2 },
    replyBarText: { color: "#FFFFFF", fontSize: 13 },
    replyBarClose: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#2E2E2D", justifyContent: "center", alignItems: "center", marginLeft: 10 },
    replyBarCloseText: { color: "#FF0049", fontSize: 12, fontWeight: "800" },

    // Load more
    loadingMore: { paddingVertical: 16, alignItems: "center" },
    loadMoreBtn: { paddingVertical: 12, alignItems: "center" },
    loadMoreText: { color: "#00CBFE", fontSize: 14, fontWeight: "700" },

    // Empty state
    emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { color: "#777777", fontSize: 14, textAlign: "center", lineHeight: 22 },

    // Typing
    typingBar: { paddingHorizontal: 20, paddingVertical: 6 },
    typingText: { color: "#00CBFE", fontSize: 13, fontWeight: "600", fontStyle: "italic" },

    // Input bar
    inputBar: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#111111", backgroundColor: "#000000" },
    pollButton: { width: 40, height: 44, justifyContent: "center", alignItems: "center", marginRight: 4 },
    pollButtonText: { fontSize: 22 },
    textInput: { flex: 1, backgroundColor: "#111111", borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, fontSize: 16, color: "#FFFFFF", maxHeight: 100 },
    sendButton: { marginLeft: 10, backgroundColor: "#00CBFE", width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
    sendButtonDisabled: { backgroundColor: "#2E2E2D" },
    sendButtonText: { color: "#000000", fontSize: 20, fontWeight: "800" },

    // Poll card
    pollCard: { backgroundColor: "#111111", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10, alignSelf: "stretch", borderLeftWidth: 3, borderLeftColor: "#FFFC00" },
    pollLabel: { color: "#FFFC00", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 6 },
    pollQuestion: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", marginBottom: 12, lineHeight: 21 },
    pollOptionBtn: { position: "relative", backgroundColor: "#000000", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 6, overflow: "hidden", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    pollOptionFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#FFFC0044", borderRadius: 10 },
    pollOptionText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600", zIndex: 1 },
    pollOptionVotes: { color: "#AAAAAA", fontSize: 13, fontWeight: "700", zIndex: 1 },
    pollMeta: { color: "#777777", fontSize: 11, marginTop: 8, textAlign: "right" },

    // Poll modal
    pollModalCard: { backgroundColor: "#111111", borderRadius: 20, padding: 24, width: "88%", maxHeight: "75%", borderWidth: 1, borderColor: "#2E2E2D" },
    pollInput: { backgroundColor: "#000000", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: "#FFFFFF", marginBottom: 10 },
    pollOptionRow: { flexDirection: "row", alignItems: "center" },
    pollRemoveBtn: { marginLeft: 8, marginBottom: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: "#2E2E2D", justifyContent: "center", alignItems: "center" },
    pollRemoveText: { color: "#FF0049", fontSize: 14, fontWeight: "800" },
    pollAddOptionBtn: { borderWidth: 1, borderColor: "#FFFC00", borderStyle: "dashed", borderRadius: 12, paddingVertical: 10, alignItems: "center", marginBottom: 4 },
    pollAddOptionText: { color: "#FFFC00", fontSize: 15, fontWeight: "700" },
});

